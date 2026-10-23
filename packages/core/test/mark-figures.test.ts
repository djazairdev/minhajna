// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The figures marks are read with (#239, answers 439, 440 and 442): a
// test's list, its group's pupils enrolled on its day; F, the mean of the
// tests sat while on the list, a mark typed for a pupil not on it left out;
// and the attendance component proposed from the roll-call book's own
// totals, justified absences counting as attended, roll calls of the other
// half group left out, a corrected roll call read as corrected, and the
// teacher's counting rules applied. Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  attendanceProposal,
  countRollCalls,
  DEFAULT_COUNTING,
  joinPupil,
  rollCallUnits,
  setMark,
  takeRollCall,
  testList,
  testMean,
  type MarkValue,
  type ScheduledTest,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const scheduled = (id: string, day: string, groupId = 'g-all'): ScheduledTest => ({
  id,
  courseId: 'c-math',
  day: d(day),
  slot: { half: 'morning', index: 1 },
  groupId,
  title: id,
});

const mark = (testId: string, pupilId: string, value: MarkValue) =>
  setMark({ courseId: 'c-math', term: 1, target: { kind: 'test', testId }, pupilId }, value, 20);

test('F is the mean of the tests the pupil sat while on their list', async () => {
  const book = await openBook(cemEvents());
  const joining = { id: 'p11', classId: 'k-1am2', name: 'Made-up Pupil', sex: 'f', reason: 'transfer' } as const;
  await book.record(d('2026-11-15'), joinPupil(contextOf(book), { ...joining, day: d('2026-11-15') }));
  const tests = [scheduled('t-1', '2026-11-08'), scheduled('t-2', '2026-11-22'), scheduled('t-3', '2026-11-24', 'g-1')];
  assert.deepEqual(
    tests.map((one) => testList(contextOf(book), one)),
    [
      ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10'],
      ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10', 'p11'],
      ['p01', 'p02', 'p03', 'p04', 'p05'],
    ],
  );
  for (const event of [
    mark('t-1', 'p01', 12),
    mark('t-2', 'p01', 15.5),
    mark('t-3', 'p01', 'absent'),
    mark('t-1', 'p02', 'absent'),
    mark('t-2', 'p02', 9),
    mark('t-1', 'p03', 'absent'),
    mark('t-1', 'p06', 14),
    mark('t-3', 'p06', 4),
    mark('t-1', 'p11', 18),
    mark('t-2', 'p11', 10),
  ]) {
    await book.record(d('2026-11-24'), event);
  }
  const mean = (pupilId: string) => testMean(contextOf(book), 1, tests, pupilId);
  assert.deepEqual(['p01', 'p02', 'p03', 'p04', 'p06', 'p11'].map(mean), [13.75, 9, null, null, 14, 10]);
  assert.equal(testMean(contextOf(book), 2, tests, 'p01'), null);
});

test('attendance is proposed from the roll-call book’s own totals', async () => {
  const book = await openBook(cemEvents());
  const units = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-10-01'));
  const marks = new Map([
    ['2026-09-20', { absent: [{ pupilId: 'p01', justified: false }], late: [] }],
    ['2026-09-21', { absent: [{ pupilId: 'p01', justified: true }], late: [] }],
    ['2026-09-22', { absent: [], late: ['p01'] }],
    ['2026-09-29', { absent: [{ pupilId: 'p06', justified: false }], late: [] }],
    ['2026-10-01', { absent: [{ pupilId: 'p01', justified: false }], late: [] }],
  ]);
  for (const unit of units) {
    await book.record(unit.day, takeRollCall(contextOf(book), unit, marks.get(unit.day) ?? { absent: [], late: [] }));
  }
  const proposal = (pupilId: string, from = '2026-09-20') =>
    attendanceProposal(contextOf(book), 'k-1am2', pupilId, d(from), d('2026-09-30'), 3);
  assert.deepEqual(proposal('p01'), { possible: 8, unjustified: 1, justified: 1, late: 1, proposed: 2.5 });
  assert.deepEqual(proposal('p06'), { possible: 8, unjustified: 1, justified: 0, late: 0, proposed: 2.5 });
  assert.deepEqual(proposal('p02'), { possible: 8, unjustified: 0, justified: 0, late: 0, proposed: 3 });
  assert.deepEqual(proposal('p01', '2026-10-04'), {
    possible: 0,
    unjustified: 0,
    justified: 0,
    late: 0,
    proposed: null,
  });

  const fixed = units.find((unit) => unit.day === d('2026-09-22'));
  assert.ok(fixed);
  const absent = { absent: [{ pupilId: 'p01', justified: false }], late: [] };
  await book.record(d('2026-09-23'), takeRollCall(contextOf(book), fixed, absent, 'arrived-late'));
  assert.deepEqual(proposal('p01'), { possible: 8, unjustified: 2, justified: 1, late: 0, proposed: 2.25 });

  await book.record(d('2026-09-23'), { kind: 'counting.set', rules: { ...DEFAULT_COUNTING, from: d('2026-09-22') } });
  assert.deepEqual(proposal('p01'), { possible: 6, unjustified: 1, justified: 0, late: 0, proposed: 2.5 });
  const counted = countRollCalls(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-30')).pupils;
  assert.equal(counted.find((one) => one.pupilId === 'p01')?.possible, 6);
});
