// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The texts book's corrections (#218, answer 266): a first record is not a
// correction, every later version is, the same day too, with the one before
// it and its reason; a withdrawn confirmation and its new record, a moved
// or removed extra session; each in the month of the entry it corrects,
// both months for a move between them; and whether the page was printed
// before the change. Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bookCorrections,
  confirmSessions,
  printedBefore,
  sessionsBetween,
  type RecordBook,
  type SessionRecord,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

/** Wednesday 30 September's math session, confirmed that day as done. */
async function withSession(): Promise<{ book: RecordBook; record: SessionRecord }> {
  const book = await openBook(cemEvents());
  const [session] = sessionsBetween(contextOf(book), d('2026-09-30'), d('2026-09-30'), new Set(['c-math']));
  assert.ok(session);
  const [event] = confirmSessions(contextOf(book), [{ session, details: {} }]);
  assert.ok(event?.kind === 'session.recorded');
  await book.record(d('2026-09-30'), event);
  return { book, record: event.record };
}

test('a first record is no correction; each later version is, the same day too, with its reason', async () => {
  const { book, record } = await withSession();
  assert.deepEqual(bookCorrections(book.state, d('2026-09-01'), d('2026-09-30')).sessions, []);
  const homework = { ...record, homework: { text: 'Made-up: exercise 4', due: d('2026-10-04') } };
  await book.record(d('2026-09-30'), { kind: 'session.recorded', record: homework, correction: 'added-later' });
  const notHeld = { ...homework, outcome: 'not-held' as const, coverage: [] };
  await book.record(d('2026-10-01'), { kind: 'session.recorded', record: notHeld, correction: 'entry-error' });
  const { sessions } = bookCorrections(book.state, d('2026-09-01'), d('2026-09-30'));
  assert.deepEqual(
    sessions.map((one) => [one.entryDay, one.day, one.reason, one.before?.homework?.text, one.after?.outcome]),
    [
      ['2026-09-30', '2026-09-30', 'added-later', undefined, record.outcome],
      ['2026-09-30', '2026-10-01', 'entry-error', 'Made-up: exercise 4', 'not-held'],
    ],
  );
  assert.deepEqual(bookCorrections(book.state, d('2026-10-01'), d('2026-10-31')).sessions, []);
});

test('a withdrawn confirmation is a correction, and so is its new record, from nothing standing', async () => {
  const { book, record } = await withSession();
  await book.record(d('2026-10-02'), { kind: 'session.withdrawn', session: record.session });
  await book.record(d('2026-10-02'), { kind: 'session.withdrawn', session: record.session });
  await book.record(d('2026-10-03'), { kind: 'session.recorded', record, correction: 'other' });
  const { sessions } = bookCorrections(book.state, d('2026-09-01'), d('2026-09-30'));
  assert.deepEqual(
    sessions.map((one) => [one.day, one.before === null, one.after === null]),
    [
      ['2026-10-02', false, true],
      ['2026-10-03', true, false],
    ],
  );
});

test('an extra session moved to another month belongs to both; its removal stays where it stood', async () => {
  const book = await openBook(cemEvents());
  const extra = {
    id: 'x-1',
    courseId: 'c-math',
    kind: 'support' as const,
    day: d('2026-09-29'),
    from: '14:00',
    to: '15:00',
  };
  await book.record(d('2026-09-29'), { kind: 'extra.logged', extra });
  await book.record(d('2026-10-02'), { kind: 'extra.logged', extra: { ...extra, day: d('2026-10-01') } });
  await book.record(d('2026-10-05'), { kind: 'extra.removed', id: 'x-1' });
  const september = bookCorrections(book.state, d('2026-09-01'), d('2026-09-30')).extras;
  assert.deepEqual(
    september.map((one) => [one.entryDay, one.movedFrom, one.day]),
    [['2026-10-01', '2026-09-29', '2026-10-02']],
  );
  const october = bookCorrections(book.state, d('2026-10-01'), d('2026-10-31')).extras;
  assert.deepEqual(
    october.map((one) => [one.entryDay, one.day, one.before?.day, one.after?.day ?? null]),
    [
      ['2026-10-01', '2026-10-02', '2026-09-29', '2026-10-01'],
      ['2026-10-01', '2026-10-05', '2026-10-01', null],
    ],
  );
});

test('a page printed with the entry on or before the change needs correcting on paper too', async () => {
  const { book } = await withSession();
  const day = d('2026-09-30');
  assert.equal(printedBefore(book.state, 'texts', day, d('2026-10-01')), false);
  await book.record(d('2026-10-01'), {
    kind: 'print.recorded',
    print: { id: 'p-1', documents: [{ id: 'texts', from: d('2026-09-01'), to: d('2026-10-31') }] },
  });
  assert.equal(printedBefore(book.state, 'texts', day, d('2026-09-30')), false);
  assert.equal(printedBefore(book.state, 'texts', day, d('2026-10-01')), true);
  assert.equal(printedBefore(book.state, 'texts', d('2026-10-02'), d('2026-10-05')), false);
  assert.equal(printedBefore(book.state, 'supervised', day, d('2026-10-05')), false);
});
