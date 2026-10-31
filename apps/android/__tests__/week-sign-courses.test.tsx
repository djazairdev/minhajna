// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Week-sign's courses (#582, answer 610): a week is found again by its class
// and its subject's code, so once signed it stays signed when a later version
// names the subject in another language; two subjects of a class are two weeks,
// each chip named with its subject, a session of week A or B listed with its
// week, and signing one leaves the other waiting, while the page opened on a
// course, as the digest opens it, shows that course first, or the first course
// when it is no longer taught; a one-day part gives its day alone; a week this
// key signed already is said apart and reading again shows it signed, while a
// device that did not join first signs nothing; a problem reading is shown with
// a way to read again; and the confirmations are kept apart by join, school and
// course, cleared once confirmed in another world, and forgotten once signed.
// Every school, class and teacher is made up.

import {
  addDays,
  parseDay,
  readJoinCode,
  timetableNameKey,
  type Day,
  type SchoolJoined,
  type Subject,
} from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, View, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { BELLS, school, sendParts, server, session, setting } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { errorCode } from '../src/lock/lock-rules';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import { partFrom } from '../src/timetable/send-session';
import { isolate } from '../src/week/grid-labels';
import { WeekSign } from '../src/week/WeekSign';
import {
  confirmations,
  readSignChannel,
  signTheWeek,
  weekRecord,
  weeksToSign,
  type WeekToSign,
} from '../src/week/week-sign-session';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.weekSign;
const DAYS = [0, 1, 2, 3, 4] as const;
const SUBJECTS: Subject[] = [
  { code: 'math', name: { ar: 'رياضيات', fr: 'Mathématiques', en: 'Maths' }, levels: ['cem'] },
  { code: 'arabic', name: { ar: 'اللغة العربية', fr: 'Arabe', en: 'Arabic' }, levels: ['cem'] },
];
const TEACHER = 'بلعيد محمد';
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const rows = () => tree!.root.findAll((node) => node.props.testID === 'week-sign-row' && node.type === View).length;

async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
const press = (testID: string) =>
  act(() => (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never));

async function render(
  world: { world: string; date: Day },
  join: SchoolJoined,
  send: Send = server.send,
  course?: string,
) {
  await act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <WeekSign
          world={world}
          join={join}
          kit={kit}
          send={send}
          dayText={(day) => `day ${day}`}
          onClose={() => undefined}
          said={words.title}
          workingDays={DAYS}
          subjects={SUBJECTS}
          course={course}
        />
      </LocaleDirContext.Provider>,
    );
  });
}

const arabic = (day: 0 | 1 | 2, start: number, week: 'A' | 'B') => ({
  ...session(TEACHER, day, start),
  subject: 'اللغة العربية',
  week,
});

test('a week signed stays signed when a later version names its subject in another language', async () => {
  const { id, here, joined } = await setting();
  await sendParts(here, school, [session(TEACHER, 0, 480)], BELLS);
  const world = { world: id, date: addDays(partFrom(here.date), 1) };
  await render(world, joined);
  await press('week-sign-go');
  await ReactTestRenderer.act(() => tree?.unmount());
  await sendParts(here, school, [{ ...session(TEACHER, 0, 480), subject: 'Mathématiques' }], BELLS);
  const { parts } = await readSignChannel(world, joined, kit, server.send);
  expect(weeksToSign(parts, world.date, DAYS, SUBJECTS).map((one) => one.subject)).toEqual(['Mathématiques']);
  await render(world, joined);
  expect([has('week-sign-signed'), has('week-sign-go'), texts().includes(words.allSigned)]).toEqual([
    true,
    false,
    true,
  ]);
});

test('two subjects of a class are two weeks, a session of week A or B listed with its week', async () => {
  const { id, here, joined } = await setting();
  const sessions = [session(TEACHER, 0, 480), arabic(1, 480, 'A'), arabic(1, 540, 'B')];
  await sendParts(here, school, sessions, BELLS);
  await render({ world: id, date: addDays(partFrom(here.date), 2) }, joined);
  const labels = [`1م2 · رياضيات`, `1م2 · اللغة العربية`];
  expect(texts()).toContain(words.waiting.replace('{{classes}}', labels.map(isolate).join(words.listJoin)));
  expect(rows()).toBe(1);
  const chips = tree!.root.findAll((node) => /^week-sign-class-.*\ncode\narabic$/u.test(String(node.props.testID)));
  await act(() => (chips[0].props as PressableProps).onPress?.({} as never));
  expect(rows()).toBe(2);
  expect(texts().some((one) => one.includes(ar.ttImport.weekA))).toBe(true);
  expect(texts().some((one) => one.includes(ar.ttImport.weekB))).toBe(true);
  await press('week-sign-go');
  expect(texts()).toContain(words.waiting.replace('{{classes}}', isolate(labels[0])));
  await ReactTestRenderer.act(() => tree?.unmount());
  const course = `${timetableNameKey('1م2')}\ncode\narabic`;
  await render({ world: id, date: addDays(partFrom(here.date), 2) }, joined, server.send, course);
  expect([rows(), has('week-sign-signed')]).toEqual([2, true]);
  await ReactTestRenderer.act(() => tree?.unmount());
  await render({ world: id, date: addDays(partFrom(here.date), 2) }, joined, server.send, 'a course no longer taught');
  expect([rows(), has('week-sign-signed')]).toEqual([1, false]);
});

test('a one-day part gives its day alone, the standing part every other day', async () => {
  const { id, here, joined } = await setting();
  await sendParts(here, school, [session(TEACHER, 0, 480), session(TEACHER, 1, 480), session(TEACHER, 2, 480)], BELLS);
  const monday = addDays(partFrom(here.date), 1);
  await sendParts(here, school, [session(TEACHER, 1, 600)], BELLS, server.send, { from: monday, once: true });
  const world = { world: id, date: addDays(partFrom(here.date), 2) };
  const { parts } = await readSignChannel(world, joined, kit, server.send);
  const [week] = weeksToSign(parts, world.date, DAYS, SUBJECTS);
  expect(week?.sessions.map((one) => [one.day, one.start])).toEqual([
    [0, 480],
    [1, 600],
    [2, 480],
  ]);
});

test('a week signed already is said apart, and reading again shows it signed', async () => {
  const { id, here, joined } = await setting();
  await sendParts(here, school, [session(TEACHER, 0, 480)], BELLS);
  const world = { world: id, date: addDays(partFrom(here.date), 1) };
  await render(world, joined);
  const { parts } = await readSignChannel(world, joined, kit, server.send);
  const [week] = weeksToSign(parts, world.date, DAYS, SUBJECTS) as [WeekToSign];
  const record = await weekRecord(readJoinCode(joined.code)!.school, week, partFrom(here.date), new Map(), kit.mac);
  await signTheWeek(world, joined, record, kit, server.send);
  await press('week-sign-go');
  expect([texts().includes(words.already), has('week-sign-signed')]).toEqual([true, false]);
  await press('week-sign-again');
  expect([texts().includes(words.already), has('week-sign-signed')]).toEqual([false, true]);
  const other = { ...joined, device: 'made-up-other-device' };
  const taken = await signTheWeek(world, other, record, kit, server.send).catch(errorCode);
  expect(taken).toBe('E_JOIN_TAKEN');
});

test('a problem reading is shown, with a way to read again', async () => {
  const { id, here, joined } = await setting();
  await sendParts(here, school, [session(TEACHER, 0, 480)], BELLS);
  let down = true;
  const send: Send = (request) =>
    down ? Promise.resolve({ status: 503, body: null, retryAfter: null }) : server.send(request);
  await render({ world: id, date: addDays(partFrom(here.date), 1) }, joined, send);
  expect([texts().includes(ar.demo.problem.other), has('week-sign-go')]).toEqual([true, false]);
  down = false;
  await press('week-sign-again');
  expect([texts().includes(ar.demo.problem.other), has('week-sign-go')]).toEqual([false, true]);
});

test('confirmations are kept apart by join, school and course, for the last world only', () => {
  const week: WeekToSign = { class: '4م1', subject: 'رياضيات', code: 'math', sessions: [] };
  const one = { day: 0, start: 480, end: 540, group: '', week: 'both' } as const;
  const first = parseDay('2026-12-06');
  const of = (world: string, device = 'device-1', school = 'school-1', course = week) =>
    confirmations(world, device, school, course, first);
  of('K7QF4').set(one, 'held');
  expect([...of('K7QF4').states.values()]).toEqual(['held']);
  expect(of('K7QF4', 'device-2').states.size + of('K7QF4', 'device-1', 'school-2').states.size).toBe(0);
  expect(of('K7QF4', 'device-1', 'school-1', { ...week, subject: 'Maths' }).states.size).toBe(1);
  expect(of('K7QF4', 'device-1', 'school-1', { ...week, code: 'arabic' }).states.size).toBe(0);
  expect(of('Q2WZ8').states.size).toBe(0);
  of('Q2WZ8').set(one, 'not-held');
  expect([of('K7QF4').states.size, of('Q2WZ8').states.get('0\n480\n540\n\nboth')]).toEqual([0, 'not-held']);
  of('Q2WZ8').set(one, 'awaiting');
  expect(of('Q2WZ8').states.size).toBe(0);
  of('Q2WZ8').set(one, 'held');
  of('Q2WZ8').forget();
  expect(of('Q2WZ8').states.size).toBe(0);
});
