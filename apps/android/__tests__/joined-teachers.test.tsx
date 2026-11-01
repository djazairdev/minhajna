// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Who has joined, for the director's dashboard (#569, #548, answer 625),
// against a made-up demo server: once the seeded key is taken every seeded
// teacher reads joined, and still does after being given a new code; a school
// whose key was started here reads none joined; and the dashboard page says
// when this device holds no key and while it reads, says a failed reading as an
// alert, with no teacher read as joined, and reads again when asked. Every
// world, school and teacher is made up.

import { directorSchool, seedNationalWorld } from '@minhajna/core';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { calendar, reference } from '../jest/world-calendar';
import { DemoServer, nodeKit } from '../jest/world-server';
import { startSeededWorld } from '../src/demo/world-seed';
import { startWorld, type Send } from '../src/demo/world-session';
import { DashboardPage } from '../src/director/DashboardPage';
import { assignmentsOf, holdSchool, issueFor } from '../src/director/issue-session';
import { takeSeededKey } from '../src/director/seeded-key';
import { joinedTeachers } from '../src/director/use-joined-teachers';
import { leaveWorldNetwork } from '../src/network/world-network';
import { openRecordBook } from '../src/storage/history';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const server = new DemoServer();
const board = text.demo.dashboard;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () => tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);
const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const within = (testID: string) =>
  tree!.root
    .findAllByProps({ testID })[0]
    .findAllByType(Text)
    .map((node): unknown => (node.props as TextProps).children);

async function turns() {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      await settle();
    });
}

async function world(seeding: boolean) {
  const started = seeding
    ? await startSeededWorld('national', calendar, reference, nodeKit, server.send)
    : await startWorld('national', calendar, nodeKit, server.send);
  const id = started.keys.world;
  const { zones = [], workingDays } = reference.profile;
  const school = directorSchool(seedNationalWorld(id, zones, workingDays, reference.packs))!;
  const held = { world: id, keys: started.keys, sealing: started.sealing };
  const director = { world: id, date: started.date, book: await openRecordBook(new FakeStorage().asSpec()) };
  return { held, school, director };
}

async function page(open: Awaited<ReturnType<typeof world>>, send: Send = server.send) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <DashboardPage
        world={open.director}
        school={open.school}
        profile={reference.profile}
        trial={null}
        kit={nodeKit}
        send={send}
        dayText={String}
      />,
    );
  });
  await turns();
}

test('every seeded teacher reads joined once the key is taken, and still after a new code', async () => {
  const seeded = await world(true);
  const { director, school } = seeded;
  await takeSeededKey(director, seeded.held, school, nodeKit, server.send);
  const all = school.teachers.map((one) => one.id);
  expect([...(await joinedTeachers(director, school.teachers, nodeKit, server.send))]).toEqual(all);
  const desk = await holdSchool(director, nodeKit, server.send, false);
  const assignment = (await assignmentsOf(desk, school.teachers, nodeKit)).get(school.teachers[0].id)!;
  const { kept } = await issueFor(director, desk, assignment, 'phone', nodeKit, server.send);
  expect(kept.issue).toBe(2);
  expect([...(await joinedTeachers(director, school.teachers, nodeKit, server.send))]).toEqual(all);
  await page(seeded);
  expect(texts().filter((one) => one === board.noFigures)).toHaveLength(18);
  expect(texts()).not.toContain(board.reading);
});

test('a school whose key was started here reads none joined', async () => {
  const { director, school } = await world(false);
  await holdSchool(director, nodeKit, server.send);
  expect(await joinedTeachers(director, school.teachers, nodeKit, server.send)).toEqual(new Set());
});

test('the page says it holds no key, that it reads, and why a reading failed, then reads again', async () => {
  const seeded = await world(true);
  await page(seeded);
  expect(texts()).toContain(board.noKey);
  await takeSeededKey(seeded.director, seeded.held, seeded.school, nodeKit, server.send);
  await ReactTestRenderer.act(() => tree?.unmount());
  let release = () => undefined as void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page(seeded, async (request) => {
    await gate;
    return server.send(request);
  });
  expect(texts()).toContain(board.reading);
  release();
  await turns();
  expect([texts().includes(board.reading), texts().filter((one) => one === board.noFigures).length]).toEqual([
    false,
    18,
  ]);
  await ReactTestRenderer.act(() => tree?.unmount());
  server.busy = true;
  await page(seeded);
  expect(within('dashboard-problem')).toEqual([text.demo.problem.busy]);
  expect(texts().filter((one) => one === board.noFigures)).toHaveLength(0);
  server.busy = false;
  await ReactTestRenderer.act(() => {
    (tree!.root.findAllByProps({ testID: 'dashboard-again' })[0].props as PressableProps).onPress?.({} as never);
  });
  await turns();
  expect(has('dashboard-problem')).toBe(false);
  expect(texts().filter((one) => one === board.noFigures)).toHaveLength(18);
});
