// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's support queue (#228, answers 359 and 360): the teacher's items
// saved whole and checked; each support or «تدارك» session taking the first
// item it has not finished, and giving it back once removed; review
// sessions taking none; and a correction keeping an item the list no longer
// has. Made-up records only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  extraRemoval,
  logExtra,
  nextSupportItem,
  recordsForRoute,
  saveSupportQueue,
  supportQueueRows,
  type ExtraSession,
  type RecordBook,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const today = d('2026-10-04');
const items = [
  { id: 's1', title: 'تمارين تطبيقية (مثال)' },
  { id: 's2', title: 'قراءة نص (مثال)' },
  { id: 's3', title: 'كتابة فقرة (مثال)' },
];

const extra = (
  id: string,
  day: string,
  kind: ExtraSession['kind'],
  taken: Partial<ExtraSession> = {},
): ExtraSession => ({
  id,
  courseId: 'c-math',
  kind,
  day: d(day),
  from: '14:00',
  to: '15:00',
  ...taken,
});

async function queued(): Promise<RecordBook> {
  const book = await openBook(cemEvents());
  await book.record(today, saveSupportQueue(book.state, { courseId: 'c-math', items }));
  return book;
}

describe('support queue', () => {
  it('saves the teacher’s items whole, trimmed, and refuses bad ones', async () => {
    const book = await openBook(cemEvents());
    assert.deepEqual(saveSupportQueue(book.state, { courseId: 'c-math', items: [{ id: 's1', title: '  أ  ' }] }), {
      kind: 'support.set',
      queue: { courseId: 'c-math', items: [{ id: 's1', title: 'أ' }] },
    });
    const save = (title: string, id = 's2') =>
      saveSupportQueue(book.state, {
        courseId: 'c-math',
        items: [
          { id: 's1', title: 'أ' },
          { id, title },
        ],
      });
    assert.throws(() => save(' '), /has a title/);
    assert.throws(() => save('x'.repeat(121)), /too long/);
    assert.throws(() => save('ب', 's1'), /twice/);
    assert.throws(() => save('سطر\nثان'), /one plain line/);
    assert.throws(() => save('\u202eب'), /one plain line/);
    assert.throws(() => saveSupportQueue(book.state, { courseId: 'c-none', items: [] }), /No such course/);
  });

  it('gives each support session the first item it has not finished', async () => {
    const book = await queued();
    assert.equal(nextSupportItem(book.state, 'c-math')?.id, 's1');
    await book.recordAll(
      today,
      logExtra(contextOf(book), extra('x1', '2026-09-29', 'support', { item: 's1', finished: true }), today),
    );
    assert.equal(nextSupportItem(book.state, 'c-math')?.id, 's2');
    await book.recordAll(
      today,
      logExtra(contextOf(book), extra('x2', '2026-09-30', 'catch-up', { item: 's2' }), today),
    );
    assert.equal(nextSupportItem(book.state, 'c-math')?.id, 's2');
    assert.equal(nextSupportItem(book.state, 'c-math', 'x1')?.id, 's1');
    assert.deepEqual(
      supportQueueRows(book.state, 'c-math').map((row) => [
        row.item.id,
        row.sessions.map((one) => one.id),
        row.finished,
      ]),
      [
        ['s1', ['x1'], true],
        ['s2', ['x2'], false],
        ['s3', [], false],
      ],
    );
    assert.throws(
      () => logExtra(contextOf(book), extra('x3', '2026-10-01', 'review', { item: 's3' }), today),
      /support session/,
    );
    assert.throws(
      () => logExtra(contextOf(book), extra('x3', '2026-10-01', 'support', { item: 's9' }), today),
      /No such/,
    );
    assert.throws(
      () => logExtra(contextOf(book), extra('x3', '2026-10-01', 'support', { finished: true }), today),
      /with an item/,
    );
    assert.deepEqual(
      recordsForRoute(book.state, 'statement').flatMap((record) =>
        record.kind === 'support.set' ? [record.queue.courseId] : [],
      ),
      ['c-math'],
    );
  });

  it('keeps an item a correction names after the list dropped it', async () => {
    const book = await queued();
    await book.recordAll(today, logExtra(contextOf(book), extra('x1', '2026-09-29', 'support', { item: 's1' }), today));
    await book.record(today, saveSupportQueue(book.state, { courseId: 'c-math', items: items.slice(1) }));
    const [event] = logExtra(
      contextOf(book),
      extra('x1', '2026-09-29', 'support', { item: 's1', finished: true }),
      today,
    );
    assert.deepEqual(event, {
      kind: 'extra.logged',
      extra: extra('x1', '2026-09-29', 'support', { item: 's1', finished: true }),
    });
    assert.equal(nextSupportItem(book.state, 'c-math')?.id, 's2');
    assert.throws(
      () => logExtra(contextOf(book), extra('x1', '2026-09-29', 'review', { item: 's1' }), today),
      /support session/,
    );
  });

  it('gives an item back when the session that finished it is removed', async () => {
    const book = await queued();
    await book.recordAll(
      today,
      logExtra(contextOf(book), extra('x1', '2026-09-29', 'support', { item: 's1', finished: true }), today),
    );
    assert.equal(nextSupportItem(book.state, 'c-math')?.id, 's2');
    await book.recordAll(today, extraRemoval('x1', false));
    assert.equal(nextSupportItem(book.state, 'c-math')?.id, 's1');
  });
});
