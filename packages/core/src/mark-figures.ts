// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The figures marks are read with (#239, answers 439, 440 and 442): a course's
// tests by day, and those of a term, the one whose dates hold the day; the list
// of pupils a test is for, those of its group enrolled on its day; the term's
// exam window, from the course's own grade's calendar, and the list of pupils
// sitting it, the class's, or the level's in a joint class, enrolled on its
// first day; F, the mean of the tests the pupil sat while on their list, so a
// mark typed for a pupil not on it stays out until cleared; and the attendance
// component proposed from the roll-call book's own totals for the period, under
// the teacher's counting rules, so the proposal and the printed book agree: its
// points times the share of the half-days the pupil could attend and did not
// miss without a justification, rounded down to a quarter point.

import { termNumberOn } from './assessment.ts';
import type { Context } from './context.ts';
import { compareDays, type Day } from './day.ts';
import { courseWindows } from './exam-duties.ts';
import { courseGrade, levelGroups } from './joint.ts';
import { marksFor } from './marks.ts';
import { compareSlots, wholeGroup } from './records.ts';
import type { CalendarEntry } from './reference.ts';
import { countRollCalls } from './roll-call-counts.ts';
import { pupilsOn } from './roll-call.ts';
import type { ScheduledTest } from './test-schedule.ts';

/** A course's tests, by day, then slot. */
export function courseTests(context: Context, courseId: string): ScheduledTest[] {
  return [...context.state.tests.values()]
    .filter((test) => test.courseId === courseId)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : compareSlots(a.slot, b.slot)));
}

/** The course's tests whose day falls in the term, by day. */
export function termTests(context: Context, courseId: string, term: number): ScheduledTest[] {
  return courseTests(context, courseId).filter((test) => termNumberOn(context.ref.year, test.day) === term);
}

/** The pupils a test is for, in list order: its group's, enrolled on its day. */
export function testList(context: Context, test: ScheduledTest): string[] {
  const course = context.state.courses.get(test.courseId);
  if (course === undefined) return [];
  return pupilsOn(context, course.classId, test.groupId, test.day).map((pupil) => pupil.id);
}

/** A course's exam window in a term; null when the calendar has none. */
export function termExams(context: Context, courseId: string, term: number): CalendarEntry | null {
  const windows = courseWindows(context, courseId).filter((entry) => entry.term === term);
  return windows.sort((a, b) => compareDays(a.from, b.from))[0] ?? null;
}

/** The pupils sitting a course's exam, in list order: its class's, or its level's, enrolled on `day`. */
export function examList(context: Context, courseId: string, day: Day): string[] {
  const course = context.state.courses.get(courseId);
  const room = course && context.state.classes.get(course.classId);
  if (course === undefined || room === undefined) return [];
  const group = levelGroups(room).find((one) => one.grade === courseGrade(course, room)) ?? wholeGroup(room);
  return pupilsOn(context, room.id, group.id, day).map((pupil) => pupil.id);
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
