// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Hijri months a span of days falls in, such as «ربيع الأول – ربيع
// الثاني 1448» for September 2026, which the roll-call book prints beside
// each month (R-3.4-25, answer 253). The months come from a table of the
// Umm al-Qura calendar, shipped as reference data, so nothing is computed
// and nothing needs the network. Algeria fixes each month by sighting the
// moon, a day earlier or later at most; the months a Gregorian month is
// said to span rarely change with it.

import { compareDays, type Day } from './day.ts';
import type { MonthNames } from './reference.ts';

/** A Hijri month, and the Gregorian day it starts on. */
export interface HijriMonth {
  readonly year: number;
  /** 1 for Muharram to 12 for Dhu al-Hijjah. */
  readonly month: number;
  readonly start: Day;
}

/** The table: the months' names, Muharram first, and each month's start, in order. */
export interface HijriTable {
  readonly release: string;
  readonly names: readonly MonthNames[];
  readonly months: readonly HijriMonth[];
}

/** The index of the month `day` falls in: the last to start on or before it, or -1. */
function startedBy(months: readonly HijriMonth[], day: Day): number {
  let index = -1;
  months.forEach((month, at) => {
    if (compareDays(month.start, day) <= 0) index = at;
  });
  return index;
}

/**
 * The Hijri months the days from `from` to `to` fall in, in order. Null when
 * the table does not reach that far back or ahead, so that nothing is
 * guessed.
 */
export function hijriMonths(table: HijriTable, from: Day, to: Day): readonly HijriMonth[] | null {
  const { months } = table;
  const first = startedBy(months, from);
  const last = startedBy(months, to);
  if (first === -1 || last === months.length - 1) return null;
  return months.slice(first, last + 1);
}

/**
 * The months said, such as «ربيع الأول – ربيع الثاني 1448», or «ذو الحجة
 * 1447 – محرم 1448» across two years. Null outside the table.
 */
export function hijriLabel(table: HijriTable, from: Day, to: Day, language: keyof MonthNames): string | null {
  const months = hijriMonths(table, from, to);
  const first = months?.[0];
  const last = months?.[months.length - 1];
  if (first === undefined || last === undefined) return null;
  const name = (month: HijriMonth) => table.names[month.month - 1]?.[language] ?? '';
  if (first === last) return `${name(first)} ${first.year}`;
  return first.year === last.year
    ? `${name(first)} – ${name(last)} ${last.year}`
    : `${name(first)} ${first.year} – ${name(last)} ${last.year}`;
}
