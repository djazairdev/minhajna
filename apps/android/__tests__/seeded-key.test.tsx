// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Taking a school's seeded key on a director's device (#548, answer 625),
// against a made-up demo server: in a seeded national world, D-Keys offers to
// wait or to take the seeded key, never to start a second, and taking it holds
// the seeded device's key, marked as taken, with each teacher's first code
// joined, the codes page reading every teacher joined; taking again keeps
// nothing more. A take that stopped partway is finished when D-Keys next holds
// the key. A school the world seeded no key for, a device that holds none of
// the world's keys, or one waiting to be added, takes nothing, and a keyring
// that is not there does not open; once the taker changed the keyring, another
// device is told to be added instead and offered only waiting. While the seeded
// keys cannot be read, D-Keys says why and offers only waiting, and reading
// again offers the take. Every world, school and device is made up.

import {
  directorSchool,
  eventOf,
  keptIssues,
  latestHeld,
  readHolderQr,
  seedNationalWorld,
  type DemoSchool,
} from '@minhajna/core';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { calendar, reference } from '../jest/world-calendar';
import { codeOf, DemoServer, nodeKit } from '../jest/world-server';
import { startSeededWorld } from '../src/demo/world-seed';
import type { Send } from '../src/demo/world-session';
import { waitToHold } from '../src/director/holder-wait';
import { addDevice } from '../src/director/holders-session';
import { holdSchool, joinedDays } from '../src/director/issue-session';
import { PUBLIC_KEY_BYTES } from '../src/director/school-desk';
import { SchoolKeys } from '../src/director/SchoolKeys';
import { takeSeededKey } from '../src/director/seeded-key';
import { leaveWorldNetwork } from '../src/network/world-network';
import { openRecordBook } from '../src/storage/history';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const server = new DemoServer();
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

async function press(testID: string) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
      await settle();
    });
}

async function seeded() {
  const started = await startSeededWorld('national', calendar, reference, nodeKit, server.send);
  const id = started.keys.world;
  const { zones = [], workingDays } = reference.profile;
  const school = directorSchool(seedNationalWorld(id, zones, workingDays, reference.packs))!;
  const held = { world: id, keys: started.keys, sealing: started.sealing };
  const device = async () => ({
    world: id,
    date: started.date,
    book: await openRecordBook(new FakeStorage().asSpec()),
  });
  return { held, school, director: await device(), device };
}

type Seeded = Awaited<ReturnType<typeof seeded>>;

async function page(world: Seeded, send: Send = server.send, open: Seeded['director'] = world.director) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <SchoolKeys world={open} school={world.school} held={world.held} kit={nodeKit} send={send} dayText={String} />,
    );
    await settle();
  });
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      await settle();
    });
}

test('D-Keys offers to take the seeded key, never to start one, and taking it holds the seeded device', async () => {
  const world = await seeded();
  await page(world);
  expect([has('keys-start-wait'), has('keys-take-seeded'), has('keys-start-here')]).toEqual([true, true, false]);
  expect(texts()).toContain(text.demo.keys.start.seededNote);
  await press('keys-take-seeded');
  expect(has('keys-tab')).toBe(true);
  expect(texts()).toContain(text.demo.keys.count.replace('{{number}}', '1'));
  const kept = latestHeld(world.director.book.entries, PUBLIC_KEY_BYTES)!;
  expect([kept.seeded, kept.ring.version]).toEqual([true, 1]);
  const issued = world.director.book.entries.filter((one) => eventOf(one)?.kind === 'school.issued');
  expect(issued).toHaveLength(world.school.teachers.length);
  const desk = await holdSchool(world.director, nodeKit, server.send, false);
  const issues = keptIssues(world.director.book.entries, desk.held.school).values();
  const joined = await joinedDays(world.director.world, desk, issues, nodeKit, server.send);
  expect(joined.size).toBe(world.school.teachers.length);
  const before = world.director.book.entries.length;
  await takeSeededKey(world.director, world.held, world.school, nodeKit, server.send);
  expect(world.director.book.entries).toHaveLength(before);
});

test('no seeded key, no keys of the world, a wait, or a missing keyring takes nothing', async () => {
  const world = await seeded();
  const take = (school: Pick<DemoSchool, 'id' | 'teachers'>, held: typeof world.held | null, send = server.send) =>
    codeOf(takeSeededKey(world.director, held, school, nodeKit, send));
  expect(await take({ ...world.school, id: 'made-up-school' }, world.held)).toBe('E_NO_SCHOOL_KEY');
  expect(await take(world.school, null)).toBe('E_NO_SCHOOL_KEY');
  const hiding: Send = (request) =>
    request.path.includes('/spaces/') && !request.path.includes('/spaces/national/')
      ? Promise.resolve({ status: 200, body: { batches: [], more: false }, retryAfter: null })
      : server.send(request);
  expect(await take(world.school, world.held, hiding)).toBe('E_SCHOOL_KEY');
  expect(latestHeld(world.director.book.entries, PUBLIC_KEY_BYTES)).toBeNull();
  await waitToHold(world.director, nodeKit, server.send);
  expect(await take(world.school, world.held)).toBe('E_SCHOOL_WAITING');
});

test('while the seeded keys cannot be read, D-Keys says why and offers only waiting', async () => {
  const world = await seeded();
  server.busy = true;
  await page(world);
  expect(texts()).toContain(text.demo.problem.busy);
  expect([has('keys-start-wait'), has('keys-take-seeded'), has('keys-start-here')]).toEqual([true, false, false]);
  server.busy = false;
  await press('keys-start-again');
  expect([has('keys-take-seeded'), has('keys-start-again'), has('keys-start-here')]).toEqual([true, false, false]);
});

test('a take that stopped partway is finished when D-Keys next holds the key', async () => {
  const world = await seeded();
  const { book } = world.director;
  const record = book.record.bind(book);
  let writes = 0;
  jest
    .spyOn(book, 'record')
    .mockImplementation((day, event) =>
      (writes += 1) === 4 ? Promise.reject(new Error('A made-up failure')) : record(day, event),
    );
  await expect(takeSeededKey(world.director, world.held, world.school, nodeKit, server.send)).rejects.toThrow();
  const issued = () => book.entries.filter((one) => eventOf(one)?.kind === 'school.issued').length;
  expect(issued()).toBe(2);
  jest.restoreAllMocks();
  await page(world);
  expect(has('keys-tab')).toBe(true);
  expect(issued()).toBe(world.school.teachers.length);
});

test('once the taker changed the keyring, another device is told to be added instead', async () => {
  const world = await seeded();
  await takeSeededKey(world.director, world.held, world.school, nodeKit, server.send);
  const desk = await holdSchool(world.director, nodeKit, server.send, false);
  const added = await world.device();
  const waiting = await waitToHold(added, nodeKit, server.send);
  await addDevice(world.director, desk, readHolderQr(waiting.code)!, nodeKit, server.send);
  const late = await world.device();
  await page(world, server.send, late);
  await press('keys-take-seeded');
  expect(texts()).toContain(text.demo.keys.start.taken);
  expect([has('keys-start-wait'), has('keys-take-seeded'), has('keys-start-here')]).toEqual([true, false, false]);
  expect(latestHeld(late.book.entries, PUBLIC_KEY_BYTES)).toBeNull();
});
