// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a committee's page says of the figures (#604, #605, answers 549, 638 and
// 639): the term ends before the figures day, the last two after the first
// term's, whose end is no announced day and has no totals, which it reads for
// comparison; the chart of the share of the grade's classes that reached each
// item of the plan on the figures day and on each term end shown, an end not
// added up or hidden left out; the last item of the plan every class reached,
// nine classes in ten and half of them, of the items shown, a hidden item never
// counting; and, for the nation, each item's range across the wilayas: from the
// lowest wilaya's share to the highest and the middle half, at the nearest
// ranks as N-Totals takes them so that every figure is a real wilaya's, of the
// wilayas whose grade and item are shown and hold a class, an item with fewer
// than 8 held back, never naming or ranking a wilaya.

import {
  compareDays,
  RANGE_WILAYAS,
  type CommitteeState,
  type Day,
  type SchoolYear,
  type WorldExam,
} from '@minhajna/core';
import type { TFunction } from 'i18next';
import type { DirectorateFigures, GradeFigure } from '../directorate/totals-read';
import type { ChartSpec } from '../drawing/drawing-kit';
import { gradeShown, totalsSpec } from './exam-totals';

/** How many term ends a committee's chart compares with. */
const COMPARED = 2;
const RANGES = ['low', 'middleLow', 'middleHigh', 'high'] as const;

/** The last two term ends with totals before a day, in order. */
export function termEndsBefore(year: Pick<SchoolYear, 'terms'>, day: Day): Day[] {
  return year.terms
    .slice(1)
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

/** A subject's committee on the general list, its cut never named. */
export function statusText(
  t: TFunction,
  state: CommitteeState | undefined,
  exam: Pick<WorldExam, 'signBy'>,
  date: Day,
  seats: number,
): string {
  if (state === undefined) return '';
  if (state.adopted !== null) return t('demo.committee.status.adopted');
  if (compareDays(date, exam.signBy) > 0) return t('demo.committee.status.lapsed');
  if (state.proposed === null) return t('demo.committee.status.none');
  return t('demo.committee.status.proposed', { count: state.proposed.seats.length, seats });
}

/** Each item's range across the wilayas, in whole figures of the wilayas shown; null held back. */
export interface WilayaRange {
  readonly low: readonly (number | null)[];
  readonly high: readonly (number | null)[];
  readonly middleLow: readonly (number | null)[];
  readonly middleHigh: readonly (number | null)[];
}

/** The range across the wilayas of the share of each item, or null when no item shows one. */
export function wilayaRange(
  wilayas: readonly DirectorateFigures[],
  subject: string,
  grade: string,
  items: readonly string[],
): WilayaRange | null {
  const grades = wilayas
    .map((one) => gradeShown(one, subject, grade))
    .flatMap((one) => (typeof one === 'object' && one.classes > 0 ? [one] : []));
  const shares = items.map((id) =>
    grades
      .flatMap((one) => {
        const found = one.items.find(([item]) => item === id);
        if (found?.[1] === null) return [];
        return [Math.round(((found?.[1] ?? 0) * 1000) / one.classes) / 10];
      })
      .sort((a, b) => a - b),
  );
  const at = (rank: (last: number) => number) =>
    shares.map((all) => (all.length < RANGE_WILAYAS ? null : all[rank(all.length - 1)]));
  if (shares.every((all) => all.length < RANGE_WILAYAS)) return null;
  return {
    low: at(() => 0),
    high: at((last) => last),
    middleLow: at((last) => Math.floor(last / 4)),
    middleHigh: at((last) => Math.ceil((3 * last) / 4)),
  };
}

/** The chart of the share of the classes that reached each item, on the figures day and on the term ends shown. */
export function committeeSpec(
  t: TFunction,
  shown: { readonly grade: GradeFigure; readonly day: string },
  ends: readonly { readonly grade: GradeFigure; readonly day: string }[],
  items: readonly string[],
  item: (id: string) => string,
  range: WilayaRange | null = null,
): Omit<ChartSpec, 'rightToLeft'> {
  const spec = (grade: GradeFigure, day: string) => totalsSpec(t, grade, items, item, day);
  const series = (grade: GradeFigure, key: 'figures' | 'termEnd', day: string) => ({
    name: t(`demo.committee.series.${key}`, { day }),
    values: spec(grade, day).series[0].values,
  });
  return {
    kind: 'line',
    label: t(ends.length === 0 ? 'demo.committee.chart' : 'demo.committee.chartEnds', { day: shown.day }),
    categories: items.map(item),
    series: [
      series(shown.grade, 'figures', shown.day),
      ...ends.map((end) => series(end.grade, 'termEnd', end.day)),
      ...(range === null ? [] : RANGES.map((key) => ({ name: t(`demo.committee.series.${key}`), values: range[key] }))),
    ],
  };
}
