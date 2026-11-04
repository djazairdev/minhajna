// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The exams on a teacher's phone that it reads no room for (#601, #602, answers
// 632 to 634): the school's exams before their figures day, whose rooms are not
// open yet, and the directorate's and national exams, worked out on the phone
// from the teacher's own signed weeks and never sent: each school exam until
// its figures day and each other exam up to its last day, with, for each grade
// and subject the teacher signed weeks in for a class of the world's school
// that sits it, those classes' positions and forecasts as the school's charts
// give them (exam-charts.ts), taken on the day before the world's date before
// the figures day, so a week begun that day does not count before its days do,
// and on the figures day from then on, each class matched by its name key, its
// spellings together, and counted only when its teacher signed a week of it in
// that subject; an exam none of whose classes is the teacher's is left out.
// There is no cut on the phone for these exams: a school exam's comes with its
// room. Once an exam above the school is over, the teacher's classes in it are
// listed apart (overExams), for the committee's cut as published
// (over-cuts.ts).

import {
  addDays,
  compareDays,
  timetableNameKey,
  worldExams,
  type Day,
  type DemoSchool,
  type ExamChart,
  type WeekRecord,
  type WorldExam,
} from '@minhajna/core';
import type { StandingRecords } from '../director/course-standings';
import type { TermReference } from '../director/seeded-fill';
import { chartDrafts } from './exam-charts';

/** An exam above the school, the day its positions are taken, and its charts limited to the teacher's classes. */
export interface OwnExam {
  readonly exam: WorldExam;
  readonly asOf: Day;
  readonly charts: readonly Omit<ExamChart, 'world' | 'school' | 'setters'>[];
}

/** A teacher's signed weeks as the standings read them, by class and course. */
function recordsOf(weeks: readonly WeekRecord[]): StandingRecords[] {
  const classes = new Map<string, { name: string; courses: Map<string, { week: WeekRecord }[]> }>();
  for (const week of weeks) {
    const at = timetableNameKey(week.class);
    const one = classes.get(at) ?? { name: week.class, courses: new Map<string, { week: WeekRecord }[]>() };
    one.courses.set(week.course, [...(one.courses.get(week.course) ?? []), { week }]);
    classes.set(at, one);
  }
  return [...classes.values()].map(({ name, courses }) => ({
    class: name,
    courses: [...courses].map(([key, held]) => ({ key, weeks: held })),
  }));
}

/** The exams `shown` lets through, with the teacher's classes in each, the day before their figures day until it. */
function examsWith(
  weeks: readonly WeekRecord[],
  school: DemoSchool,
  reference: TermReference,
  date: Day,
  shown: (exam: WorldExam) => boolean,
): OwnExam[] {
  const taught = new Set(weeks.map((one) => `${timetableNameKey(one.class)}\n${one.totals.subject}`));
  const records = recordsOf(weeks);
  const { year, entries } = reference.calendar;
  const found: OwnExam[] = [];
  for (const exam of worldExams(year, entries)) {
    if (!shown(exam)) continue;
    const asOf = compareDays(date, exam.figuresDay) < 0 ? addDays(date, -1) : exam.figuresDay;
    const charts = chartDrafts(exam, school, records, reference, asOf)
      .map(({ chart }) => ({
        ...chart,
        classes: chart.classes.filter((one) => taught.has(`${timetableNameKey(one.name)}\n${chart.subject}`)),
      }))
      .filter((chart) => chart.classes.length > 0);
    if (charts.length > 0) found.push({ exam, asOf, charts });
  }
  return found;
}

/** The school's exams before their figures day and the others up to their last day, with the teacher's classes. */
export function ownExams(
  weeks: readonly WeekRecord[],
  school: DemoSchool,
  reference: TermReference,
  date: Day,
): OwnExam[] {
  return examsWith(weeks, school, reference, date, (exam) => {
    if (compareDays(date, exam.to) > 0) return false;
    return exam.setBy !== 'school' || compareDays(date, exam.figuresDay) < 0;
  });
}

/** The exams above the school that are over, with the teacher's classes. */
export function overExams(
  weeks: readonly WeekRecord[],
  school: DemoSchool,
  reference: TermReference,
  date: Day,
): OwnExam[] {
  return examsWith(weeks, school, reference, date, (exam) => exam.setBy !== 'school' && compareDays(date, exam.to) > 0);
}
