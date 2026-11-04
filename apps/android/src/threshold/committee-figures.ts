// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a committee's page says of the figures (#604, answer 638): the term ends
// before the figures day, the last two, which it reads for comparison; the
// chart of the share of the grade's classes that reached each item of the plan
// on the figures day and on each term end shown, an end not added up or hidden
// left out; and the last item of the plan every class reached, nine classes in
// ten and half of them, of the items shown, a hidden item never counting.

import type { Day, SchoolYear } from '@minhajna/core';
import type { TFunction } from 'i18next';
import type { GradeFigure } from '../directorate/totals-read';
import type { ChartSpec } from '../drawing/drawing-kit';
import { totalsSpec } from './exam-totals';

/** How many term ends a committee's chart compares with. */
const COMPARED = 2;

/** The last two term ends before a day, in order. */
export function termEndsBefore(year: Pick<SchoolYear, 'terms'>, day: Day): Day[] {
  return year.terms
    .map((term) => term.to)
    .filter((end) => end < day)
    .slice(-COMPARED);
}

/** The items a committee's page marks: each the last of the plan that share of the classes reached, or null. */
export interface GradeMarks {
  readonly every: string | null;
  readonly ninety: string | null;
  readonly half: string | null;
}

/** The last items of the plan every class, nine classes in ten and half of them reached. */
export function gradeMarks(grade: GradeFigure, items: readonly string[]): GradeMarks {
  const counts = new Map(grade.items);
  const last = (share: number) => {
    if (grade.classes === 0) return null;
    const reached = items.filter((id) => (counts.get(id) ?? 0) * 10 >= grade.classes * share);
    return reached.at(-1) ?? null;
  };
  return { every: last(10), ninety: last(9), half: last(5) };
}

/** The chart of the share of the classes that reached each item, on the figures day and on the term ends shown. */
export function committeeSpec(
  t: TFunction,
  shown: { readonly grade: GradeFigure; readonly day: string },
  ends: readonly { readonly grade: GradeFigure; readonly day: string }[],
  items: readonly string[],
  item: (id: string) => string,
): Omit<ChartSpec, 'rightToLeft'> {
  const spec = (grade: GradeFigure, day: string) => totalsSpec(t, grade, items, item, day);
  const series = (grade: GradeFigure, key: 'figures' | 'termEnd', day: string) => ({
    name: t(`demo.committee.series.${key}`, { day }),
    values: spec(grade, day).series[0].values,
  });
  return {
    kind: 'line',
    label: t('demo.committee.chart', { day: shown.day }),
    categories: items.map(item),
    series: [series(shown.grade, 'figures', shown.day), ...ends.map((end) => series(end.grade, 'termEnd', end.day))],
  };
}
