// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Leaving a school for another (#567, PRD §5.7, R-5.7-06, R-5.7-07, answer
// 589). A move follows the official assignment list, whose years run from 1
// September to 31 August: membership of the school a teacher leaves lasts to
// the last day of the school year's August, the new school's begins the next
// day, and its classes come from the next year's assignments. The teacher
// keeps a full copy of their lesson records, and the school keeps its own.

import { addDays, parseDay, type Day } from './day.ts';

/** When a move between schools takes effect, for a school year written as `2026-2027`. */
export interface LeavingDates {
  /** The last day of membership of the school left. */
  readonly until: Day;
  /** The first day at the new school. */
  readonly from: Day;
  /** The school year the new school's classes come from. */
  readonly next: string;
}

/** The dates of a move at the end of a school year, or null for a year not written as two following years. */
export function leavingDates(year: string): LeavingDates | null {
  const found = /^(\d{4})-(\d{4})$/u.exec(year);
  if (found === null || Number(found[2]) !== Number(found[1]) + 1) return null;
  const until = parseDay(`${found[2]}-08-31`);
  return { until, from: addDays(until, 1), next: `${found[2]}-${Number(found[2]) + 1}` };
}
