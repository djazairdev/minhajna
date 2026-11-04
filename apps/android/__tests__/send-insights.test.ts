// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Sending a teachers' world's insights (#622, answer 697), with a made-up demo
// server: turned on at the first term's end and sent at the second's, the class
// with a pack sends both terms, with no starter token, and nothing is waiting
// after; two tries at once take turns, each sending going once; a try its
// caller no longer wants, or whose choice changes on the way, stops before its
// next sending, and turned on again the term just ended goes; a refusal keeps
// nothing, and the next try sends what is left; a class with a pack and no
// sending is passed over and counted, the rest sent. Every world is made up.

import { sentSendings, worldTeacher, type InsightsSending, type RecordBook } from '@minhajna/core';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { reference } from '../jest/world-calendar';
import { codeOf, nodeKit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { seededWorld } from '../src/director/director-world';
import { sendDueInsights, waitingSendings, type SendInsightsInput } from '../src/insights/send-insights';
import * as terms from '../src/insights/term-sendings';
import type { WorldRequest } from '../src/network/world-network';
import { openRecordBook } from '../src/storage/history';
import { worldSpec } from '../src/storage/world';

const id = 'K7QF4';
const storage = new FakeStorage();
const mine = worldTeacher(seededWorld(id, reference))!;
const [first, second] = reference.calendar.year.terms;
const digest = (text: string) => storage.digest([text]).then(([hash]) => hash);
let requests: WorldRequest[] = [];
let book: RecordBook;

const answering =
  (status: number, then?: () => Promise<void>): Send =>
  async (request) => {
    requests.push(request);
    await then?.();
    return { status, body: { id: (request.body as InsightsSending).id }, retryAfter: null };
  };

const input = (send: Send, wanted?: () => boolean): SendInsightsInput => ({
  world: id,
  mine,
  date: second.to,
  book,
  reference,
  kit: nodeKit,
  digest,
  send,
  ...(wanted && { wanted }),
});

beforeEach(async () => {
  requests = [];
  book = await openRecordBook(worldSpec(storage.asSpec(), new FakeWorld(storage).asSpec(), id));
  await book.record(first.to, { kind: 'insights.choice', choice: { on: true } });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('sends each term due once, with no starter token, two tries at once taking turns', async () => {
  expect(waitingSendings(mine, reference, second.to, book.entries).map((one) => one.term.number)).toEqual([1, 2]);
  const taken = await Promise.all([sendDueInsights(input(answering(201))), sendDueInsights(input(answering(200)))]);
  expect(taken).toEqual([
    { taken: 2, unsent: 0 },
    { taken: 0, unsent: 0 },
  ]);
  expect(requests.map((one) => [one.method, one.path, one.starter])).toEqual([
    ['PUT', `/worlds/${id}/insights/sendings`, undefined],
    ['PUT', `/worlds/${id}/insights/sendings`, undefined],
  ]);
  expect(sentSendings(book.entries).map((one) => [one.sending.term, one.sending])).toEqual(
    requests.map((one) => [(one.body as InsightsSending).term, one.body]),
  );
  expect(waitingSendings(mine, reference, second.to, book.entries)).toEqual([]);
});

test('stops once its caller has gone, or the choice changes on the way', async () => {
  expect(await sendDueInsights(input(answering(201), () => false))).toEqual({ taken: 0, unsent: 0 });
  expect(requests).toEqual([]);
  const off = () => book.record(second.to, { kind: 'insights.choice', choice: { on: false } }).then(() => undefined);
  expect(await sendDueInsights(input(answering(201, off)))).toEqual({ taken: 1, unsent: 0 });
  expect(sentSendings(book.entries).map((one) => one.sending.term)).toEqual([1]);
  await book.record(second.to, { kind: 'insights.choice', choice: { on: true } });
  expect(await sendDueInsights(input(answering(201)))).toEqual({ taken: 1, unsent: 0 });
  expect(sentSendings(book.entries).map((one) => one.sending.term)).toEqual([1, 2]);
});

test('a refusal keeps nothing, and the next try sends what is left', async () => {
  expect(await codeOf(sendDueInsights(input(answering(409))))).toBe('E_WORLD_SERVER');
  expect(sentSendings(book.entries)).toEqual([]);
  expect(await sendDueInsights(input(answering(201)))).toEqual({ taken: 2, unsent: 0 });
});

test('a class with a pack and no sending is passed over and counted, the rest sent', async () => {
  const real = terms.termSendings;
  jest
    .spyOn(terms, 'termSendings')
    .mockImplementation(async (made) =>
      made.term.number === 1
        ? (await real(made)).map((one) =>
            typeof one.sending === 'string' ? one : { ...one, sending: 'no week of the course is in the term' },
          )
        : real(made),
    );
  expect(await sendDueInsights(input(answering(201)))).toEqual({ taken: 1, unsent: 1 });
  expect(sentSendings(book.entries).map((one) => one.sending.term)).toEqual([2]);
});
