// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The distributions as «التوزيعات» shows them for one class and subject (#237,
// Dist, answers 416 (7), 421 to 424): the annual one by sequence with its
// months and sessions, the monthly one by teaching week of the month shown with
// its resources, and the termly one by term with its sequences, its months and
// its sessions. A plan by weeks heads its first column by its weeks. The months
// to step through run from the school year's first day to its last.

import {
  annualDistribution,
  monthlyDistribution,
  monthOf,
  parseDay,
  termlyDistribution,
  type Day,
  type DistributionSession,
} from '@minhajna/core';
import {
  daysSpan,
  distContext,
  monthsSpan,
  sequenceName,
  termName,
  type plannedCourses,
} from '../documents/dist-pages';
import type { DocumentData, Translate } from '../documents/document-data';

export type DistTab = 'year' | 'month' | 'term';

/** A table as the screen draws it: its column heads, and each row's cells, a cell's lines split by a line break. */
export interface DistTable {
  readonly heads: readonly [string, string, string];
  readonly rows: readonly { readonly key: string; readonly cells: readonly [string, string, string] }[];
}

/** The tab's table for a class and subject, over its sessions of the year, for `month` in the monthly tab. */
export function distTable(
  data: DocumentData,
  t: Translate,
  tab: DistTab,
  { course, pack }: ReturnType<typeof plannedCourses>[number],
  sessions: readonly DistributionSession[],
  month: string,
): DistTable {
  const context = distContext(data);
  const byWeeks = pack.anchor.kind === 'weeks' && !pack.items.some((item) => item.kind === 'unit');
  const sessionsHead = t('distributions.columns.sessions');
  if (tab === 'month') {
    return {
      heads: [t('distributions.columns.week'), t('distributions.columns.resources'), sessionsHead],
      rows: monthlyDistribution(context, course.id, month, sessions).map((week) => ({
        key: week.week,
        cells: [
          daysSpan(data, t, week.from, week.to),
          week.resources.map((one) => one.title).join('\n'),
          String(week.sessions),
        ],
      })),
    };
  }
  if (tab === 'term') {
    return {
      heads: [t('distributions.columns.term'), t('distributions.columns.period'), sessionsHead],
      rows: termlyDistribution(context, course.id, sessions).map((term) => ({
        key: String(term.term),
        cells: [
          [termName(t, term.term), ...term.sequences.map((one) => sequenceName(t, one))].join('\n'),
          monthsSpan(data, t, term.from, term.to),
          String(term.sessions),
        ],
      })),
    };
  }
  return {
    heads: [
      t(`distributions.columns.${byWeeks ? 'week' : 'sequence'}`),
      t('distributions.columns.period'),
      sessionsHead,
    ],
    rows: annualDistribution(context, course.id, sessions).map((row) => ({
      key: row.id,
      cells: [sequenceName(t, row), monthsSpan(data, t, row.from, row.to), String(row.sessions)],
    })),
  };
}

function nextMonth(month: string): string {
  const [year, index] = month.split('-').map(Number) as [number, number];
  return index === 12 ? `${year + 1}-01` : `${year}-${String(index + 1).padStart(2, '0')}`;
}

/** The first day of each month of the school year to step through, the year's own first day for its first month. */
export function yearMonths(data: Pick<DocumentData, 'year'>): Day[] {
  const { from, to } = data.year;
  const months: Day[] = [from];
  for (let month = nextMonth(monthOf(from)); month <= monthOf(to); month = nextMonth(month)) {
    months.push(parseDay(`${month}-01`));
  }
  return months;
}

/** The month a day shows, kept within the school year. */
export function shownMonth(data: Pick<DocumentData, 'year'>, day: Day): Day {
  const months = yearMonths(data);
  return months.filter((one) => one <= day).at(-1) ?? months[0];
}
