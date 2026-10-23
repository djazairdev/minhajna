// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The figures marks are read with (#239, answers 439, 440 and 442): the
// list of pupils a test is for, those of its group enrolled on its day; F,
// the mean of the tests the pupil sat while on their list, so a mark typed
// for a pupil not on it stays out until cleared; and the attendance
// component proposed from the roll-call book's own totals for the period,
// under the teacher's counting rules, so the proposal and the printed book
// agree: its points times the share of the half-days the pupil could attend
// and did not miss without a justification, rounded down to a quarter
// point.

import type { Context } from './context.ts';
import type { Day } from './day.ts';
import { marksFor } from './marks.ts';
import { countRollCalls } from './roll-call-counts.ts';
import { pupilsOn } from './roll-call.ts';
import type { ScheduledTest } from './test-schedule.ts';

/** The pupils a test is for, in list order: its group's, enrolled on its day. */
export function testList(context: Context, test: ScheduledTest): string[] {
  const course = context.state.courses.get(test.courseId);
  if (course === undefined) return [];
  return pupilsOn(context, course.classId, test.groupId, test.day).map((pupil) => pupil.id);
}

/** F: the mean of the pupil's marks in the tests given, where they were on the list; null when they sat none. */
export function testMean(
  context: Context,
  term: number,
  tests: readonly ScheduledTest[],
  pupilId: string,
): number | null {
  const sat = tests
    .filter((test) => testList(context, test).includes(pupilId))
    .map((test) => marksFor(context.state, test.courseId, term, { kind: 'test', testId: test.id }).get(pupilId))
    .filter((value): value is number => typeof value === 'number');
  return sat.length === 0 ? null : sat.reduce((sum, value) => sum + value, 0) / sat.length;
}

export interface Attendance {
  /** The half-days the pupil could attend, as the roll-call book counts them. */
  readonly possible: number;
  readonly unjustified: number;
  readonly justified: number;
  /** Late arrivals, shown but never deducted. */
  readonly late: number;
  /** The component's proposed mark; null when no half-day counts. */
  readonly proposed: number | null;
}

/** The attendance component proposed from the roll-call book, with the counts it comes from. */
export function attendanceProposal(
  context: Context,
  classId: string,
  pupilId: string,
  from: Day,
  to: Day,
  points: number,
): Attendance {
  const count = countRollCalls(context, classId, from, to).pupils.find((one) => one.pupilId === pupilId);
  const possible = count?.possible ?? 0;
  const unjustified = count?.unjustified ?? 0;
  const proposed = possible === 0 ? null : Math.floor((points * (possible - unjustified) * 4) / possible + 1e-9) / 4;
  return { possible, unjustified, justified: count?.justified ?? 0, late: count?.late.length ?? 0, proposed };
}
