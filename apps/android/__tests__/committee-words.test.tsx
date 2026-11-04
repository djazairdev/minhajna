// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A committee's words on how its cut shaped the exam (#606, R-7.10-21, answer
// 640), against a made-up demo server: put once by a seat that adopted a cut
// after the exam, refused otherwise; the latest signed counting; and in the
// room, only after the exam, only for an adopted cut and the seats that adopted
// it, held back while they do not read as words. Every world, school and share
// is made up.

import { addDays, WORDS_LENGTH } from '@minhajna/core';
import { Platform } from 'react-native';
import { day, fill, items, mathRoom, mock, opened, pageOf, seat, server, words } from '../jest/committee-page';
import { act, alerts, controls, press, show, texts, textsIn, unmount } from '../jest/threshold-page';
import { codeOf, nodeKit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { castVote, putWords, readCommittees } from '../src/threshold/committee-session';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const after = addDays(mock.to, 1);
const LINE = 'The text from unit 5, the questions up to unit 6.';
const type = (text: string) =>
  act(() => (controls('committee-words-field')[0].props as { onChangeText: (one: string) => void }).onChangeText(text));

async function adopted(item: string | null = items[1]) {
  const { held, id } = await opened(after);
  const room = mathRoom(id);
  await castVote(held, room, 0, item, day, nodeKit, server.send);
  await castVote(held, room, 2, item, day, nodeKit, server.send);
  return { held, id, room };
}

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

test('a seat that adopted the cut signs words after the exam, once, and the latest count', async () => {
  const { held, room } = await adopted();
  await putWords(held, room, 0, LINE, after, nodeKit, server.send);
  let [read] = await readCommittees(held, [room], nodeKit, server.send);
  expect(read.words).toMatchObject({ words: LINE, seat: 0, day: after, version: 0 });
  await putWords(held, room, 2, LINE, after, nodeKit, server.send);
  [read] = await readCommittees(held, [room], nodeKit, server.send);
  expect(read.words).toMatchObject({ seat: 0, version: 0 });
  await putWords(held, room, 2, 'Other words.', addDays(after, 1), nodeKit, server.send);
  [read] = await readCommittees(held, [room], nodeKit, server.send);
  expect(read.words).toMatchObject({ words: 'Other words.', seat: 2, version: 1 });
});

test('words are refused during the exam, from a seat that did not adopt, and with no cut adopted', async () => {
  const { held, room } = await adopted();
  const put = (seatAt: number, date = after) => putWords(held, room, seatAt, LINE, date, nodeKit, server.send);
  expect(await codeOf(put(0, mock.to))).toBe('E_CUT_CLOSED');
  expect(await codeOf(put(1))).toBe('E_CUT_CLOSED');
  await expect(putWords(held, room, 0, ' spaced ', after, nodeKit, server.send)).rejects.toBeInstanceOf(RangeError);
  await expect(
    putWords(held, { ...room, name: { ...room.name, world: 'K7QF4' } }, 0, LINE, after, nodeKit, server.send),
  ).rejects.toBeInstanceOf(RangeError);
  leaveWorldNetwork();
  server.reset();
  const none = await adopted(null);
  expect(await codeOf(putWords(none.held, none.room, 0, LINE, after, nodeKit, server.send))).toBe('E_CUT_CLOSED');
});

test('the room asks for the words after the exam, from the seats that adopted, until they read as words', async () => {
  const { held, id } = await adopted();
  await show(pageOf(held, id, after));
  expect(textsIn('committee-words')).toContain(words.words.none);
  expect(controls('committee-words-seats-0').length).toBe(1);
  expect(controls('committee-words-seats-1').length).toBe(0);
  expect(controls('committee-words-seats-2').length).toBe(1);
  const sign = () => controls('committee-words-sign')[0].props as { disabled?: boolean };
  expect(sign().disabled).toBe(true);
  await type('a'.repeat(WORDS_LENGTH + 1));
  expect(sign().disabled).toBe(true);
  expect(texts()).toContain(fill(words.words.bad, { most: WORDS_LENGTH }));
  await type('one\ntwo');
  expect((controls('committee-words-field')[0].props as { value: string }).value).toBe('one two');
  await type(`  ${LINE}  `);
  expect(sign().disabled).toBe(false);
  await press('committee-words-seats-2');
  await press('committee-words-sign');
  expect(texts()).toContain(fill(words.words.done, { seat: seat(3) }));
  expect(textsIn('committee-words')).toContain(LINE);
  const [read] = await readCommittees(held, [mathRoom(id)], nodeKit, server.send);
  expect(read.words).toMatchObject({ words: LINE, seat: 2 });
  expect(sign().disabled).toBe(true);
  expect((controls('committee-words-field')[0].props as { value: string }).value.trim()).toBe(LINE);
});

test('a sign that fails keeps the words and says the problem, and a refusal says why', async () => {
  const { held, id } = await adopted();
  let answer: 'broken' | 'fine' = 'fine';
  const send: Send = (request) =>
    answer === 'broken' ? Promise.resolve({ status: 500, body: null, retryAfter: null }) : server.send(request);
  await show(pageOf(held, id, after, send));
  await type(LINE);
  answer = 'broken';
  await press('committee-words-sign');
  expect(alerts().length).toBe(1);
  expect((controls('committee-words-field')[0].props as { value: string }).value).toBe(LINE);
  expect(textsIn('committee-words')).toContain(words.words.none);
  answer = 'fine';
  await unmount();
  await show(pageOf(held, id, mock.to, send));
  expect(controls('committee-words-sign').length).toBe(0);
});

test('the room asks for no words before the exam is over, or with no cut', async () => {
  const { held, id } = await adopted();
  await show(pageOf(held, id, mock.to));
  expect(controls('committee-words-sign').length).toBe(0);
  await unmount();
  server.reset();
  leaveWorldNetwork();
  const none = await adopted(null);
  await show(pageOf(none.held, none.id, after));
  expect(controls('committee-words-sign').length).toBe(0);
});
