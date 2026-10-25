// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The progress statement's harder cases (#436, answer 484): a unit counts as
// completed when an item in it was left out or skipped, but not when it was
// left out whole; a rotating class never counts more sessions not held than
// it had; delay figures are whole sessions, with no week behind when no
// session is; a pack title that could not be
// signed gives no statement; a later format version asks for an update; and
// a teacher's own list is named without its local ID. Made-up data only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkStatement,
  packKey,
  makeContext,
  pace,
  addDays,
  progressStatement,
  saveFreeList,
  sessionKey,
  sessionsBetween,
  signStatement,
  statementPayload,
  type Coverage,
  type Day,
  type FreeList,
  type RecordBook,
} from '../src/index.ts';
import { cemEvents, contextOf, d, mathPack, openBook, primaryEvents, reference } from './fixtures.ts';
import { rotatingBook } from './rotation-fixtures.ts';
import { makeTestKey, nodeVerifier } from './signed-fixtures.ts';
import { confirmStatementDays } from './statement-fixtures.ts';

const DAYS = [
  '2026-09-20',
  '2026-09-21',
  '2026-09-22',
  '2026-09-23',
  '2026-09-24',
  '2026-09-27',
  '2026-09-28',
  '2026-09-29',
];

async function record(book: RecordBook, day: Day, coverage: readonly Coverage[]) {
  const slot = { half: 'morning' as const, index: 1 };
  const session = { key: sessionKey('c-math', day, slot, 'g-all'), courseId: 'c-math', groupId: 'g-all', day, slot };
  await book.record(day, {
    kind: 'session.recorded',
    record: { session, coverage, outcome: 'done', sessionType: 'lesson' },
  });
}

/** Teaches the made-up items in turn, one session each, after the decisions given. */
async function taught(items: readonly string[], leftOut: readonly string[] = []): Promise<RecordBook> {
  const book = await openBook(cemEvents());
  for (const [index, item] of leftOut.entries()) {
    await book.record(d('2026-09-13'), {
      kind: 'plan.decided',
      decision: { id: `x-${index}`, courseId: 'c-math', kind: 'leave-out', item },
    });
  }
  for (const [index, item] of items.entries())
    await record(book, d(DAYS[index]!), [{ op: 'taught', item, from: 0, to: 9 }]);
  return book;
}

test('a unit with an item left out or skipped still completes, but never one left out whole', async () => {
  const all = await taught(['l1', 'l2', 'l3', 'l4', 'i1', 'l5', 'l6', 'l7']);
  assert.equal(progressStatement(contextOf(all), 'c-math', d('2026-09-30'))?.lastUnit?.id, 'u2');
  const left = await taught(['l1', 'l2', 'l3', 'l4', 'i1', 'l5', 'l7'], ['l6']);
  const statement = progressStatement(contextOf(left), 'c-math', d('2026-09-30'))!;
  assert.equal(statement.lastUnit?.id, 'u2');
  assert.notEqual(statement.lastResource?.id, 'l6');
  const skipped = await taught(['l1', 'l2', 'l3', 'l4', 'i1', 'l5', 'l7']);
  await record(skipped, d('2026-09-30'), [{ op: 'skipped', item: 'l6' }]);
  assert.equal(progressStatement(contextOf(skipped), 'c-math', d('2026-10-01'))?.lastUnit?.id, 'u2');
  const whole = mathPack.items.filter((item) => item.unit === 'u2' && item.buffer !== true).map((item) => item.id);
  const none = await taught(['l1', 'l2', 'l3', 'l4', 'i1'], whole);
  assert.equal(progressStatement(contextOf(none), 'c-math', d('2026-09-30'))?.lastUnit?.id, 'u1');
});

test('a rotating class never counts more sessions not held than it had', async () => {
  const book = await rotatingBook();
  const day = d('2026-09-22');
  await confirmStatementDays(book, d('2026-09-20'), day, { outcome: 'not-held' });
  const context = contextOf(book);
  const statement = progressStatement(context, 'c-math', day)!;
  const had = sessionsBetween(context, context.ref.year.from, day, new Set(['c-math'])).length;
  assert.ok(statement.notHeld.calendar + statement.notHeld.other <= had);
  assert.ok(statement.notHeld.calendar >= 1);
});

test('signs delay figures as whole sessions', async () => {
  const book = await openBook(cemEvents());
  await record(book, d('2026-09-20'), [{ op: 'taught', item: 'l1', from: 0, to: 1 }]);
  for (const day of ['2026-10-15', '2026-11-20']) {
    const { delay } = progressStatement(contextOf(book), 'c-math', d(day))!;
    for (const value of [delay.sessions, delay.bufferUsed, delay.bufferLeft]) assert.ok(Number.isSafeInteger(value));
  }
  const confirmed = await openBook(cemEvents());
  await confirmStatementDays(confirmed, d('2026-09-20'), d('2026-09-24'));
  const statement = progressStatement(contextOf(confirmed), 'c-math', d('2026-11-05'))!;
  assert.ok(Object.values(statement.delay).every((value) => value === null || Number.isSafeInteger(value)));
});

test('never gives weeks behind with no session behind, and otherwise the weeks pace gives', async () => {
  const book = await openBook(primaryEvents());
  await confirmStatementDays(book, d('2026-09-20'), d('2026-09-24'));
  for (let day = d('2026-09-21'); day < d('2026-11-30'); day = addDays(day, 2)) {
    const context = contextOf(book);
    const { delay } = progressStatement(context, 'c-lang', day)!;
    const paced = pace(context, 'c-lang', day)!;
    assert.equal(delay.weeks, delay.sessions === 0 ? 0 : paced.weeksBehind);
  }
});

test('gives no statement for a pack whose titles could not be signed', async () => {
  const items = mathPack.items.map((item) => (item.id === 'l4' ? { ...item, title: 'L'.repeat(600) } : item));
  const pack = { ...mathPack, items };
  const ref = { ...reference, packs: new Map([[packKey(pack.id, pack.release), pack]]) };
  const book = await taught(['l1', 'l2', 'l3', 'l4']);
  assert.equal(progressStatement(makeContext(ref, book.state), 'c-math', d('2026-09-30')), null);
});

test('a statement of a later major version asks for an update, not "unreadable"', async () => {
  const key = makeTestKey('example-teacher');
  const statement = progressStatement(contextOf(await openBook(cemEvents())), 'c-math', d('2026-10-01'))!;
  const signed = JSON.parse(
    await signStatement(statement, key.trusted.spki, (text) => Promise.resolve(key.sign(text))),
  ) as Record<string, unknown>;
  const payload = statementPayload(statement).replace('"major":1', '"major":2');
  const later = JSON.stringify({ ...signed, payload, signature: key.sign(payload) });
  assert.deepEqual(await checkStatement(later, nodeVerifier), { ok: false, problem: 'version' });
});

test("names a teacher's own list by level and subject, never by its local ID", async () => {
  const book = await openBook(
    cemEvents().map((event) =>
      event.kind === 'course.set' && event.course.id === 'c-math'
        ? { ...event, course: { ...event.course, pack: null } }
        : event,
    ),
  );
  const list: FreeList = {
    courseId: 'c-math',
    started: d('2026-09-14'),
    items: [
      { id: 'u1', kind: 'unit', title: 'Made-up unit' },
      { id: 'l1', kind: 'lesson', title: 'Made-up lesson', sessions: 1 },
    ],
  };
  await book.record(d('2026-09-14'), saveFreeList(book.state.courses, list));
  const statement = progressStatement(contextOf(book), 'c-math', d('2026-09-30'))!;
  assert.equal(statement.pack.release, 'own');
  assert.match(statement.pack.id, /\.own$/u);
  assert.doesNotMatch(statement.pack.id, /c-math|cmath/u);
});
