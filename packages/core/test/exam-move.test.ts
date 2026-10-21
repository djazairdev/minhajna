// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// An exam window moved by a signed update (#223, R-7.10-06, answers 322 to
// 325): the term check carries its first dates and why it moved, counts
// the plan items that no longer fit before it and the sessions after it,
// and a move announced less than two weeks ahead is said to be late, by the
// release that made it. Made-up classes and dates.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  announcedLate,
  makeContext,
  movePublished,
  newMove,
  parseCalendarUpdate,
  termCheck,
  CALENDAR_UPDATE_FORMAT,
  type CalendarEntry,
  type CalendarUpdate,
  type RecordEvent,
} from '../src/index.ts';
import { cemEvents, d, openBook, reference } from './fixtures.ts';

const ref = { ...reference, calendarRelease: '2026.3' };
const exams = ref.calendar.find((entry) => entry.id === 'exams-1')!;
const moved = (from: string, to: string, release = '2026.5', published = '2026-09-21'): CalendarUpdate => {
  const read = parseCalendarUpdate(
    {
      format: CALENDAR_UPDATE_FORMAT,
      version: { major: 1, minor: 0 },
      country: 'dz',
      year: '2026-2027',
      release,
      published,
      entries: [
        {
          ...exams,
          from,
          to,
          source: 'Made-up notice',
          confidence: 'announced',
          moved: { from: exams.from, to: exams.to, reason: 'Made-up reason' },
        },
      ],
      removed: [],
    },
    ref.country,
    ref.year,
  );
  if (!read.ok) throw new Error(JSON.stringify(read.problems));
  return read.value;
};
const applied = (update: CalendarUpdate): RecordEvent => ({
  kind: 'calendar.updated',
  applied: { update, key: 'example-ministry', file: '{}' },
});

test('the term check follows a moved exam window, with its first dates and the items it pushes past', async () => {
  const book = await openBook(cemEvents());
  const before = termCheck(makeContext(ref, book.state), 'c-math', d('2026-09-20'))!;
  assert.equal(before.moved, null);
  assert.equal(before.itemsAfter, 0);
  await book.record(d('2026-09-21'), applied(moved('2026-09-29', '2026-10-01')));
  const after = termCheck(makeContext(ref, book.state), 'c-math', d('2026-09-20'))!;
  assert.equal(after.before, d('2026-09-29'));
  assert.deepEqual(after.moved, { from: exams.from, to: exams.to, reason: 'Made-up reason' });
  assert.ok(after.gives < after.needs, `${after.gives} < ${after.needs}`);
  assert.ok(after.itemsAfter > 0);
  assert.ok(after.itemsAfter <= before.needs);
  assert.ok(after.afterExams! > before.afterExams!, `${after.afterExams} > ${before.afterExams}`);
  const late = termCheck(makeContext(ref, book.state), 'c-math', d('2026-09-29'), 1)!;
  assert.equal(late.gives, 0);
  assert.equal(late.itemsAfter, 0);
});

test('a later release that keeps the same move does not make it news again, nor change when it was announced', async () => {
  const book = await openBook(cemEvents());
  const first = moved('2026-10-04', '2026-10-06');
  await book.record(d('2026-09-21'), applied(first));
  const again = moved('2026-10-04', '2026-10-06', '2026.6', '2026-09-30');
  await book.record(d('2026-09-30'), applied(again));
  assert.equal(movePublished(makeContext(ref, book.state), 'exams-1'), d('2026-09-21'));
  const entry = again.entries[0]!;
  assert.equal(newMove({ kind: 'changed', entry, before: first.entries[0]! }), false);
  assert.equal(newMove({ kind: 'changed', entry, before: exams }), true);
  assert.equal(newMove({ kind: 'added', entry }), true);
  assert.equal(movePublished(makeContext(ref, book.state), 'winter'), undefined);
});

test('a move announced less than two weeks before the new first day is late, and only for an exam window', () => {
  const entry = moved('2026-10-04', '2026-10-06').entries[0]!;
  assert.equal(announcedLate(entry, d('2026-09-21')), true);
  assert.equal(announcedLate(entry, d('2026-09-20')), false);
  assert.equal(announcedLate({ ...entry, effect: 'closure' }, d('2026-09-21')), false);
  const still: Record<string, unknown> = { ...entry };
  delete still['moved'];
  assert.equal(announcedLate(still as unknown as CalendarEntry, d('2026-09-21')), false);
});

test('an exam window in two parts is checked from its first part, with the moved part and the sessions after the last', async () => {
  const book = await openBook(cemEvents());
  const whole = termCheck(makeContext(ref, book.state), 'c-math', d('2026-09-20'))!;
  const update = moved('2026-12-13', '2026-12-14');
  const part = { ...update.entries[0]!, id: 'exams-1-part-2' };
  await book.record(d('2026-09-21'), applied({ ...update, entries: [part] }));
  const check = termCheck(makeContext(ref, book.state), 'c-math', d('2026-09-20'))!;
  assert.equal(check.before, exams.from);
  assert.deepEqual(check.moved, part.moved);
  assert.ok(check.afterExams! < whole.afterExams!, `${check.afterExams} < ${whole.afterExams}`);
});
