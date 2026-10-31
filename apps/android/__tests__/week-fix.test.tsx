// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Week-fix in a demo world (#583, answer 611): a signed week opens its
// correction under the band, its title said; the entry recorded awaiting
// becomes held, a reason pressed twice is none and another is chosen, and the
// correction being made shows as signed now with its reason; signing it returns
// to Week-sign, which says so and shows the corrected state, and the channel
// holds version 1 with its reason and the signed version below it; opened
// again, the page shows the signed version and correction 1, and a second
// correction without a reason is version 2; going back, by the button or
// Android's back, signs nothing; a correction put meanwhile at that version is
// said as the week having changed, with a way back, and nothing more is put; a
// correction that dropped a session shows it as no longer in the week, and
// choosing another entry starts its change again; on Android, opening and
// leaving are announced, and a problem other than a change keeps the choices so
// the signature can be tried again; a second press or going back while signing
// does nothing, and Week-sign shows the correction at once, its correcting held
// until it has read the channel again; and the words read in every language.
// Every school, class and teacher is made up.

import { addDays, correctWeek, readJoinCode, type Day, type SchoolJoined, type Subject } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { AccessibilityInfo, BackHandler, Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { BELLS, school, sendParts, server, session, setting } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { partFrom } from '../src/timetable/send-session';
import { WeekSign } from '../src/week/WeekSign';
import { readSignChannel, signTheWeek, weekRecord, weeksToSign, type WeekToSign } from '../src/week/week-sign-session';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.weekFix;
const DAYS = [0, 1, 2, 3, 4] as const;
const SUBJECTS: Subject[] = [
  { code: 'math', name: { ar: 'رياضيات', fr: 'Mathématiques', en: 'Maths' }, levels: ['cem'] },
];
const TEACHER = 'بلعيد محمد';
const SUNDAY = `${ar.week.days[0]} · 08:00–09:00`;
const MONDAY = `${ar.week.days[1]} · 08:00–09:00`;
const held: { GET?: Promise<void>; POST?: Promise<void> } = {};
/** The demo server, each request of a method held while that method's promise is set. */
const gated: Send = (request) => {
  const gate = request.method === 'PUT' ? undefined : held[request.method];
  return gate === undefined ? server.send(request) : gate.then(() => server.send(request));
};
const handlers = new Set<Parameters<typeof BackHandler.addEventListener>[1]>();
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.add(handler);
    return { remove: () => void handlers.delete(handler) };
  });
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  delete held.GET;
  delete held.POST;
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const live = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string')[0]?.props
    .children as unknown;

async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
const press = (testID: string) =>
  act(() => (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never));
const androidBack = () =>
  act(() => [...handlers].reverse().some((handler) => handler({ type: 'hardwareBackPress', timeStamp: 0 }) === true));
const change = (state: string, slot = SUNDAY) => words.change.replace('{{session}}', slot).replace('{{state}}', state);
const disabled = (testID: string) => (tree!.root.findByProps({ testID }).props as PressableProps).disabled;

/** A week of one Sunday session, signed awaiting, and Week-sign open on it. */
async function signed(send: Send = server.send) {
  const { id, here, joined } = await setting();
  await sendParts(here, school, [session(TEACHER, 0, 480), session(TEACHER, 1, 480)], BELLS);
  const world = { world: id, date: addDays(partFrom(here.date), 2) };
  const { parts } = await readSignChannel(world, joined, kit, server.send);
  const [week] = weeksToSign(parts, world.date, DAYS, SUBJECTS) as [WeekToSign];
  const record = await weekRecord(readJoinCode(joined.code)!.school, week, partFrom(here.date), new Map(), kit.mac);
  await signTheWeek(world, joined, record, kit, server.send);
  await render(world, joined, send);
  return { world, joined, record };
}

async function render(world: { world: string; date: Day }, join: SchoolJoined, send: Send = server.send) {
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
          said={ar.demo.weekSign.title}
          workingDays={DAYS}
          subjects={SUBJECTS}
        />
      </LocaleDirContext.Provider>,
    );
  });
}

test('a signed week is corrected one session at a time, both versions kept and shown', async () => {
  const { world, joined } = await signed();
  await press('week-sign-fix');
  expect([has('week-fix'), has('demo-band'), live('week-fix-said')]).toEqual([true, true, words.title]);
  expect(texts()).toEqual(
    expect.arrayContaining([words.lead, words.recorded.replace('{{state}}', words.states.awaiting), words.original]),
  );
  expect((tree!.root.findByProps({ testID: 'week-fix-go' }).props as PressableProps).disabled).toBe(true);
  await press('week-fix-state-held');
  await press('week-fix-reason-entry-error');
  await press('week-fix-reason-entry-error');
  await press('week-fix-reason-confirmed-later');
  const reason = ar.demo.weekFix.reasons['confirmed-later'];
  const fixed = words.because.replace('{{change}}', change(words.states.held)).replace('{{reason}}', reason);
  expect(texts()).toEqual(expect.arrayContaining([words.now.replace('{{number}}', '1'), fixed]));
  await press('week-fix-go');
  expect([has('week-fix'), has('week-sign'), live('week-sign-said')]).toEqual([
    false,
    true,
    words.done.replace('{{number}}', '1'),
  ]);
  expect(texts()).toContain(`${SUNDAY} · ${ar.demo.weekSign.states.held}`);
  const { weeks } = await readSignChannel(world, joined, kit, server.send);
  expect(
    weeks.map((one) => [one.week.version, one.week.reason, one.week.sessions[0]?.state, one.earlier.length]),
  ).toEqual([[1, 'confirmed-later', 'held', 1]]);
  await press('week-sign-fix');
  expect(texts()).toEqual(
    expect.arrayContaining([words.fix.replace('{{number}}', '1'), fixed, change(words.states.awaiting)]),
  );
  await press('week-fix-state-not-held');
  await press('week-fix-go');
  const again = await readSignChannel(world, joined, kit, server.send);
  expect(again.weeks.map((one) => [one.week.version, Object.hasOwn(one.week, 'reason'), one.earlier.length])).toEqual([
    [2, false, 2],
  ]);
});

test('a week corrected meanwhile is said as changed, and going back signs nothing', async () => {
  const { world, joined, record } = await signed();
  await press('week-sign-fix');
  await press('week-fix-back');
  expect([has('week-fix'), has('week-sign')]).toEqual([false, true]);
  await press('week-sign-fix');
  await androidBack();
  expect([has('week-fix'), has('week-sign')]).toEqual([false, true]);
  await press('week-sign-fix');
  await signTheWeek(world, joined, correctWeek(record, record.sessions[1], 'held'), kit, server.send);
  await press('week-fix-state-not-held');
  await press('week-fix-go');
  expect([texts().includes(words.changed), has('week-fix-again')]).toEqual([true, true]);
  await press('week-fix-again');
  expect(has('week-sign')).toBe(true);
  const { weeks } = await readSignChannel(world, joined, kit, server.send);
  expect(weeks.map((one) => one.week.sessions.map((each) => each.state))).toEqual([['awaiting', 'held']]);
});

test('the correction’s words read in every language', () => {
  const flat = (value: object, at = ''): [string, string][] =>
    Object.entries(value).flatMap(([key, one]) =>
      typeof one === 'string' ? [[`${at}${key}`, one]] : flat(one as object, `${at}${key}.`),
    );
  const places = (text: string) => (text.match(/\{\{\w+\}\}/gu) ?? []).sort();
  const mine = flat(ar.demo.weekFix).map(([key, text]) => [key, places(text)]);
  for (const one of [en, fr]) expect(flat(one.demo.weekFix).map(([key, text]) => [key, places(text)])).toEqual(mine);
});

test('another entry starts its change again, and a dropped session shows as no longer in the week', async () => {
  const { world, joined, record } = await signed();
  await signTheWeek(world, joined, { ...record, version: 1, sessions: [record.sessions[0]] }, kit, server.send);
  await ReactTestRenderer.act(() => tree?.unmount());
  await render(world, joined);
  await press('week-sign-fix');
  expect(texts()).toEqual(
    expect.arrayContaining([words.fix.replace('{{number}}', '1'), change(words.states.none, MONDAY)]),
  );
  await ReactTestRenderer.act(() => tree?.unmount());
  await signTheWeek(world, joined, { ...record, version: 2 }, kit, server.send);
  await render(world, joined);
  await press('week-sign-fix');
  await press('week-fix-state-held');
  expect(disabled('week-fix-go')).toBe(false);
  await press('week-fix-session-1');
  expect([
    disabled('week-fix-go'),
    texts().includes(words.recorded.replace('{{state}}', words.states.awaiting)),
  ]).toEqual([true, true]);
  expect(texts()).toContain(change(words.states.awaiting, MONDAY));
});

test('opening and leaving are announced on Android, and a problem keeps the choices to sign again', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  const { world, joined } = await signed(gated);
  await press('week-sign-fix');
  expect(announce).toHaveBeenLastCalledWith(words.title);
  await press('week-fix-back');
  expect(announce).toHaveBeenLastCalledWith(ar.demo.weekSign.title);
  await press('week-sign-fix');
  await press('week-fix-state-not-held');
  held.POST = Promise.reject(new Error('offline'));
  held.POST.catch(() => undefined);
  await press('week-fix-go');
  expect([texts().includes(ar.demo.problem.other), has('week-fix-again'), disabled('week-fix-go')]).toEqual([
    true,
    false,
    false,
  ]);
  expect(announce).toHaveBeenLastCalledWith(ar.demo.problem.other);
  delete held.POST;
  await press('week-fix-go');
  expect(announce).toHaveBeenLastCalledWith(words.done.replace('{{number}}', '1'));
  const { weeks } = await readSignChannel(world, joined, kit, server.send);
  expect(weeks.map((one) => one.week.version)).toEqual([1]);
});

test('a second press or going back while signing does nothing, and Week-sign waits for its reading', async () => {
  let release = () => undefined as void;
  const { world, joined } = await signed(gated);
  held.POST = new Promise<void>((resolve) => (release = resolve));
  await press('week-sign-fix');
  await press('week-fix-state-held');
  await press('week-fix-go');
  await press('week-fix-go');
  await press('week-fix-back');
  await androidBack();
  expect([has('week-fix'), texts().includes(words.signing)]).toEqual([true, true]);
  const first = release;
  held.GET = new Promise<void>((resolve) => (release = resolve));
  first();
  await act(() => undefined);
  expect([has('week-sign'), texts().includes(`${SUNDAY} · ${ar.demo.weekSign.states.held}`)]).toEqual([true, true]);
  expect(disabled('week-sign-fix')).toBe(true);
  release();
  await act(() => undefined);
  expect(disabled('week-sign-fix')).toBe(false);
  const { weeks } = await readSignChannel(world, joined, kit, server.send);
  expect(weeks.map((one) => [one.week.version, one.earlier.length])).toEqual([[1, 1]]);
});
