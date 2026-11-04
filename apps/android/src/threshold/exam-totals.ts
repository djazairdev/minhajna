// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the teacher's page of a directorate exam's totals reads (#602, answer
// 634): the exam on the teacher's list, with its chart of the teacher's classes
// in the subject and grade (own-exams.ts); then, from the totals, the subject
// and grade's figure, which is not there yet when the day is not added up or no
// share holds that subject or grade, or hidden when the server hid the subject
// or the grade under the floors; and its chart, the share of the grade's
// classes that reached each item of the teacher's plan, in the plan's order, as
// a percentage to one decimal, an item no class reached at 0 and a hidden item
// held back. Items of other packs the server names are left out, as the plan
// cannot place them, while the grade's classes count every class of it, so in a
// grade whose classes pin several packs the shares come out low, a known limit
// of the demo, whose grades pin one pack.

import type { Day, DemoSchool, WeekRecord } from '@minhajna/core';
import type { TFunction } from 'i18next';
import type { TermReference } from '../director/seeded-fill';
import type { DirectorateFigures, GradeFigure } from '../directorate/totals-read';
import type { ChartSpec } from '../drawing/drawing-kit';
import { ownExams } from './own-exams';
import { roomId } from './threshold-text';

/** A directorate exam on the teacher's list, with the teacher's classes in the room's subject and grade. */
export function totalsExam(
  weeks: readonly WeekRecord[],
  school: DemoSchool,
  reference: TermReference,
  date: Day,
  room: string,
) {
  for (const { exam, charts } of ownExams(weeks, school, reference, date)) {
    const chart = charts.find((one) => exam.setBy === 'directorate' && roomId(one) === room);
    if (chart !== undefined) return { exam, chart };
  }
  return undefined;
}

/** A subject and grade's figure, or why there is none to show. */
export type GradeShown = GradeFigure | 'notYet' | 'hidden';

/** The subject and grade's figure in a directorate's figures, which are null when not added up yet. */
export function gradeShown(figures: DirectorateFigures | null, subject: string, grade: string): GradeShown {
  const found = figures?.subjects.find(([code]) => code === subject);
  if (found === undefined) return 'notYet';
  if (found[1] === null) return 'hidden';
  const one = found[1].grades.find(([code]) => code === grade);
  if (one === undefined) return 'notYet';
  return one[1] ?? 'hidden';
}

/** The share of the grade's classes that reached an item, to one decimal, null when its count is held back. */
export function shareOf(grade: GradeFigure, item: string): number | null {
  const count = new Map(grade.items).get(item);
  if (count === null) return null;
  return grade.classes === 0 ? 0 : Math.round(((count ?? 0) * 1000) / grade.classes) / 10;
}

/** The share of the grade's classes that reached each item of the plan, in its order. */
export function totalsSpec(
  t: TFunction,
  grade: GradeFigure,
  items: readonly string[],
  item: (id: string) => string,
  day: string,
): Omit<ChartSpec, 'rightToLeft'> {
  const share = (id: string) => shareOf(grade, id);
  return {
    kind: 'bar',
    label: t('demo.examTotals.chart', { day }),
    categories: items.map(item),
    series: [{ name: t('demo.examTotals.share'), values: items.map(share) }],
  };
}
