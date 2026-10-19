// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll-call book's yearly summary (R-3.4-21, R-3.4-29): each month's
// totals from the school year's first month to its last, and the year's.
// The paper book runs from September to June. The calendar's year runs to
// the teachers' last day, in July, so a month after June is shown only
// when the class has a roll call taken in it: a normal year ends in June,
// and nothing taken is left out (answers 253 and 255).

import type { Context } from './context.ts';
import { addDays, compareDays, isWithin, monthOf, monthRange, type Day } from './day.ts';
import { countRollCalls, type CountingRules, type RollCallCounts } from './roll-call-counts.ts';
import { current } from './state.ts';

export interface MonthCounts {
  /** The month, written YYYY-MM. */
  readonly month: string;
  readonly counts: RollCallCounts;
}

export interface YearCounts {
  readonly months: readonly MonthCounts[];
  /** The whole school year's totals, the months' added up. */
  readonly year: RollCallCounts;
}

/** The calendar's months for the school year, written YYYY-MM, its first to its last. */
export function schoolMonths(context: Context): string[] {
  const { year } = context.ref;
  const months: string[] = [];
  for (let month = monthOf(year.from); compareDays(monthRange(month).from, year.to) <= 0;) {
    months.push(month);
    month = monthOf(addDays(monthRange(month).to, 1));
  }
  return months;
}

const NONE: RollCallCounts = { pupils: [], units: 0, untaken: 0, conflicts: [] };

/**
 * A class's totals for each month of the school year, and for the year, up
 * to `through` when given, such as today: a month after it counts nothing,
 * so a roll call not taken yet is never counted.
 */
export function countYear(context: Context, classId: string, rules?: CountingRules, through?: Day): YearCounts {
  const { year } = context.ref;
  const end = through === undefined || compareDays(through, year.to) > 0 ? year.to : through;
  const counted = (from: Day, to: Day) => {
    const first = compareDays(from, year.from) < 0 ? year.from : from;
    const last = compareDays(to, end) > 0 ? end : to;
    return compareDays(first, last) > 0 ? NONE : countRollCalls(context, classId, first, last, rules);
  };
  const june = `${year.to.slice(0, 4)}-06`;
  const taken = new Set<string>();
  for (const versions of context.state.rollCalls.values()) {
    const rollCall = current(versions);
    if (rollCall?.classId === classId && isWithin(rollCall.day, year.from, end)) taken.add(monthOf(rollCall.day));
  }
  const shown = schoolMonths(context).filter((month) => month <= june || taken.has(month));
  const lastShown = shown.at(-1);
  return {
    months: shown.map((month) => {
      const { from, to } = monthRange(month);
      return { month, counts: counted(from, to) };
    }),
    year: lastShown === undefined ? NONE : counted(year.from, monthRange(lastShown).to),
  };
}
