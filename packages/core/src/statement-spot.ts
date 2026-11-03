// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's spot check (#246, R-Spot, answers 489 and 491): three school
// days drawn at random from a statement's period, from the first day of the
// school year to the statement's day, so the days are not known before the
// visit. School days are the country's working days that the app's calendar
// keeps for the statement's level and grade; a reader knows no school, so only
// the national layer counts, with any Eid date the reader confirmed. A
// statement of another school year than the app's calendar, or dated before its
// first day, has no period. Nothing is kept. The draw, each candidate as likely
// as another, is the inspector's spot-check sheet's too (spot-sheet.ts).

import type { School, SchoolClass } from './records.ts';
import type { Context } from './context.ts';
import { compareDays, eachDay, weekday, type Day } from './day.ts';
import type { RandomBytes } from './id.ts';
import type { ProgressStatement } from './statement-read.ts';

/** How many days a spot check draws. */
export const SPOT_DAYS = 3;

/** A whole number below `bound`, from random bytes, with no bias. */
function below(bound: number, random: RandomBytes): number {
  const limit = Math.floor(0x1_0000_0000 / bound) * bound;
  for (;;) {
    const bytes = random(4);
    const value = ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
    if (value < limit) return value % bound;
  }
}

/** The statement's period, from the year's first day to its day; null for another school year. */
export function spotPeriod(context: Context, statement: ProgressStatement): { from: Day; to: Day } | null {
  const { year } = context.ref;
  if (statement.class.year !== year.id || compareDays(statement.day, year.from) < 0) return null;
  return { from: year.from, to: compareDays(statement.day, year.to) > 0 ? year.to : statement.day };
}

/** The period's school days for the statement's level and grade. */
export function spotSchoolDays(context: Context, statement: ProgressStatement): Day[] {
  const period = spotPeriod(context, statement);
  if (period === null) return [];
  const { level, grade, section, subject } = statement.class;
  const school: School = { id: '', name: '', levels: [level], subjects: [subject] };
  const schoolClass: SchoolClass = { id: '', schoolId: '', level, grade, name: section, groups: [] };
  const working = context.ref.country.workingDays;
  return eachDay(period.from, period.to).filter(
    (day) => working.includes(weekday(day)) && context.calendar.info(day, school, schoolClass).schoolDay,
  );
}

/** Up to `count` of the candidates, each once, drawn at random, each as likely as another, in order. */
export function drawSpotDays(candidates: readonly Day[], random: RandomBytes, count = SPOT_DAYS): Day[] {
  const days = [...new Set(candidates)];
  for (let at = 0; at < Math.min(count, days.length); at += 1) {
    const pick = at + below(days.length - at, random);
    [days[at], days[pick]] = [days[pick]!, days[at]!];
  }
  return days.slice(0, count).sort(compareDays);
}

/** Up to three of the period's school days, drawn at random, in order. */
export const spotDays = (context: Context, statement: ProgressStatement, random: RandomBytes): Day[] =>
  drawSpotDays(spotSchoolDays(context, statement), random);
