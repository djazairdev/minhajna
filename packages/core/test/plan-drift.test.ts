// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Parallel classes drifting apart before a common test or an exam window
// (#225, R-4.7-37, answers 292 to 295): measured in sessions of pack content
// covered, whatever the order, warned from two sessions apart, the same
// from either class, before the next fixed point.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  alignChange,
  driftBefore,
  nextSeq,
  recordChange,
  type Context,
  type Day,
  type PlanChange,
  type RecordBook,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';
import { teach, twoClasses } from './parallel-fixtures.ts';

const start = d('2026-09-20');

/** A common test for both classes on `day`. */
async function commonTest(book: RecordBook, day: Day): Promise<void> {
  const test = (id: string, courseId: string, groupId: string) => ({
    kind: 'test.set' as const,
    test: {
      id,
      courseId,
      day,
      slot: { half: 'morning' as const, index: 1 },
      groupId,
      title: 'Common test',
      common: true,
    },
  });
  await book.record(start, test('t1', 'c-math', 'g-all'));
  await book.record(start, test('t3', 'c-math3', 'h-all'));
}

/** A change of 1AM3's plan, without what `change` fills in. */
type Made<C = PlanChange> = C extends PlanChange ? Omit<C, 'courseId' | 'day' | 'seq'> : never;

/** Records one change of 1AM3's plan. */
async function change(book: RecordBook, made: Made): Promise<Context> {
  const context = contextOf(book);
  const seq = nextSeq(context.state.decisions, 'c-math3');
  await book.record(start, recordChange(context, { ...made, courseId: 'c-math3', day: start, seq }));
  return contextOf(book);
}

/** 1AM3 gives its first lesson more sessions, so it falls behind. */
const slower = (book: RecordBook, sessions: number) => change(book, { id: 'b1', kind: 'budget', item: 'l1', sessions });

const ids = (context: Context, courseId: string) => {
  const drift = driftBefore(context, courseId, start);
  return drift && { ...drift, here: drift.here?.id, there: drift.there?.id };
};

describe('Parallel classes drifting apart', () => {
  it('warns from either class before their common test, naming where each would be', async () => {
    const book = await openBook(twoClasses());
    await commonTest(book, d('2026-10-08'));
    const context = await slower(book, 5);
    const before = { kind: 'test', day: '2026-10-08', title: 'Common test' };
    assert.deepEqual(ids(context, 'c-math3'), {
      before,
      other: 'c-math',
      gap: 3,
      behind: true,
      here: 'r1',
      there: 'l5',
    });
    assert.deepEqual(ids(context, 'c-math'), {
      before,
      other: 'c-math3',
      gap: 3,
      behind: false,
      here: 'l5',
      there: 'r1',
    });
  });

  it('stays quiet under two sessions apart, and for a class with no parallel', async () => {
    const book = await openBook(twoClasses());
    await commonTest(book, d('2026-10-08'));
    assert.equal(driftBefore(contextOf(book), 'c-math3', start), null);
    assert.equal(driftBefore(await slower(book, 3), 'c-math3', start), null);
    const alone = await openBook(cemEvents());
    assert.equal(driftBefore(contextOf(alone), 'c-math', start), null);
  });

  it('measures before the exam window when it comes before any common test', async () => {
    const book = await openBook(twoClasses());
    await commonTest(book, d('2026-12-20'));
    const drift = driftBefore(await slower(book, 40), 'c-math3', start);
    assert.deepEqual(drift?.before, { kind: 'exams', day: '2026-12-06', term: 1 });
    assert.equal(drift?.behind, true);
  });

  it('never widens the gap when the class behind aligns', async () => {
    const book = await openBook(twoClasses());
    await commonTest(book, d('2026-10-08'));
    await slower(book, 5);
    await teach(book, 'c-math', '2026-09-30');
    await teach(book, 'c-math3', '2026-09-30');
    const day = d('2026-10-01');
    const before = driftBefore(contextOf(book), 'c-math3', day);
    assert.ok(before?.behind === true);
    const align = alignChange(contextOf(book), 'c-math3', 'c-math', day, 'a1');
    assert.ok(align !== null);
    await book.record(day, recordChange(contextOf(book), align));
    assert.ok((driftBefore(contextOf(book), 'c-math3', day)?.gap ?? 0) <= before.gap);
  });

  it('counts content, not order: a move or a split changes nothing', async () => {
    const book = await openBook(twoClasses());
    await commonTest(book, d('2026-10-08'));
    await change(book, { id: 'm1', kind: 'move', item: 'l7', before: 'd1' });
    assert.equal(driftBefore(contextOf(book), 'c-math3', start), null);
    assert.equal(driftBefore(contextOf(book), 'c-math', start), null);
    const split = await change(book, { id: 's1', kind: 'split', item: 'l4', titles: ['Made-up A', 'Made-up B'] });
    assert.equal(driftBefore(split, 'c-math3', start), null);
  });

  it('counts an added item as no pack content, and a skipped one as covered', async () => {
    const book = await openBook(twoClasses());
    await commonTest(book, d('2026-10-08'));
    const added = await change(book, { id: 'a1', kind: 'add', title: 'Made-up', sessions: 3, before: 'l1' });
    assert.deepEqual(
      [driftBefore(added, 'c-math3', start)?.gap, driftBefore(added, 'c-math3', start)?.behind],
      [3, true],
    );
    const other = await openBook(twoClasses());
    await commonTest(other, d('2026-10-08'));
    const skipped = await change(other, { id: 'k1', kind: 'skip', item: 'l4' });
    assert.deepEqual(
      [driftBefore(skipped, 'c-math3', start)?.gap, driftBefore(skipped, 'c-math3', start)?.behind],
      [2, false],
    );
  });
});
