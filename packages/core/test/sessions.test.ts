// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  awaitingBetween,
  confirmSessions,
  rollCallUnits,
  sessionsBetween,
  slotKey,
  walkCourse,
  type CalendarEntry,
  type Context,
  type Day,
  type RecordEvent,
  type Session,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

function describeSessions(sessions: readonly Session[]): string[] {
  return sessions.map(
    (s) => `${s.day} ${slotKey(s.slot)} ${s.groupId} ${s.sessionType}${s.calendar ? ` ${s.calendar}` : ''}`,
  );
}

/** The fixtures' timetable as a new version from `from`, with Monday's lesson in the given morning slot. */
function timetable(id: string, from: Day, monday: number): RecordEvent {
  const v1 = cemEvents().find((event) => event.kind === 'timetable.set');
  if (v1?.kind !== 'timetable.set') throw new Error('The fixtures have no timetable');
  const entries = v1.version.entries.map((entry) =>
    entry.id === 'e-mon' ? { ...entry, slot: { half: 'morning' as const, index: monday } } : entry,
  );
  return { kind: 'timetable.set', version: { ...v1.version, id, from, entries } };
}

function proposals(context: Context, from: Day, to: Day): string[] {
  const walk = walkCourse(context, 'c-math', to);
  return awaitingBetween(context, from, to).map((session) => {
    const proposal = walk.proposals.get(session.key);
    return `${session.day} ${proposal?.item.id} ${proposal?.from}-${proposal?.to}`;
  });
}

function teacherEntry(fields: Pick<CalendarEntry, 'id' | 'from' | 'to' | 'effect'>): RecordEvent {
  return {
    kind: 'calendar.set',
    entry: {
      ...fields,
      layer: 'teacher',
      name: { en: 'Made-up training' },
      source: 'teacher',
      confidence: 'announced',
    },
  };
}

describe('sessions from the timetable and the calendar', () => {
  it('generates the first week, with A-week TD for the first half-group', async () => {
    const context = contextOf(await openBook(cemEvents()));
    assert.deepEqual(describeSessions(sessionsBetween(context, d('2026-09-13'), d('2026-09-26'))), [
      '2026-09-20 m1 g-all lesson',
      '2026-09-21 m2 g-all lesson',
      '2026-09-22 a1 g-1 td',
      '2026-09-23 m3 g-all lesson',
      '2026-09-24 m1 g-all lesson',
    ]);
    assert.deepEqual(describeSessions(sessionsBetween(context, d('2026-09-29'), d('2026-09-29'))), [
      '2026-09-29 a1 g-2 td',
    ]);
  });

  it('marks a holiday inside a teaching week, and skips a week of holidays', async () => {
    const context = contextOf(await openBook(cemEvents()));
    assert.deepEqual(describeSessions(sessionsBetween(context, d('2026-10-28'), d('2026-11-08'))), [
      '2026-10-28 m3 g-all lesson',
      '2026-10-29 m1 g-all lesson holiday',
      '2026-11-08 m1 g-all lesson',
    ]);
  });

  // The week of 25 October is the sixth teaching week, a B week. The holiday
  // week does not count, so the week of 8 November, the seventh, is an A
  // week. Term 2 starts again on an A week.
  it('alternates A and B weeks over teaching weeks only', async () => {
    const context = contextOf(await openBook(cemEvents()));
    assert.deepEqual(describeSessions(sessionsBetween(context, d('2026-10-27'), d('2026-10-27'))), [
      '2026-10-27 a1 g-2 td',
    ]);
    assert.deepEqual(describeSessions(sessionsBetween(context, d('2026-11-10'), d('2026-11-10'))), [
      '2026-11-10 a1 g-1 td',
    ]);
    assert.deepEqual(describeSessions(sessionsBetween(context, d('2027-01-05'), d('2027-01-05'))), [
      '2027-01-05 a1 g-1 td',
    ]);
  });

  it("marks closures in the school's zone only, and exam windows", async () => {
    const context = contextOf(await openBook(cemEvents()));
    assert.deepEqual(describeSessions(sessionsBetween(context, d('2026-11-18'), d('2026-11-18'))), [
      '2026-11-18 m3 g-all lesson closure',
    ]);
    assert.deepEqual(describeSessions(sessionsBetween(context, d('2026-11-22'), d('2026-11-22'))), [
      '2026-11-22 m1 g-all lesson',
    ]);
    assert.deepEqual(describeSessions(sessionsBetween(context, d('2026-12-06'), d('2026-12-07'))), [
      '2026-12-06 m1 g-all lesson exam',
      '2026-12-07 m2 g-all lesson exam',
    ]);
  });

  // On 6 October the teacher enters a timetable dated from 4 October, which
  // applies from 6 October. A version dated ahead applies from its own day.
  it('applies a later timetable from the day it was recorded, so the past never moves', async () => {
    const book = await openBook(cemEvents());
    const context = contextOf(book);
    const done = awaitingBetween(context, d('2026-09-20'), d('2026-10-05')).map((session) => ({ session }));
    await book.recordAll(d('2026-10-05'), confirmSessions(context, done));
    const before = contextOf(book);

    await book.record(d('2026-10-06'), timetable('v2', d('2026-10-04'), 4));
    const after = contextOf(book);
    assert.deepEqual(
      describeSessions(sessionsBetween(after, d('2026-09-20'), d('2026-10-10'))),
      describeSessions(sessionsBetween(before, d('2026-09-20'), d('2026-10-10'))),
    );
    assert.equal(sessionsBetween(after, d('2026-10-05'), d('2026-10-05'))[0]?.scheduled, true);
    assert.deepEqual(awaitingBetween(after, d('2026-09-20'), d('2026-10-05')), []);
    assert.deepEqual(
      proposals(after, d('2026-10-06'), d('2026-10-08')),
      proposals(before, d('2026-10-06'), d('2026-10-08')),
    );
    assert.equal(rollCallUnits(after, 'k-1am2', d('2026-10-05'), d('2026-10-05')).length, 1);
    assert.deepEqual(describeSessions(sessionsBetween(after, d('2026-10-12'), d('2026-10-12'))), [
      '2026-10-12 m4 g-all lesson',
    ]);

    await book.record(d('2026-10-06'), timetable('v3', d('2026-10-18'), 2));
    assert.deepEqual(
      book.state.timetables.map(({ version, recorded, from }) => `${version.id} ${recorded} ${from}`),
      ['v1 2026-09-13 2026-09-20', 'v2 2026-10-06 2026-10-06', 'v3 2026-10-06 2026-10-18'],
    );
    assert.deepEqual(describeSessions(sessionsBetween(contextOf(book), d('2026-10-19'), d('2026-10-19'))), [
      '2026-10-19 m2 g-all lesson',
    ]);
  });

  it('keeps a recorded session that a timetable recorded the same day no longer has', async () => {
    const book = await openBook(cemEvents());
    const [monday] = sessionsBetween(contextOf(book), d('2026-10-05'), d('2026-10-05'));
    assert.ok(monday);
    await book.recordAll(d('2026-10-05'), confirmSessions(contextOf(book), [{ session: monday }]));
    await book.record(d('2026-10-05'), timetable('v2', d('2026-10-04'), 4));

    const changed = sessionsBetween(contextOf(book), d('2026-10-05'), d('2026-10-05'));
    assert.deepEqual(describeSessions(changed), ['2026-10-05 m2 g-all lesson', '2026-10-05 m4 g-all lesson']);
    assert.equal(changed[0]?.scheduled, false);
  });

  it('applies the first timetable from its own day, so a setup mid-year fills in the weeks gone', async () => {
    const context = contextOf(await openBook(cemEvents(), d('2026-10-15')));
    assert.equal(sessionsBetween(context, d('2026-09-20'), d('2026-09-24')).length, 5);
  });

  // The week of 11 October stays a B week, and so does the week of 13
  // December. On the teacher's own days the class is still there, so its roll
  // call stays.
  it("never lets the teacher's own calendar change the A/B weeks, and marks only the teacher's sessions", async () => {
    const book = await openBook(cemEvents());
    await book.recordAll(d('2026-10-01'), [
      teacherEntry({ id: 'training', from: d('2026-10-04'), to: d('2026-10-08'), effect: 'no-school' }),
      teacherEntry({ id: 'own-reset', from: d('2026-10-11'), to: d('2026-10-11'), effect: 'week-a' }),
    ]);
    const context = contextOf(book);
    assert.deepEqual(describeSessions(sessionsBetween(context, d('2026-10-13'), d('2026-10-13'))), [
      '2026-10-13 a1 g-2 td',
    ]);
    assert.deepEqual(describeSessions(sessionsBetween(context, d('2026-12-15'), d('2026-12-15'))), [
      '2026-12-15 a1 g-2 td',
    ]);
    assert.deepEqual(describeSessions(sessionsBetween(context, d('2026-10-04'), d('2026-10-06'))), [
      '2026-10-04 m1 g-all lesson teacher',
      '2026-10-05 m2 g-all lesson teacher',
      '2026-10-06 a1 g-1 td teacher',
    ]);
    assert.equal(rollCallUnits(context, 'k-1am2', d('2026-10-04'), d('2026-10-08')).length, 5);
  });

  it('generates nothing outside the school year', async () => {
    const context = contextOf(await openBook(cemEvents()));
    assert.deepEqual(sessionsBetween(context, d('2026-09-01'), d('2026-09-19')), []);
    assert.deepEqual(sessionsBetween(context, d('2027-06-13'), d('2027-06-30')), []);
  });
});
