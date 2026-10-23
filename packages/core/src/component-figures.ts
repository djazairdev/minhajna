// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What component entry reads (#239, answers 442 and 451): the period a
// component's marks are for, the term or, in primary, one of the months it
// covers; the list of pupils, the course's, of its level only in a joint
// class, enrolled on the period's last day, on `today` while it runs, or on
// its first day before it starts; what was recorded that a component is set
// beside, chosen by its kind, so entry and the justification show the same;
// and a pupil's homework in the period: the pieces due for their group, and
// their tap on the session each came back in, so the counts never exceed
// what was due (answer 452).

import type { SetupLine } from './assessment.ts';
import { homeworkSession } from './capture-figures.ts';
import { sessionCaptures } from './captures.ts';
import type { Context } from './context.ts';
import { addDays, compareDays, isWithin, maxDay, minDay, monthOf, monthRange, type Day } from './day.ts';
import { coursePupils, homeworkRecord } from './homework.ts';
import { wholeGroup } from './records.ts';

export interface Period {
  readonly from: Day;
  readonly to: Day;
}

/** What a component is set beside: participation taps, homework, notebooks, attendance, or nothing. */
export type ComponentEvidence = 'participation' | 'homework' | 'notebook' | 'attendance' | null;

/** The months a term covers, as `2026-10`, in order. */
export function termMonths(context: Context, term: number): string[] {
  const dates = context.ref.year.terms.find((one) => one.number === term);
  if (dates === undefined) return [];
  const months: string[] = [];
  for (let day = dates.from; compareDays(day, dates.to) <= 0; day = addDays(monthRange(monthOf(day)).to, 1)) {
    months.push(monthOf(day));
  }
  return months;
}

/** A component's period: the term, or a month of it; null for a term the year has not. */
export function componentPeriod(context: Context, term: number, month?: string): Period | null {
  const dates = context.ref.year.terms.find((one) => one.number === term);
  if (dates === undefined) return null;
  if (month === undefined) return { from: dates.from, to: dates.to };
  const range = monthRange(month);
  const from = maxDay(dates.from, range.from);
  const to = minDay(dates.to, range.to);
  return compareDays(from, to) <= 0 ? { from, to } : null;
}

/** The day a period's list is read on: `today` within it, else its nearer end. */
export function listDay(period: Period, today: Day): Day {
  return minDay(maxDay(today, period.from), period.to);
}

/** The pupils a component's marks are for, in list order. */
export function componentList(context: Context, courseId: string, period: Period, today: Day): string[] {
  const course = context.state.courses.get(courseId);
  const room = course && context.state.classes.get(course.classId);
  if (course === undefined || room === undefined) return [];
  return coursePupils(context, course, wholeGroup(room).id, listDay(period, today));
}

/** What a setup line is set beside, by its kind; a column of the teacher's has nothing. */
export function componentEvidence(line: SetupLine): ComponentEvidence {
  if (line.kind === 'column') return null;
  if (line.id === 'participation') return 'participation';
  if (line.capture === 'homework') return 'homework';
  if (line.id === 'notebook' || line.id === 'notebooks') return 'notebook';
  if (line.capture === 'roll-call') return 'attendance';
  return null;
}

export interface HomeworkEvidence {
  /** The pieces of homework due for the pupil's group in the period. */
  readonly set: number;
  readonly notDone: number;
  readonly helped: number;
}

/** A pupil's homework in the period: what was due, and their tap on the session each came back in. */
export function homeworkEvidence(
  context: Context,
  courseId: string,
  pupilId: string,
  period: Period,
): HomeworkEvidence {
  const course = context.state.courses.get(courseId);
  const found = { set: 0, notDone: 0, helped: 0 };
  if (course === undefined) return found;
  for (const item of homeworkRecord(context, courseId)) {
    if (!isWithin(item.due, period.from, period.to)) continue;
    if (!coursePupils(context, course, item.session.groupId, item.due).includes(pupilId)) continue;
    found.set += 1;
    const read = homeworkSession(context, item);
    const tap = read === null ? undefined : sessionCaptures(context.state, read.session.key).get(pupilId)?.homework;
    if (tap === 1) found.notDone += 1;
    if (tap === 2) found.helped += 1;
  }
  return found;
}
