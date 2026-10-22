// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A course's remediation list beside its support list (#230, answer 376):
// each saved and keyed apart; a timetabled «معالجة» session recorded with
// the item it took, finished or not, and a «دعم» one taking the support
// list; an item refused on a lesson, on a session not held, or when its
// list does not hold it; a correction keeping the item, or dropping it when
// the session moves to another list or none; and both lists sent with the
// records. Made-up records only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  awaitingBetween,
  confirmSessions,
  listKey,
  nextSupportItem,
  recordsForRoute,
  saveSupportQueue,
  supportQueueRows,
  type RecordBook,
} from '../src/index.ts';
import { listEvents } from './demo-class.ts';
import { contextOf, d, openBook } from './fixtures.ts';

const day = d('2026-10-15');
const items = [
  { id: 'm1', title: 'التاء المربوطة (مثال)' },
  { id: 'm2', title: 'همزة الوصل (مثال)' },
];

async function withLists(): Promise<RecordBook> {
  const book = await openBook(listEvents());
  await book.record(day, saveSupportQueue(book.state, { courseId: 'c-lang', kind: 'remediation', items }));
  await book.record(
    day,
    saveSupportQueue(book.state, { courseId: 'c-lang', items: [{ id: 's1', title: 'دعم (مثال)' }] }),
  );
  return book;
}

const sessionOf = (book: RecordBook, on: string) => {
  const [found] = awaitingBetween(contextOf(book), d(on), d(on)).filter((one) => one.courseId === 'c-lang');
  assert.ok(found);
  return found;
};

describe('remediation and support lists', () => {
  it('keeps the two lists apart', async () => {
    const book = await withLists();
    assert.equal(listKey('c-lang', 'remediation'), 'c-lang/remediation');
    assert.deepEqual(book.state.supportQueues.get('c-lang/remediation')?.items, items);
    assert.equal(nextSupportItem(book.state, 'c-lang', undefined, 'remediation')?.id, 'm1');
    assert.equal(nextSupportItem(book.state, 'c-lang')?.id, 's1');
    const sent = recordsForRoute(book.state, 'statement').filter((event) => event.kind === 'support.set');
    assert.deepEqual(
      sent.map((event) => (event.kind === 'support.set' ? (event.queue.kind ?? 'support') : '')),
      ['support', 'remediation'],
    );
  });

  it('records the item a timetabled remediation session took, finished or not', async () => {
    const book = await withLists();
    const tuesday = sessionOf(book, '2026-10-13');
    assert.equal(tuesday.sessionType, 'remediation');
    await book.recordAll(
      day,
      confirmSessions(contextOf(book), [{ session: tuesday, details: { listItem: { id: 'm1', finished: false } } }]),
    );
    assert.equal(nextSupportItem(book.state, 'c-lang', undefined, 'remediation')?.id, 'm1');
    const thursday = sessionOf(book, '2026-10-15');
    await book.recordAll(
      day,
      confirmSessions(contextOf(book), [{ session: thursday, details: { listItem: { id: 's1', finished: true } } }]),
    );
    assert.equal(nextSupportItem(book.state, 'c-lang'), null);
    const rows = supportQueueRows(book.state, 'c-lang', 'remediation');
    assert.deepEqual(
      rows.map((row) => [row.item.id, row.sessions.map((one) => one.day), row.finished]),
      [
        ['m1', [d('2026-10-13')], false],
        ['m2', [], false],
      ],
    );
    assert.deepEqual(supportQueueRows(book.state, 'c-lang')[0]?.finished, true);
  });

  it('refuses an item on a lesson, or one the list does not hold, and keeps none when not held', async () => {
    const book = await withLists();
    const context = contextOf(book);
    const lesson = sessionOf(book, '2026-10-14');
    assert.throws(
      () => confirmSessions(context, [{ session: lesson, details: { listItem: { id: 'm1', finished: true } } }]),
      /Only a support or remediation session/,
    );
    const tuesday = sessionOf(book, '2026-10-13');
    assert.throws(
      () => confirmSessions(context, [{ session: tuesday, details: { listItem: { id: 's1', finished: true } } }]),
      /No such list item/,
    );
    const [record] = confirmSessions(context, [
      { session: tuesday, choice: { outcome: 'not-held' }, details: { listItem: { id: 'm1', finished: true } } },
    ]);
    assert.ok(record?.kind === 'session.recorded');
    assert.equal(record.record.listItem, undefined);
  });

  it('keeps the item through a correction, and drops it when the type moves to another list or none', async () => {
    const book = await withLists();
    const tuesday = sessionOf(book, '2026-10-13');
    const taken = { id: 'm1', finished: true };
    await book.recordAll(day, confirmSessions(contextOf(book), [{ session: tuesday, details: { listItem: taken } }]));
    assert.equal(nextSupportItem(book.state, 'c-lang', tuesday.key, 'remediation')?.id, 'm1');
    assert.equal(nextSupportItem(book.state, 'c-lang', undefined, 'remediation')?.id, 'm2');

    const [held] = confirmSessions(contextOf(book), [{ session: tuesday, choice: { outcome: 'done' } }]);
    assert.ok(held?.kind === 'session.recorded');
    assert.deepEqual(held.record.listItem, taken);

    for (const sessionType of ['lesson', 'support']) {
      const [moved] = confirmSessions(contextOf(book), [{ session: tuesday, details: { sessionType } }]);
      assert.ok(moved?.kind === 'session.recorded');
      assert.equal(moved.record.sessionType, sessionType);
      assert.equal(moved.record.listItem, undefined);
    }
    assert.throws(
      () =>
        confirmSessions(contextOf(book), [{ session: tuesday, details: { sessionType: 'support', listItem: taken } }]),
      /No such list item/,
    );
  });
});
