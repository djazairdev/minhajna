// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's classes in the school's space (#584, answer 612), in term 2 of
// the bundled calendar: of a class's six sessions over two signed weeks, three
// held, one awaiting, one not held on Yennayer and one not held otherwise, it
// counts three, one, one for the calendar and one other, under the term's dates
// so far, the last signed week's dates, the plan line and the foot, with the
// hours line and each course's weekly sessions; another class with no signed
// week is named as waiting; its button opens Week-sign. In the winter holidays,
// or without the school's calendar, it lists and counts nothing and says why.
// Courses come in the school's order of classes, a signed one after an unsigned
// one, with their weekly sessions from the standing timetable when a part for
// one day applies. A problem reading is shown with a way to read again, and
// announced on Android; Week-sign opened from it goes back to it; and the words
// read in every language. Every school, class and teacher is made up.

import { parseDay, readJoinCode, type Day, type SchoolJoined, type Subject } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { AccessibilityInfo, Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { BELLS, school, sendParts, server, session, setting } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { useJoinView } from '../src/school/join-view';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { isolate } from '../src/week/grid-labels';
import { SchoolMine } from '../src/week/SchoolMine';
import type { MineCalendar } from '../src/week/school-mine-session';
import { readSignChannel, signTheWeek, weekRecord, weeksToSign, weekStart } from '../src/week/week-sign-session';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.mine;
const DAYS = [0, 1, 2, 3, 4] as const;
const SUBJECTS: Subject[] = [
  { code: 'math', name: { ar: 'رياضيات', fr: 'Mathématiques', en: 'Maths' }, levels: ['cem'] },
];
const TEACHER = 'بلعيد محمد';
const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const MINE: MineCalendar = { profile: read.profile, calendar: read.calendar };
const [FIRST, SECOND] = [parseDay('2027-01-05'), parseDay('2027-01-12')];
const weekly = (count: number) => words.weekly.replace('{{count}}', String(count)).split('{{hours}}')[0];
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

async function render(world: { world: string; date: Day }, join: SchoolJoined, mine?: MineCalendar, send?: Send) {
  const onSign = jest.fn();
  await act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <SchoolMine
          world={world}
          join={join}
          kit={kit}
          send={send ?? server.send}
          dayText={(day) => `day ${day}`}
          onClose={() => undefined}
          said={words.title}
          workingDays={DAYS}
          subjects={SUBJECTS}
          mine={mine}
          onSign={onSign}
        />
      </LocaleDirContext.Provider>,
    );
  });
  return onSign;
}

/** Signs the world's week of a class with each session's state by its weekday, the rest awaiting. */
async function sign(
  world: { world: string; date: Day },
  joined: SchoolJoined,
  states: Record<number, 'held' | 'not-held'>,
  of = '1م2',
  start = 480,
) {
  const { parts } = await readSignChannel(world, joined, kit, server.send);
  const week = weeksToSign(parts, world.date, DAYS, SUBJECTS).find((one) => one.class === of)!;
  const slots = new Map(
    Object.entries(states).map(([day, state]) => [`${day}\n${start}\n${start + 60}\n\nboth`, state]),
  );
  const first = weekStart(world.date, DAYS);
  await signTheWeek(
    world,
    joined,
    await weekRecord(readJoinCode(joined.code)!.school, week, first, slots, kit.mac),
    kit,
    server.send,
  );
}

test('the term so far counts each course by state, a holiday as the calendar’s, and what waits', async () => {
  const { id, here, joined } = await setting();
  const sessions = [0, 1, 2].map((day) => session(TEACHER, day as 0 | 1 | 2, 480));
  await sendParts(here, school, [...sessions, session(TEACHER, 0, 540, '1م3')], BELLS);
  await sign({ world: id, date: FIRST }, joined, { 0: 'held', 1: 'not-held' });
  await sign({ world: id, date: SECOND }, joined, { 0: 'held', 1: 'held', 2: 'not-held' });
  const onSign = await render({ world: id, date: SECOND }, joined, MINE);
  const count = (key: keyof typeof words.counts, value: number) =>
    words.counts[key].replace('{{count}}', String(value));
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.subtitle.replace('{{date}}', `day ${SECOND}`),
      words.term.replace('{{number}}', '2').replace('{{from}}', 'day 2027-01-03').replace('{{to}}', `day ${SECOND}`),
      isolate('1م2') + ' · ' + isolate('رياضيات'),
      count('held', 3),
      count('awaiting', 1),
      count('calendar', 1),
      count('other', 1),
      words.lastWeek.replace('{{from}}', 'day 2027-01-10').replace('{{to}}', `day ${SECOND}`),
      words.plan,
      isolate('1م3') + ' · ' + isolate('رياضيات'),
      words.noWeek,
      words.foot,
    ]),
  );
  expect([has('mine-course'), has('mine-unsigned')]).toEqual([1, 1]);
  expect(texts().some((one) => one.startsWith(words.hours.replace('{{hours}}', '')))).toBe(true);
  expect(texts().filter((one) => one.startsWith(weekly(3)) || one.startsWith(weekly(1)))).toHaveLength(2);
  await press('mine-sign');
  expect(onSign).toHaveBeenCalled();
});

test('between terms, or without the school’s calendar, nothing is counted', async () => {
  const { id, here, joined } = await setting();
  await sendParts(here, school, [session(TEACHER, 0, 480)], BELLS);
  await sign({ world: id, date: FIRST }, joined, { 0: 'held' });
  await render({ world: id, date: parseDay('2026-12-24') }, joined, MINE);
  expect([texts().includes(words.noTerm), has('mine-course'), has('mine-unsigned')]).toEqual([true, 0, 0]);
  await ReactTestRenderer.act(() => tree?.unmount());
  await render({ world: id, date: FIRST }, joined);
  expect([texts().includes(words.noTerm), has('mine-course'), has('mine-unsigned')]).toEqual([true, 0, 0]);
});

test('each course comes in the school’s order, its week’s sessions from the standing timetable', async () => {
  const { id, here, joined } = await setting();
  const standing = [session(TEACHER, 0, 480), session(TEACHER, 1, 480), session(TEACHER, 0, 540, '1م3')];
  await sendParts(here, school, standing, BELLS);
  await sign({ world: id, date: FIRST }, joined, { 0: 'held' }, '1م3', 540);
  await sendParts(here, school, [session(TEACHER, 2, 480)], BELLS, server.send, { from: SECOND, once: true });
  const { parts } = await readSignChannel({ world: id, date: SECOND }, joined, kit, server.send);
  expect(parts.filter((one) => one.part.once && one.part.from === SECOND)).toHaveLength(1);
  await render({ world: id, date: SECOND }, joined, MINE);
  const heads = tree!.root
    .findAll((node) => node.props.accessibilityRole === 'header' && typeof node.type === 'string')
    .map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
  const named = (of: string) => isolate(of) + ' · ' + isolate('رياضيات');
  expect(heads.filter((one) => one.includes('رياضيات'))).toEqual([named('1م2'), named('1م3')]);
  expect([has('mine-unsigned'), has('mine-course')]).toEqual([1, 1]);
  expect([texts().some((one) => one.startsWith(weekly(2))), texts().some((one) => one.startsWith(weekly(1)))]).toEqual([
    true,
    true,
  ]);
});

test('a problem reading is shown, with a way to read again, and announced on Android', async () => {
  const { id, here, joined } = await setting();
  await sendParts(here, school, [session(TEACHER, 0, 480)], BELLS);
  let down = true;
  const send: Send = (request) =>
    down ? Promise.resolve({ status: 503, body: null, retryAfter: null }) : server.send(request);
  await render({ world: id, date: FIRST }, joined, MINE, send);
  expect([texts().includes(ar.demo.problem.other), has('mine-unsigned')]).toEqual([true, 0]);
  down = false;
  await press('mine-again');
  expect([texts().includes(ar.demo.problem.other), has('mine-unsigned')]).toEqual([false, 1]);
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.replaceProperty(Platform, 'OS', 'android');
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  down = true;
  await render({ world: id, date: FIRST }, joined, MINE, send);
  expect(announce).toHaveBeenLastCalledWith(ar.demo.problem.other);
});

test('Week-sign opened from the teacher’s classes goes back to them', async () => {
  const { joined } = await setting();
  let view: ReturnType<typeof useJoinView> | undefined;
  function Probe() {
    view = useJoinView(
      () => undefined,
      () => undefined,
    );
    return null;
  }
  await act(() => {
    tree = ReactTestRenderer.create(<Probe />);
  });
  await act(() => view!.setView({ page: 'week', join: joined, back: 'mine' }));
  await act(() => view!.leave());
  expect(view!.page).toBe('mine');
});

test('the words of the teacher’s classes read in every language', () => {
  const places = (value: unknown): unknown =>
    typeof value === 'string'
      ? (value.match(/\{\{\w+\}\}/gu) ?? []).sort()
      : Object.entries(value as object).map(([key, one]) => [key, places(one)]);
  for (const one of [en, fr]) expect(places(one.demo.mine)).toEqual(places(ar.demo.mine));
});
