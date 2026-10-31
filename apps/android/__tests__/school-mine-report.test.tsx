// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The term report (#584, answer 612), on the made-up term of term-weeks.ts: for
// the class with two signed weeks it counts five confirmed sessions, never the
// six signed, three held, one not held for the calendar and one for another
// cause, and lists in day order Monday's lost session as other and Tuesday's as
// the calendar's with Yennayer's name, with the make-up and foot lines and
// never the count awaiting confirmation. Courses come in the school's order, a
// group's lost session names its group, and an exam window takes a session as
// the calendar's, by its name. With no week signed it says the report is empty,
// in the winter holidays that no term holds the date, and without a calendar
// that the school has none. A problem reading is shown with a way to read
// again, and announced on Android; the report goes back to the teacher's
// classes, and they to School-join; and the words read in every language. Every
// school, class and teacher is made up.

import { parseDay, type CalendarEntry, type Day, type SchoolJoined } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { AccessibilityInfo, Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FIRST, MINE, SECOND, sign, signedTerm, TEACHER } from '../jest/term-weeks';
import { BELLS, school, sendParts, server, session, setting } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { useJoinView } from '../src/school/join-view';
import { localized } from '../src/setup/names';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { isolate } from '../src/week/grid-labels';
import type { MineCalendar } from '../src/week/school-mine-session';
import { SchoolMineReport } from '../src/week/SchoolMineReport';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.report;
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
  await act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <SchoolMineReport
          world={world}
          join={join}
          kit={kit}
          send={send ?? server.send}
          dayText={(day) => `day ${day}`}
          onClose={() => undefined}
          said={words.title}
          mine={mine}
        />
      </LocaleDirContext.Provider>,
    );
  });
}

test('each course’s report counts its sessions and lists those not held, the calendar’s with its entry', async () => {
  const { id, joined } = await signedTerm();
  await render({ world: id, date: SECOND }, joined, MINE);
  const yennayer = MINE.calendar.entries.find((one) => one.id === 'yennayer')!;
  const { counts } = ar.demo.mine;
  const count = (text: string, value: number) => text.replace('{{count}}', String(value));
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.subtitle.replace('{{date}}', `day ${SECOND}`),
      isolate('1م2') + ' · ' + isolate('رياضيات'),
      count(words.confirmed, 5),
      count(counts.held, 3),
      count(counts.calendar, 1),
      count(counts.other, 1),
      words.lostList,
      words.makeUps,
      words.foot,
    ]),
  );
  expect(texts().some((one) => one.startsWith(counts.awaiting.replace('{{count}}', '')))).toBe(false);
  const lost = [
    words.lostOther.replace('{{session}}', 'day 2027-01-04 · 08:00–09:00'),
    words.lostCalendar
      .replace('{{session}}', `day ${SECOND} · 08:00–09:00`)
      .replace('{{entry}}', localized(yennayer.name)),
  ];
  expect(texts().filter((one) => lost.includes(one))).toEqual(lost);
  expect([has('report-course'), has('report-lost')]).toEqual([1, 1]);
  expect(texts().some((one) => one.startsWith(count(words.confirmed, 6)))).toBe(false);
});

test('courses come in the school’s order, a lost session names its group, and an exam is the calendar’s', async () => {
  const { id, here, joined } = await setting();
  const grouped = { ...session(TEACHER, 1, 540, '1م1'), group: 'ف1' };
  await sendParts(here, school, [session(TEACHER, 0, 480, '1م3'), grouped], BELLS);
  await sign({ world: id, date: FIRST }, joined, { 0: 'not-held' }, '1م3');
  await sign({ world: id, date: FIRST }, joined, { 1: 'not-held' }, '1م1', 540, 'ف1');
  const exam: CalendarEntry = {
    id: 'made-up-exam',
    layer: 'national',
    from: parseDay('2027-01-03'),
    to: parseDay('2027-01-03'),
    effect: 'exam',
    name: { ar: 'امتحان مختلق', en: 'Made-up exam', fr: 'Examen inventé' },
    source: 'Made-up calendar',
    confidence: 'announced',
  };
  await render({ world: id, date: FIRST }, joined, { ...MINE, calendar: { ...MINE.calendar, entries: [exam] } });
  const heads = tree!.root
    .findAll((node) => node.props.accessibilityRole === 'header' && typeof node.type === 'string')
    .map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
  const named = (of: string) => isolate(of) + ' · ' + isolate('رياضيات');
  expect(heads.filter((one) => one.includes('رياضيات'))).toEqual([named('1م1'), named('1م3')]);
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.lostOther.replace('{{session}}', `day 2027-01-04 · 09:00–10:00 · ${isolate('ف1')}`),
      words.lostCalendar
        .replace('{{session}}', 'day 2027-01-03 · 08:00–09:00')
        .replace('{{entry}}', localized(exam.name)),
    ]),
  );
});

test('with no week signed the report is empty; between terms, or without a calendar, nothing is counted', async () => {
  const { id, here, joined } = await setting();
  await sendParts(here, school, [session(TEACHER, 0, 480)], BELLS);
  await render({ world: id, date: FIRST }, joined, MINE);
  expect([texts().includes(words.noCourse), has('report-course')]).toEqual([true, 0]);
  await ReactTestRenderer.act(() => tree?.unmount());
  await sign({ world: id, date: FIRST }, joined, { 0: 'held' });
  await render({ world: id, date: parseDay('2026-12-24') }, joined, MINE);
  const shown = texts();
  expect([shown.includes(ar.demo.mine.noTerm), shown.includes(words.noCourse), has('report-course')]).toEqual([
    true,
    false,
    0,
  ]);
  await ReactTestRenderer.act(() => tree?.unmount());
  await render({ world: id, date: FIRST }, joined);
  expect([texts().includes(ar.demo.mine.noCalendar), has('report-course')]).toEqual([true, 0]);
});

test('a problem reading is shown, with a way to read again, and announced on Android', async () => {
  const { id, joined } = await signedTerm();
  let down = true;
  const send: Send = (request) =>
    down ? Promise.resolve({ status: 503, body: null, retryAfter: null }) : server.send(request);
  await render({ world: id, date: SECOND }, joined, MINE, send);
  expect([texts().includes(ar.demo.problem.other), has('report-course')]).toEqual([true, 0]);
  down = false;
  await press('report-again');
  expect([texts().includes(ar.demo.problem.other), has('report-course')]).toEqual([false, 1]);
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.replaceProperty(Platform, 'OS', 'android');
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  down = true;
  await render({ world: id, date: SECOND }, joined, MINE, send);
  expect(announce).toHaveBeenLastCalledWith(ar.demo.problem.other);
});

test('the report goes back to the teacher’s classes, and they to School-join', async () => {
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
  await act(() => view!.setView({ page: 'report', join: joined, back: 'mine' }));
  await act(() => view!.leave());
  expect(view!.page).toBe('mine');
  await act(() => view!.leave());
  expect(view!.page).toBe('join');
});

test('the report’s words read in every language', () => {
  const places = (value: unknown): unknown =>
    typeof value === 'string'
      ? (value.match(/\{\{\w+\}\}/gu) ?? []).sort()
      : Object.entries(value as object).map(([key, one]) => [key, places(one)]);
  for (const one of [en, fr]) expect(places(one.demo.report)).toEqual(places(ar.demo.report));
});
