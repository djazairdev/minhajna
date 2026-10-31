// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teachers' receipts on the director's timetable page (#579, answer 607),
// against a made-up demo server: looking before any part says no teacher was
// sent one; once a version is sent and the phone teacher confirmed it, looking
// says how many were sent a part on their phone and how many are up to date,
// and how many joined with a security key, aloud in the hidden live region on a
// PC, and each teacher's line, one per teacher, and that a new code is listed
// once a part is sent with it; a later version not yet confirmed names the one
// confirmed before it, and a one-day version still to come says it is not
// confirmed yet; when only teachers with a security key were sent one, the
// summary names them alone; a problem is said; and the card's words read in
// every language. Every world, school and teacher is made up.

import { addDays, type Day } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, View, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { BELLS, school, sendParts, server, session, setting } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { partFrom } from '../src/timetable/send-session';
import { confirmReceipt } from '../src/timetable/teacher-session';
import { TimetableReceipts } from '../src/timetable/TimetableReceipts';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.ttReceipt;
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
const dayText = (day: Day) => `day ${day}`;
const said = () => (tree!.root.findByProps({ testID: 'tt-receipts-said' }).props as TextProps).children;

async function look(world: Awaited<ReturnType<typeof setting>>['here'], send: Send = server.send) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <TimetableReceipts world={world} school={school} kit={kit} send={send} dayText={dayText} />
      </LocaleDirContext.Provider>,
    );
  });
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0)
        (tree!.root.findAllByProps({ testID: 'tt-receipts-look' })[0].props as PressableProps).onPress?.({} as never);
      await settle();
    });
}

test('looking lists each teacher sent a part with the version they confirmed', async () => {
  const { id, here, joined } = await setting();
  await look(here);
  expect([texts(), said()]).toEqual([expect.arrayContaining([words.none]), words.none]);
  await ReactTestRenderer.act(() => tree?.unmount());
  await sendParts(here, school, [session('بلعيد محمد', 1, 600), session('Salhi Zahia', 2, 540)], BELLS);
  await confirmReceipt({ world: id, date: here.date }, joined, 1, kit, server.send);
  await look(here);
  const found = words.found.replace('{{teachers}}', '1').replace('{{confirmed}}', '1');
  const told = `${found} ${words.keys.replace('{{keys}}', '1')}`;
  expect(said()).toBe(told);
  expect(texts()).toEqual(
    expect.arrayContaining([
      told,
      words.current.replace('{{version}}', '1').replace('{{day}}', dayText(here.date)),
      words.keyLine,
      words.newCode,
    ]),
  );
  expect(tree!.root.findAll((node) => node.type === View && node.props.testID === 'tt-receipt')).toHaveLength(2);
  await ReactTestRenderer.act(() => tree?.unmount());
  await sendParts(here, school, [session('بلعيد محمد', 1, 540), session('Salhi Zahia', 2, 540)], BELLS);
  const day = addDays(partFrom(here.date), 1);
  const once = { from: day, once: true };
  await sendParts(
    here,
    school,
    [session('بلعيد محمد', 1, 600), session('Salhi Zahia', 2, 540)],
    BELLS,
    server.send,
    once,
  );
  await look(here);
  const behind = words.behind.replace('{{sent}}', '2').replace('{{version}}', '1');
  const waiting = words.dayWaiting.replace('{{date}}', dayText(day)).replace('{{version}}', '3');
  expect(texts()).toEqual(expect.arrayContaining([behind.replace('{{day}}', dayText(here.date)), waiting]));
});

test('when only teachers with a security key were sent a part, the summary names them alone', async () => {
  const { here } = await setting();
  await sendParts(here, school, [session('Salhi Zahia', 2, 540)], BELLS);
  await look(here);
  expect(said()).toBe(words.keys.replace('{{keys}}', '1'));
});

test('a problem is said', async () => {
  const { here } = await setting();
  await look(here, () => Promise.resolve({ status: 503, body: null, retryAfter: null }));
  expect(texts()).toContain(ar.demo.problem.other);
});

test('the receipts’ words read in every language', () => {
  for (const one of [en, fr]) {
    expect(Object.keys(one.ttReceipt).sort()).toEqual(Object.keys(ar.ttReceipt).sort());
    for (const [key, value] of Object.entries(ar.ttReceipt)) {
      const places = (text: string) => (text.match(/\{\{\w+\}\}/gu) ?? []).sort();
      const theirs = one.ttReceipt[key as keyof typeof one.ttReceipt];
      expect([key, places(theirs)]).toEqual([key, places(value)]);
    }
  }
});
