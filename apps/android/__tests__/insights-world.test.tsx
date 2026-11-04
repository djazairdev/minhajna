// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The insights in a demo world (#624, answer 695), against a made-up demo
// server: the teacher's home of a teachers' world carries the row, off, which
// opens the page and goes back home by its button and by Android's back, said
// as it opens; the inspector's home has none; a national world's teacher finds
// them stopped for the school space's classes, with no space joined yet, and
// once the world's date moves onto the first totals day, retired, from that
// day; the keys the world's store kept for a school's codes stop the seeded
// teacher's classes there, named, and another assignment's as the teacher's
// classes in the same school, from the day each was certified, and a working
// out of the classes that fails still lists a row for each join. Every world is
// made up.

import {
  assignmentId,
  directorSchool,
  firstTotalsDay,
  joinCodeText,
  type Certificate,
  type Day,
  type SchoolCalendar,
  type SchoolJoined,
} from '@minhajna/core';
import { AccessibilityInfo, BackHandler, Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import { worldDate } from '../src/demo/world-date';
import type { OpenWorld } from '../src/demo/world-mode';
import { startWorld } from '../src/demo/world-session';
import { seededWorld } from '../src/director/director-world';
import { useWorldInsights } from '../src/insights/use-world-insights';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { shortSchool } from '../src/school/SchoolJoined';
import { openRecordBook } from '../src/storage/history';
import { worldSpec } from '../src/storage/world';
import text from '../src/text/ar.json';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const calendar: SchoolCalendar = read.calendar;
const server = new DemoServer();
const teacher = new FakeStorage();
let world = new FakeWorld(teacher);
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
let os: jest.ReplaceProperty<typeof Platform.OS>;
const words = text.demo.insights;

beforeEach(() => {
  os = jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  world = new FakeWorld(teacher);
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function turns() {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      await settle();
    });
}

async function render(withReference = false) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <DemoRoot
        reference={withReference && read.ok ? read : undefined}
        kit={nodeKit}
        calendar={calendar}
        profile={read.ok ? read.profile : { weekStartsOn: 0 }}
        storage={teacher.asSpec()}
        world={world.asSpec()}
        send={server.send}
        onBack={() => undefined}
        onLeft={() => undefined}
      />,
    );
    await settle();
  });
}

const shown = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string').length > 0;
const texts = () => tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
    await settle();
  });
  await turns();
}

test('a teachers’ world offers them off from the teacher’s home, there and back', async () => {
  const handlers = new Set<Parameters<typeof BackHandler.addEventListener>[1]>();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.add(handler);
    return { remove: () => void handlers.delete(handler) };
  });
  const back = () =>
    ReactTestRenderer.act(async () => {
      [...handlers].reverse().some((handler) => handler({ type: 'hardwareBackPress', timeStamp: 0 }) === true);
      await settle();
    });
  await render();
  await press('demo-start-teachers');
  await press('world-role-teacher');
  expect(texts()).toContain(words.row.teacher);
  await press('world-insights-open');
  expect(shown('insights-page')).toBe(true);
  expect(shown('insights-off')).toBe(true);
  expect(shown('demo-band')).toBe(true);
  expect(tree!.root.findByProps({ testID: 'insights-said' }).props.children).toBe(
    `${words.title}. ${words.sub.teacher}`,
  );
  await press('insights-back');
  expect(shown('insights-page')).toBe(false);
  expect(shown('world-insights-open')).toBe(true);
  os.replaceValue('android');
  const announced = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  await press('world-insights-open');
  expect(announced).toHaveBeenLastCalledWith(`${words.title}. ${words.sub.teacher}`);
  await back();
  expect(shown('insights-page')).toBe(false);
  expect(shown('world-insights-open')).toBe(true);
  await back();
  expect(shown('world-role-teacher')).toBe(true);
});

test('a national world stops them for the school’s classes, then retires them on the first totals day', async () => {
  await render();
  await press('demo-start-national');
  await press('world-role-inspector');
  expect(shown('world-insights-open')).toBe(false);
  await press('world-change-role');
  await press('world-role-teacher');
  expect(texts()).toContain(words.row.school);
  await press('world-insights-open');
  expect(shown('insights-school')).toBe(true);
  expect(shown('insights-no-join')).toBe(true);
  await press('insights-back');
  await press('world-move-date');
  expect(texts()).toContain(words.row.retired);
  await press('world-insights-open');
  expect(shown('insights-retired')).toBe(true);
  const since = worldDate(i18n.t, firstTotalsDay([calendar])!, 'ar', read.ok ? read.profile : { months: [] });
  expect(texts()).toContain(words.retired.since.replace('{{date}}', since));
});

/** A key this device kept for a made-up school space's code, certified on a day of the world. */
function keptJoin(id: string, issued: string, assignment = 'a'.repeat(32)): SchoolJoined {
  const device = 'd'.repeat(32);
  const code = joinCodeText({
    world: id,
    school: 'made-up-school-space-1',
    epoch: 1,
    assignment,
    issue: 1,
    key: 'b'.repeat(64),
  });
  const certificate: Certificate = {
    standIn: true,
    world: id,
    subject: device,
    publicKey: `MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE${'A'.repeat(85)}A==`,
    issued: issued as Day,
    serial: 'e'.repeat(32),
    signature: 'A'.repeat(64),
  };
  return { code, device, pkcs8: 'TWFkZS11cA==', certificate };
}

test('a national world’s kept joins reach the page, with the seeded teacher’s classes', async () => {
  if (!read.ok) throw new Error('The bundled reference does not read');
  const started = await startWorld('national', calendar, nodeKit, server.send);
  leaveWorldNetwork();
  const { code } = started;
  const id = started.keys.world;
  const school = directorSchool(seededWorld(id, read))!;
  const seeded = school.teachers[0];
  const assignment = await assignmentId('made-up-school-space-1', seeded.id, nodeKit.mac);
  const book = await openRecordBook(worldSpec(teacher.asSpec(), world.asSpec(), id));
  const first = calendar.year.terms[0].to;
  await book.record(first, { kind: 'school.joined', joined: keptJoin(id, '2026-12-17', assignment) });
  await book.record(first, { kind: 'school.joined', joined: keptJoin(id, '2026-12-17') });
  await world.leaveWorld();
  await render(true);
  const [input] = tree!.root.findAll(
    (node) => node.props.testID === 'demo-code' && typeof node.props.onChangeText === 'function',
  );
  await ReactTestRenderer.act(async () => {
    (input.props as { onChangeText: (typed: string) => void }).onChangeText(code);
    await settle();
  });
  await press('demo-join');
  await press('world-role-teacher');
  await press('world-insights-open');
  expect(shown('insights-no-join')).toBe(false);
  expect(shown('insights-stopped')).toBe(true);
  const day = worldDate(i18n.t, '2026-12-17' as Day, 'ar', read.profile);
  const names = school.classes.filter((one) => seeded.classIds.includes(one.id)).map((one) => one.name);
  expect(names.length).toBeGreaterThan(0);
  expect(texts()).toEqual(
    expect.arrayContaining([
      ...names,
      words.school.mine,
      words.school.inSpace.replace('{{school}}', school.name).replace('{{date}}', day),
    ]),
  );
  expect(texts()).not.toContain(
    words.school.inSpace.replace('{{school}}', shortSchool('made-up-school-space-1')).replace('{{date}}', day),
  );
});

test('a working out that fails leaves a row for each join', async () => {
  if (!read.ok) throw new Error('The bundled reference does not read');
  const school = directorSchool(seededWorld('K7QF4', read))!;
  const join = keptJoin('K7QF4', '2026-12-17');
  const book = {
    entries: [
      {
        id: 'made-up',
        day: '2026-12-17',
        layer: 'device',
        kind: 'school.joined',
        content: { body: { kind: 'school.joined', joined: join } },
      },
    ],
  };
  const open = { world: 'K7QF4', kind: 'national', date: '2026-12-17', book } as unknown as Pick<
    OpenWorld,
    'world' | 'kind' | 'date' | 'book'
  >;
  const failing = { mac: () => Promise.reject(new Error('Made-up failure')), random: nodeKit.random };
  const storage = teacher.asSpec();
  function Harness() {
    const insights = useWorldInsights({
      open,
      calendars: [calendar],
      school,
      kit: failing,
      storage,
      date: '«2026-12-17»',
      dayText: (one) => `«${one}»`,
    });
    return (
      <>
        {insights.row}
        {insights.page}
      </>
    );
  }
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<Harness />);
    await settle();
  });
  await press('world-insights-open');
  expect(shown('insights-working')).toBe(false);
  expect(shown('insights-stopped')).toBe(true);
  expect(texts()).toContain(words.school.mine);
});
