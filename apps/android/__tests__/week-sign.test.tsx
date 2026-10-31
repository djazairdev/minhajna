// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Week-sign in a demo world (#582, answer 610): the week starts on the school's
// first working day, Saturday or Sunday, and a subject's code comes from any of
// its names; the page names the week's class, subject and dates; the teacher
// confirms the week's sessions from the school's timetable one by one, each
// said with the next or that none is left, changes one back by a button named
// with its session, which is said, and signs in one step, which is said, shows
// the week signed, with its dates and nothing left to change, puts it on the
// channel with each session's state and the subject's code, and still shows it
// signed when the page opens again; while it signs nothing changes, and on
// Android what is confirmed and signed is announced, the reading after signing
// said nothing; a session not confirmed is signed awaiting; a subject the
// country does not know keeps the button waiting; without the school's
// timetable, or before a session this week, nothing is signed; and the words
// read in every language. Every school, class and teacher is made up.

import { addDays, parseDay, weekday, type Day, type SchoolJoined, type Subject, type Weekday } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { AccessibilityInfo, Platform, Text, View, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { BELLS, school, sendParts, server, session, setting } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { partFrom } from '../src/timetable/send-session';
import { isolate } from '../src/week/grid-labels';
import { WeekSign } from '../src/week/WeekSign';
import { readSignChannel, subjectCode, weekStart } from '../src/week/week-sign-session';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.weekSign;
const DAYS: readonly Weekday[] = [0, 1, 2, 3, 4];
const SUBJECTS: Subject[] = [
  { code: 'math', name: { ar: 'رياضيات', fr: 'Mathématiques', en: 'Maths' }, levels: ['cem'] },
  { code: 'arabic', name: { ar: 'اللغة العربية', fr: 'Arabe', en: 'Arabic' }, levels: ['cem'] },
];
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
const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const said = () => [(tree!.root.findByProps({ testID: 'week-sign-said' }).props as TextProps).children];

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
  subjects = SUBJECTS,
  send = server.send,
) {
  await ReactTestRenderer.act(() => {
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
          subjects={subjects}
        />
      </LocaleDirContext.Provider>,
    );
  });
  await act();
}

test('the week starts on the school’s first working day, and a subject’s code comes from any of its names', () => {
  const wednesday = parseDay('2026-12-09');
  expect([weekday(wednesday), weekStart(wednesday, DAYS)]).toEqual([3, parseDay('2026-12-06')]);
  expect(weekStart(parseDay('2026-12-06'), DAYS)).toBe(parseDay('2026-12-06'));
  expect(weekStart(wednesday, [6, 0, 1, 2, 3])).toBe(parseDay('2026-12-05'));
  expect(['رياضيات', 'mathématiques', ' Maths ', 'math', 'فيزياء'].map((one) => subjectCode(SUBJECTS, one))).toEqual([
    'math',
    'math',
    'math',
    'math',
    null,
  ]);
});

test('the teacher confirms the week session by session and signs it in one step', async () => {
  const { id, here, joined } = await setting();
  await sendParts(here, school, [session('بلعيد محمد', 0, 480), session('بلعيد محمد', 1, 600)], BELLS);
  const world = { world: id, date: addDays(partFrom(here.date), 2) };
  await render(world, joined);
  const dates = words.dates.replace('{{from}}', `day ${partFrom(here.date)}`).replace('{{to}}', `day ${world.date}`);
  expect(texts()).toEqual(
    expect.arrayContaining([
      [isolate('1م2'), isolate('رياضيات'), dates].join(' · '),
      words.once,
      words.waiting.replace('{{classes}}', isolate('1م2')),
      words.lines.before,
    ]),
  );
  expect(tree!.root.findAll((node) => node.props.testID === 'week-sign-row' && node.type === View)).toHaveLength(2);
  const [sunday, monday] = [`${ar.week.days[0]} · 08:00–09:00`, `${ar.week.days[1]} · 10:00–11:00`];
  const confirmed = (one: string, state: string) =>
    words.confirmed.replace('{{session}}', one).replace('{{state}}', state);
  await press('week-sign-not-held');
  expect(said()).toEqual([
    `${confirmed(sunday, words.spoken['not-held'])} ${words.next.replace('{{session}}', monday)}`,
  ]);
  await press('week-sign-held');
  expect(said()).toEqual([`${confirmed(monday, words.spoken.held)} ${words.noneLeft}`]);
  expect(has('week-sign-focus')).toBe(false);
  const undo = tree!.root.findAllByProps({ testID: 'week-sign-undo' })[0].props as { name?: string };
  expect(undo.name).toBe(words.undoOf.replace('{{session}}', sunday));
  await press('week-sign-undo');
  expect(said()).toEqual([confirmed(sunday, words.spoken.awaiting)]);
  expect(has('week-sign-focus')).toBe(true);
  await press('week-sign-not-held');
  await press('week-sign-go');
  expect(said()).toEqual([words.done.replace('{{class}}', isolate('1م2'))]);
  expect([has('week-sign-signed'), has('week-sign-go'), has('week-sign-undo')]).toEqual([true, false, false]);
  expect(texts()).toEqual(expect.arrayContaining([words.allSigned, dates]));
  const { weeks } = await readSignChannel(world, joined, kit, server.send);
  expect(weeks.map((one) => one.week.sessions.map((each) => each.state))).toEqual([['not-held', 'held']]);
  expect([weeks[0]?.week.totals.subject, weeks[0]?.week.week]).toEqual(['math', partFrom(here.date)]);
  await ReactTestRenderer.act(() => tree?.unmount());
  await render(world, joined);
  expect([has('week-sign-signed'), has('week-sign-go')]).toEqual([true, false]);
});

test('nothing changes while the week is signed, and on Android what is confirmed is announced', async () => {
  const { id, here, joined } = await setting();
  await sendParts(here, school, [session('بلعيد محمد', 0, 480)], BELLS);
  let release = () => undefined as void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const held: Send = (request) =>
    request.method === 'GET' ? server.send(request) : gate.then(() => server.send(request));
  jest.replaceProperty(Platform, 'OS', 'android');
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  await render({ world: id, date: addDays(partFrom(here.date), 1) }, joined, SUBJECTS, held);
  await press('week-sign-held');
  const sunday = `${ar.week.days[0]} · 08:00–09:00`;
  const confirmed = words.confirmed.replace('{{session}}', sunday).replace('{{state}}', words.spoken.held);
  expect(announce).toHaveBeenLastCalledWith(`${confirmed} ${words.noneLeft}`);
  await press('week-sign-go');
  expect([has('week-sign-undo'), has('week-sign-signed'), texts().includes(words.steps.signing)]).toEqual([
    false,
    false,
    true,
  ]);
  release();
  await act();
  expect(announce).toHaveBeenLastCalledWith(words.done.replace('{{class}}', isolate('1م2')));
  expect([has('week-sign-signed'), texts().includes(words.steps.reading)]).toEqual([true, false]);
});

test('a session not confirmed is signed awaiting, and an unknown subject keeps the week waiting', async () => {
  const { id, here, joined } = await setting();
  await sendParts(here, school, [session('بلعيد محمد', 0, 480)], BELLS);
  const world = { world: id, date: addDays(partFrom(here.date), 1) };
  await render(world, joined, []);
  expect(texts()).toContain(words.unknownSubject);
  expect((tree!.root.findByProps({ testID: 'week-sign-go' }).props as PressableProps).disabled).toBe(true);
  await ReactTestRenderer.act(() => tree?.unmount());
  await render(world, joined);
  await press('week-sign-go');
  const { weeks } = await readSignChannel(world, joined, kit, server.send);
  expect(weeks.map((one) => one.week.sessions.map((each) => each.state))).toEqual([['awaiting']]);
});

test('without the school’s timetable, or before a session this week, nothing is signed', async () => {
  const { id, here, joined } = await setting();
  await render({ world: id, date: here.date }, joined);
  expect(texts()).toContain(words.noTimetable);
  await ReactTestRenderer.act(() => tree?.unmount());
  await sendParts(here, school, [session('بلعيد محمد', 2, 480)], BELLS);
  await render({ world: id, date: addDays(partFrom(here.date), 1) }, joined);
  expect([texts().includes(words.noSessions), has('week-sign-go')]).toEqual([true, false]);
});

test('the signing words read in every language', () => {
  const flat = (value: object, at = ''): [string, string][] =>
    Object.entries(value).flatMap(([key, one]) =>
      typeof one === 'string' ? [[`${at}${key}`, one]] : flat(one as object, `${at}${key}.`),
    );
  const places = (text: string) => (text.match(/\{\{\w+\}\}/gu) ?? []).sort();
  const mine = flat(ar.demo.weekSign).map(([key, text]) => [key, places(text)]);
  for (const one of [en, fr]) expect(flat(one.demo.weekSign).map(([key, text]) => [key, places(text)])).toEqual(mine);
});
