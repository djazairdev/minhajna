// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The weekly digest in a demo world (#584, answer 612): of three sessions this
// week, two confirmed in a signed week whose correction set one not held for an
// entry error, it counts two of three, names the signed class, shows the other
// class's week as waiting with its line and a button that opens Week-sign on
// its course, the correction from awaiting to not held with its reason,
// numbered, and the next one numbered after it, and the lines on the plan pack
// and who it reaches; before the timetable it says so and shows no count, and
// with nothing signed it says none is and counts none confirmed, with no
// correction; a problem reading is shown with a way to read again, and
// announced on Android; a timetable changed after signing counts only the
// sessions it lists, by their slot, and a class's two subjects are named apart;
// Week-sign opened from the digest goes back to it; and the words read in every
// language. Every school, class and teacher is made up.

import { addDays, correctWeek, readJoinCode, type Day, type SchoolJoined, type Subject } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { AccessibilityInfo, Platform, Text, type PressableProps, type TextProps } from 'react-native';
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
import { WeekDigest } from '../src/week/WeekDigest';
import { useJoinView } from '../src/school/join-view';
import { courseKey, readSignChannel, signTheWeek, weekRecord, weeksToSign } from '../src/week/week-sign-session';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.digest;
const DAYS = [0, 1, 2, 3, 4] as const;
const SUBJECTS: Subject[] = [
  { code: 'math', name: { ar: 'رياضيات', fr: 'Mathématiques', en: 'Maths' }, levels: ['cem'] },
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
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;

async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
const press = (testID: string) =>
  act(() => (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never));

async function render(world: { world: string; date: Day }, join: SchoolJoined, onSign = jest.fn(), send?: Send) {
  await act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <WeekDigest
          world={world}
          join={join}
          kit={kit}
          send={send ?? server.send}
          dayText={(day) => `day ${day}`}
          onClose={() => undefined}
          said={words.title}
          workingDays={DAYS}
          subjects={SUBJECTS}
          onSign={onSign}
        />
      </LocaleDirContext.Provider>,
    );
  });
  return onSign;
}

test('the week’s digest counts what is confirmed, names what is signed, and opens what waits', async () => {
  const { id, here, joined } = await setting();
  const sessions = [session(TEACHER, 0, 480), session(TEACHER, 1, 480), session(TEACHER, 0, 540, '1م3')];
  await sendParts(here, school, sessions, BELLS);
  const world = { world: id, date: addDays(partFrom(here.date), 2) };
  const { parts } = await readSignChannel(world, joined, kit, server.send);
  const weeks = weeksToSign(parts, world.date, DAYS, SUBJECTS);
  const first = weeks.find((one) => one.class === '1م2')!;
  const states = new Map([['0\n480\n540\n\nboth', 'held' as const]]);
  const signed = await weekRecord(readJoinCode(joined.code)!.school, first, partFrom(here.date), states, kit.mac);
  await signTheWeek(world, joined, signed, kit, server.send);
  const fixed = correctWeek(signed, signed.sessions[1], 'not-held', 'entry-error');
  await signTheWeek(world, joined, fixed, kit, server.send);
  await signTheWeek(world, joined, correctWeek(fixed, fixed.sessions[1], 'held'), kit, server.send);
  const onSign = await render(world, joined);
  const monday = `${ar.week.days[1]} · 08:00–09:00`;
  const fixLine = (number: string, before: string, after: string) =>
    words.fixLine
      .replace('{{number}}', number)
      .replace('{{course}}', isolate('1م2'))
      .replace('{{session}}', monday)
      .replace('{{before}}', before)
      .replace('{{after}}', after);
  const { states: named } = ar.demo.weekFix;
  const line = fixLine('1', named.awaiting, named['not-held']);
  const dates = ar.demo.weekSign.dates
    .replace('{{from}}', `day ${partFrom(here.date)}`)
    .replace('{{to}}', `day ${world.date}`);
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.subtitle.replace('{{dates}}', dates),
      words.confirmed.replace('{{confirmed}}', '2').replace('{{total}}', '3'),
      ar.demo.digest.unsigned,
      words.signed.replace('{{classes}}', isolate('1م2')),
      words.unsigned,
      words.unsignedLine,
      ar.demo.weekFix.because.replace('{{change}}', line).replace('{{reason}}', ar.demo.weekFix.reasons['entry-error']),
      fixLine('2', named['not-held'], named.held),
      words.plan,
      words.foot,
    ]),
  );
  expect(tree!.root.findAllByProps({ testID: 'digest-sign' }).length).toBeGreaterThan(0);
  await press('digest-sign');
  expect(onSign).toHaveBeenCalledWith(courseKey(weeks.find((one) => one.class === '1م3')!));
});

test('before the timetable comes, or with nothing signed, the digest says so', async () => {
  const { id, here, joined } = await setting();
  await render({ world: id, date: here.date }, joined);
  expect([texts().includes(ar.demo.weekSign.noTimetable), has('digest-head')]).toEqual([true, false]);
  await ReactTestRenderer.act(() => tree?.unmount());
  await sendParts(here, school, [session(TEACHER, 0, 480)], BELLS);
  await render({ world: id, date: addDays(partFrom(here.date), 1) }, joined);
  expect(texts()).toEqual(
    expect.arrayContaining([words.noneSigned, words.confirmed.replace('{{confirmed}}', '0').replace('{{total}}', '1')]),
  );
  expect(has('digest-fixes')).toBe(false);
});

test('a problem reading is shown, with a way to read again', async () => {
  const { id, here, joined } = await setting();
  await sendParts(here, school, [session(TEACHER, 0, 480)], BELLS);
  let down = true;
  const send: Send = (request) =>
    down ? Promise.resolve({ status: 503, body: null, retryAfter: null }) : server.send(request);
  await render({ world: id, date: addDays(partFrom(here.date), 1) }, joined, jest.fn(), send);
  expect([texts().includes(ar.demo.problem.other), has('digest-head')]).toEqual([true, false]);
  down = false;
  await press('digest-again');
  expect([texts().includes(ar.demo.problem.other), has('digest-head')]).toEqual([false, true]);
});

test('a timetable changed after signing counts only what it lists, and a class’s two subjects are apart', async () => {
  const { id, here, joined } = await setting();
  await sendParts(here, school, [session(TEACHER, 0, 480), session(TEACHER, 1, 480)], BELLS);
  const world = { world: id, date: addDays(partFrom(here.date), 2) };
  const { parts } = await readSignChannel(world, joined, kit, server.send);
  const [week] = weeksToSign(parts, world.date, DAYS, SUBJECTS);
  const held = new Map([
    ['0\n480\n540\n\nboth', 'held' as const],
    ['1\n480\n540\n\nboth', 'held' as const],
  ]);
  const schoolId = readJoinCode(joined.code)!.school;
  await signTheWeek(
    world,
    joined,
    await weekRecord(schoolId, week, partFrom(here.date), held, kit.mac),
    kit,
    server.send,
  );
  const arabic = { ...session(TEACHER, 1, 540), subject: 'اللغة العربية' };
  await sendParts(here, school, [session(TEACHER, 0, 480), arabic], BELLS);
  await render(world, joined);
  const subjects = [isolate('1م2 · رياضيات'), isolate('1م2 · اللغة العربية')];
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.confirmed.replace('{{confirmed}}', '1').replace('{{total}}', '2'),
      words.signed.replace('{{classes}}', subjects[0]),
      subjects[1],
    ]),
  );
});

test('on Android a problem reading is announced', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  const { id, here, joined } = await setting();
  const down: Send = () => Promise.resolve({ status: 503, body: null, retryAfter: null });
  await render({ world: id, date: here.date }, joined, jest.fn(), down);
  expect(announce).toHaveBeenLastCalledWith(ar.demo.problem.other);
});

test('Week-sign opened from the digest goes back to the digest, any other page to School-join', async () => {
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
  await act(() => view!.setView({ page: 'week', join: joined, course: 'x', back: 'digest' }));
  await act(() => view!.leave());
  expect(view!.page).toBe('digest');
  await act(() => view!.leave());
  expect(view!.page).toBe('join');
});

test('the digest’s words read in every language', () => {
  const places = (text: string) => (text.match(/\{\{\w+\}\}/gu) ?? []).sort();
  const mine = Object.entries(ar.demo.digest).map(([key, text]) => [key, places(text)]);
  for (const one of [en, fr]) {
    expect(Object.entries(one.demo.digest).map(([key, text]) => [key, places(text)])).toEqual(mine);
  }
});
