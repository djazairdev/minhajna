// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The classes' records page (#585, D-Record, D-Record-fix, answer 613), on the
// made-up term of term-weeks.ts: read only, with the paper visa and what it
// never shows; a class's course lists its signed weeks newest first by their
// dates, and a week opens with each session's state as signed and the lines on
// what it shows, with no chain or correction, and leads back. A corrected week
// shows its signed corrections, its whole chain, each correction with its
// reason, and the original, the correction or both; a chain missing its
// original and a correction names both and shows only the latest. The both view
// shows a session added or dropped, and two teachers of one course open their
// own weeks. With nothing signed it says so; a problem reading is shown, read
// again and announced on Android; the records are the director's page alone,
// and the words read in every language. Every school, class and teacher is made
// up.

import { correctWeek, type DemoSchool } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { AccessibilityInfo, Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FIRST, joinNew, SECOND, sign, signedTerm } from '../jest/term-weeks';
import { BELLS, school, sendParts, server, session, setting, STAFF } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { workspacePage, type WorkspacePagesProps } from '../src/demo/WorkspacePages';
import type { OpenWorld } from '../src/demo/world-mode';
import type { Send } from '../src/demo/world-session';
import { RecordWeek } from '../src/director/RecordWeek';
import { readRecords } from '../src/director/records-session';
import { SchoolRecords } from '../src/director/SchoolRecords';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { isolate } from '../src/week/grid-labels';
import { readSignChannel, signTheWeek } from '../src/week/week-sign-session';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.records;
const { states } = ar.demo.weekFix;
const STAFFED = { ...school, teachers: STAFF } as unknown as DemoSchool;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const has = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string').length;

async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
const press = (testID: string) =>
  act(() => (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never));
const weekButtons = () =>
  tree!.root.findAll((node) => node.props.testID === 'records-week' && node.props.label !== undefined);
const openWeek = (at: number) => act(() => (weekButtons()[at].props as PressableProps).onPress?.({} as never));

async function render(world: Pick<OpenWorld, 'world' | 'book' | 'date'>, send?: Send) {
  await act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <SchoolRecords
          world={world}
          school={STAFFED}
          kit={kit}
          send={send ?? server.send}
          dayText={(day) => `day ${day}`}
        />
      </LocaleDirContext.Provider>,
    );
  });
}

const dates = (from: string, to: string) =>
  ar.demo.weekSign.dates.replace('{{from}}', `day ${from}`).replace('{{to}}', `day ${to}`);
const line = (session: string, state: string) => words.line.replace('{{session}}', session).replace('{{state}}', state);

test('the director picks a class, then a course’s week, and reads each session’s state as signed', async () => {
  const { id, here } = await signedTerm();
  await render({ ...here, world: id, date: SECOND });
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.readOnly,
      `${isolate('رياضيات')} · ${isolate('بلعيد محمد')}`,
      words.paper,
      words.never,
      ...Object.values(words.hidden),
    ]),
  );
  expect(weekButtons().map((node) => (node.props as { label: string }).label)).toEqual([
    dates('2027-01-10', '2027-01-14'),
    dates('2027-01-03', '2027-01-07'),
  ]);
  await openWeek(1);
  expect(has('record-week')).toBe(1);
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.week.replace('{{class}}', isolate('1م2')),
      words.signed,
      line('day 2027-01-03 · 08:00–09:00', states.held),
      line('day 2027-01-04 · 08:00–09:00', states['not-held']),
      line('day 2027-01-05 · 08:00–09:00', states.awaiting),
      words.asSigned,
      words.noRoll,
    ]),
  );
  expect([has('record-chain'), has('record-fixes')]).toEqual([0, 0]);
  await press('record-back');
  expect([has('records'), has('record-week')]).toEqual([1, 0]);
});

test('a corrected week shows its corrections, its chain, and the original, the correction or both', async () => {
  const { id, here, joined } = await signedTerm();
  const world = { world: id, date: FIRST };
  const { weeks } = await readSignChannel(world, joined, kit, server.send);
  const signed = weeks.find((one) => one.week.week === '2027-01-03')!.week;
  await signTheWeek(
    world,
    joined,
    correctWeek(signed, signed.sessions[2], 'held', 'confirmed-later'),
    kit,
    server.send,
  );
  await render({ ...here, world: id, date: SECOND });
  await openWeek(1);
  const tuesday = 'day 2027-01-05 · 08:00–09:00';
  const fix = words.fix
    .replace('{{number}}', '1')
    .replace('{{session}}', tuesday)
    .replace('{{before}}', states.awaiting)
    .replace('{{after}}', states.held);
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.weekFixed.replace('{{class}}', isolate('1م2')),
      words.signedFixed.replace('{{count}}', '1'),
      words.chainWhole,
      line(tuesday, states.held),
      ar.demo.weekFix.because
        .replace('{{change}}', fix)
        .replace('{{reason}}', ar.demo.weekFix.reasons['confirmed-later']),
    ]),
  );
  await press('record-shown-original');
  expect(texts()).toContain(line(tuesday, states.awaiting));
  await press('record-shown-both');
  expect(texts()).toContain(
    words.both.replace('{{session}}', tuesday).replace('{{before}}', states.awaiting).replace('{{after}}', states.held),
  );
});

test('a chain missing its original names it, and shows only what was read', async () => {
  const { id, here, joined } = await signedTerm();
  const world = { world: id, date: SECOND };
  const { weeks } = await readSignChannel(world, joined, kit, server.send);
  const signed = weeks.find((one) => one.week.week === '2027-01-10')!.week;
  const once = correctWeek(signed, signed.sessions[2], 'held');
  await signTheWeek(world, joined, once, kit, server.send);
  await signTheWeek(world, joined, correctWeek(once, once.sessions[0], 'not-held'), kit, server.send);
  const [course] = (await readRecords(here, school, kit, server.send))[0].courses;
  const week = { ...course.weeks[0], earlier: [] };
  await act(() => {
    tree = ReactTestRenderer.create(
      <RecordWeek record={course} week={week} dates="" dayText={(day) => `day ${day}`} onBack={() => undefined} />,
    );
  });
  const gone = [words.originalName, words.fixNumber.replace('{{number}}', '1')].join(ar.demo.weekSign.listJoin);
  expect(texts()).toContain(words.chainGap.replace('{{versions}}', gone));
  expect(has('record-shown')).toBe(0);
});

test('the both view shows a session added or dropped; two teachers of a course open their own weeks', async () => {
  const { id, here, device, joined } = await setting();
  const other = await joinNew(id, here, device, 'teacher-4');
  await sendParts(here, school, [session('بلعيد محمد', 0, 480), session('قاسمي رضا', 1, 480)], BELLS);
  await sign({ world: id, date: FIRST }, joined, { 0: 'held' });
  await sign({ world: id, date: FIRST }, other, { 1: 'not-held' });
  await render({ ...here, world: id, date: FIRST });
  expect(
    tree!.root.findAll((node) => node.props.testID === 'records-course' && typeof node.type === 'string'),
  ).toHaveLength(2);
  await openWeek(1);
  expect(texts()).toContain(line('day 2027-01-04 · 08:00–09:00', states['not-held']));
  const [course] = (await readRecords(here, school, kit, server.send))[0].courses;
  const original = course.weeks[0];
  const added = { day: 3, start: 480, end: 540, group: '', week: 'both', state: 'held' } as const;
  const later = { ...original.week, version: 1, sessions: [added] };
  const week = { ...original, week: later, earlier: [original] };
  await ReactTestRenderer.act(() => tree?.unmount());
  await act(() => {
    tree = ReactTestRenderer.create(
      <RecordWeek record={course} week={week} dates="" dayText={(day) => `day ${day}`} onBack={() => undefined} />,
    );
  });
  await press('record-shown-both');
  const both = (session: string, before: string, after: string) =>
    words.both.replace('{{session}}', session).replace('{{before}}', before).replace('{{after}}', after);
  expect(texts()).toEqual(
    expect.arrayContaining([
      both('day 2027-01-03 · 08:00–09:00', states.held, states.none),
      both('day 2027-01-06 · 08:00–09:00', states.none, states.held),
    ]),
  );
});

test('with nothing signed it says so; a problem is shown, read again and announced on Android', async () => {
  const { id, here } = await setting();
  let down = true;
  const send: Send = (request) =>
    down ? Promise.resolve({ status: 503, body: null, retryAfter: null }) : server.send(request);
  await render({ ...here, world: id }, send);
  expect([texts().includes(ar.demo.problem.other), texts().includes(words.none)]).toEqual([true, false]);
  down = false;
  await press('records-again');
  expect([texts().includes(ar.demo.problem.other), texts().includes(words.none)]).toEqual([false, true]);
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.replaceProperty(Platform, 'OS', 'android');
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  down = true;
  await render({ ...here, world: id }, send);
  expect(announce).toHaveBeenLastCalledWith(ar.demo.problem.other);
});

test('the records are the director’s page alone, and their words read in every language', () => {
  const props = { open: {}, school: STAFFED, reference: { profile: {} } } as unknown as WorkspacePagesProps;
  expect(workspacePage('director', 'records', props)?.type).toBe(SchoolRecords);
  expect(workspacePage('preparer', 'records', props)).toBeNull();
  const places = (value: unknown): unknown =>
    typeof value === 'string'
      ? (value.match(/\{\{\w+\}\}/gu) ?? []).sort()
      : Object.entries(value as object).map(([key, one]) => [key, places(one)]);
  for (const one of [en, fr]) expect(places(one.demo.records)).toEqual(places(ar.demo.records));
});
