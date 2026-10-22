// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The weekly digest's facts (#234, answers 402 and 405): the week before
// the digest day or so far, Saturday to Friday for a teacher who works on
// Saturdays, within the year; its sessions confirmed and awaiting, earlier
// weeks' apart, losses to the calendar apart and never an exam, make-ups
// due, this year's classes' next exam windows, and each class behind a
// parallel class, named once.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { awaitingBetween, confirmSessions, nextSeq, recordChange, weekDigest, type RecordBook } from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';
import { twoClasses } from './parallel-fixtures.ts';

/** Records `count` of the sessions from `from` to `to`, in order, with `choice`. */
async function confirm(book: RecordBook, from: string, to: string, count: number, makeUp = false): Promise<void> {
  const context = contextOf(book);
  const sessions = awaitingBetween(context, d(from), d(to)).slice(0, count);
  const choice = makeUp ? { outcome: 'not-held' as const, makeUp: true } : undefined;
  await book.recordAll(
    d(to),
    confirmSessions(
      context,
      sessions.map((session) => ({ session, ...(choice && { choice }) })),
    ),
  );
}

describe('The weekly digest', () => {
  it('has nothing to say on the year’s first day', async () => {
    assert.equal(weekDigest(contextOf(await openBook(cemEvents())), d('2026-09-20')), null);
  });

  it('covers the week just ended on Sunday, and the week so far midweek', async () => {
    const book = await openBook(cemEvents());
    await confirm(book, '2026-09-20', '2026-09-24', 2);
    const sunday = weekDigest(contextOf(book), d('2026-09-27'));
    assert.deepEqual(sunday && [sunday.from, sunday.to, sunday.sessions, sunday.confirmed, sunday.awaiting], [
      '2026-09-20',
      '2026-09-26',
      5,
      2,
      3,
    ]);
    assert.equal(sunday?.earlier, 0);
    const wednesday = weekDigest(contextOf(book), d('2026-09-30'));
    assert.deepEqual(wednesday && [wednesday.from, wednesday.to, wednesday.sessions, wednesday.earlier], [
      '2026-09-27',
      '2026-09-29',
      3,
      3,
    ]);
  });

  it('counts a closure and a holiday apart, never an exam', async () => {
    const context = contextOf(await openBook(cemEvents()));
    const storm = weekDigest(context, d('2026-11-22'));
    assert.deepEqual(
      storm?.lost.map((one) => [one.day, one.calendar]),
      [['2026-11-18', 'closure']],
    );
    assert.equal(storm?.sessions, 4);
    const autumn = weekDigest(context, d('2026-11-01'));
    assert.deepEqual(
      autumn?.lost.map((one) => [one.day, one.calendar]),
      [['2026-10-29', 'holiday']],
    );
    const exams = weekDigest(context, d('2026-12-13'));
    assert.deepEqual([exams?.lost, exams?.sessions], [[], 0]);
  });

  it('lists the make-ups due and each class’s next exam window', async () => {
    const book = await openBook(cemEvents());
    await confirm(book, '2026-09-20', '2026-09-20', 1, true);
    const digest = weekDigest(contextOf(book), d('2026-09-27'));
    assert.deepEqual(
      digest?.makeUps.map((one) => [one.courseId, one.day]),
      [['c-math', '2026-09-20']],
    );
    assert.equal(digest?.exams.get('c-math')?.id, 'exams-1');
  });

  it('counts this year’s classes only', async () => {
    const events = cemEvents();
    const course = events.find((one) => one.kind === 'course.set');
    assert.ok(course?.kind === 'course.set');
    const old = { ...course, course: { ...course.course, id: 'c-old', year: '2025-2026' } };
    const digest = weekDigest(contextOf(await openBook([...events, old])), d('2026-09-27'));
    assert.deepEqual([...(digest?.exams.keys() ?? [])], ['c-math']);
  });

  it('covers Saturday to Friday for a teacher who works on Saturdays', async () => {
    const context = contextOf(await openBook(cemEvents()));
    const saturday = weekDigest(context, d('2026-10-17'), true);
    assert.deepEqual([saturday?.from, saturday?.to, saturday?.sessions], ['2026-10-10', '2026-10-16', 5]);
    const sunday = weekDigest(context, d('2026-10-18'), true);
    assert.deepEqual([sunday?.from, sunday?.to], ['2026-10-17', '2026-10-17']);
  });

  it('covers the year’s last week, and nothing after it', async () => {
    const context = contextOf(await openBook(cemEvents()));
    const last = weekDigest(context, d('2027-06-13'));
    assert.deepEqual([last?.from, last?.to], ['2027-06-06', '2027-06-10']);
    assert.equal(weekDigest(context, d('2027-06-20')), null);
  });

  it('names parallel classes drifting apart once, from the class behind', async () => {
    const book = await openBook(twoClasses());
    const start = d('2026-09-20');
    for (const [id, courseId, groupId] of [
      ['t1', 'c-math', 'g-all'],
      ['t3', 'c-math3', 'h-all'],
    ] as const) {
      const slot = { half: 'morning' as const, index: 1 };
      const test = { id, courseId, day: d('2026-10-08'), slot, groupId, title: 'Common test', common: true };
      await book.record(start, { kind: 'test.set', test });
    }
    const context = contextOf(book);
    const seq = nextSeq(context.state.decisions, 'c-math3');
    await book.record(
      start,
      recordChange(context, {
        id: 'b1',
        kind: 'budget',
        item: 'l1',
        sessions: 5,
        courseId: 'c-math3',
        day: start,
        seq,
      }),
    );
    const digest = weekDigest(contextOf(book), d('2026-09-27'));
    assert.deepEqual(
      digest?.drifts.map((one) => [one.courseId, one.drift.other]),
      [['c-math3', 'c-math']],
    );
  });
});
