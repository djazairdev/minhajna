// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the roll-call book's Month screen shows (#217, Month and Month-year):
// the school year's months up to today; for a month, a column for each day
// the class had a roll call due, up to today (answer 258), and a row for each
// pupil the class page lists, with each half-day missed as the paper book
// writes it: «-» a morning, «ǀ» an afternoon, «+» a whole day, in brackets
// when justified, and «+م½» for a whole day with one half justified (answers
// 253 and 258). The totals count half-days, as the core does.

import {
  DEFAULT_COUNTING,
  compareDays,
  countRollCalls,
  countYear,
  current,
  groupPupils,
  isWithin,
  maxDay,
  monthOf,
  monthRange,
  parseDay,
  rollCallUnits,
  schoolMonths,
  wholeGroup,
  type AbsenceMark,
  type Context,
  type Day,
  type MonthCounts,
  type PupilCount,
  type RollCallCounts,
  type RollCallUnit,
} from '@minhajna/core';
import { listNumbers } from '../roll/roll-rules';

/** A day of the month with the roll calls it gives the class. */
export interface BookDay {
  readonly day: Day;
  readonly units: readonly RollCallUnit[];
}

/** A pupil's row: their list number, name, the mark on each day shown, and their month's count. */
export interface BookRow {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly marks: ReadonlyMap<Day, string>;
  readonly count: PupilCount | null;
}

export interface MonthView {
  readonly days: readonly BookDay[];
  readonly rows: readonly BookRow[];
  /** The day counting starts on, when the teacher's rules start it inside the month; no mark shows before it. */
  readonly countsFrom: Day | null;
}

export interface YearRow {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  /** The pupil's count in each month, in the year's order, null when none was possible. */
  readonly months: readonly (PupilCount | null)[];
  readonly year: PupilCount | null;
}

export interface YearView {
  readonly months: readonly MonthCounts[];
  readonly rows: readonly YearRow[];
}

/** The school year's months from its first to `today`'s, or its first alone before the year starts. */
export function bookMonths(context: Context, today: Day): string[] {
  const months = schoolMonths(context);
  const shown = months.filter((month) => month <= monthOf(today));
  return shown.length === 0 ? months.slice(0, 1) : shown;
}

/** The days of `month` the roll-call book covers: within the school year and up to `today`. */
function monthSpan(context: Context, month: string, today: Day): { from: Day; to: Day } | null {
  const { year } = context.ref;
  const range = monthRange(month);
  const from = maxDay(range.from, year.from);
  const ends = [range.to, year.to, today];
  const to = ends.reduce((last, day) => (compareDays(day, last) < 0 ? day : last));
  return compareDays(from, to) > 0 ? null : { from, to };
}

/** A day's mark from its half-days missed, as the paper book writes it, or null when none was. */
export function dayMark(absences: readonly Pick<AbsenceMark, 'half' | 'justified'>[]): string | null {
  const morning = absences.find((absence) => absence.half === 'morning');
  const afternoon = absences.find((absence) => absence.half === 'afternoon');
  const bracket = (symbol: string, justified: boolean) => (justified ? `(${symbol})` : symbol);
  if (morning !== undefined && afternoon !== undefined) {
    if (morning.justified && afternoon.justified) return '(+)';
    return morning.justified || afternoon.justified ? '+م½' : '+';
  }
  if (morning !== undefined) return bracket('-', morning.justified);
  if (afternoon !== undefined) return bracket('ǀ', afternoon.justified);
  return null;
}

/**
 * The pupils of the course's group, in the class list's order: those on its
 * list on `day`, and those who left but have a count in `counts`.
 */
function bookPupils(context: Context, classId: string, groupId: string, day: Day, counts: readonly PupilCount[]) {
  const numbers = listNumbers(context, classId);
  const schoolClass = context.state.classes.get(classId);
  const whole = schoolClass === undefined ? groupId : wholeGroup(schoolClass).id;
  const listed = new Set(groupPupils(context, classId, groupId, day).map((pupil) => pupil.id));
  const counted = new Set(counts.filter((count) => count.possible > 0).map((count) => count.pupilId));
  return [...context.state.pupils.values()]
    .filter(
      (pupil) =>
        pupil.classId === classId &&
        (listed.has(pupil.id) || (counted.has(pupil.id) && (groupId === whole || pupil.groups.includes(groupId)))),
    )
    .map((pupil) => ({ id: pupil.id, number: numbers.get(pupil.id) ?? 0, name: pupil.name }));
}

/** The month's counts so far, up to `today`, or none before the month starts. */
export function monthCounts(context: Context, classId: string, month: string, today: Day): RollCallCounts | null {
  const span = monthSpan(context, month, today);
  return span === null ? null : countRollCalls(context, classId, span.from, span.to);
}

/** The month for the course's group: its days so far and each pupil's marks and count. */
export function monthView(context: Context, classId: string, groupId: string, month: string, today: Day): MonthView {
  const span = monthSpan(context, month, today);
  const rules = context.state.counting ?? DEFAULT_COUNTING;
  const counts = monthCounts(context, classId, month, today)?.pupils ?? [];
  const units = span === null ? [] : rollCallUnits(context, classId, span.from, span.to);
  const keys = new Set(units.map((unit) => unit.key));
  for (const [key, versions] of span === null ? [] : context.state.rollCalls) {
    const taken = current(versions);
    if (taken === null || keys.has(key) || taken.classId !== classId) continue;
    if (span === null || !isWithin(taken.day, span.from, span.to)) continue;
    const { groupId: group, day, half } = taken;
    units.push({ key, classId, groupId: group, day, half, sessions: [] });
  }
  const days = new Map<Day, RollCallUnit[]>();
  for (const unit of units) days.set(unit.day, [...(days.get(unit.day) ?? []), unit]);
  const byPupil = new Map(counts.map((count) => [count.pupilId, count]));
  const last = span?.to ?? parseDay(`${month}-01`);
  const rows = bookPupils(context, classId, groupId, last, counts).map((pupil) => {
    const count = byPupil.get(pupil.id) ?? null;
    const marks = new Map<Day, string>();
    for (const day of new Set(count?.absences.map((absence) => absence.day))) {
      const mark = dayMark(count?.absences.filter((absence) => absence.day === day) ?? []);
      if (mark !== null) marks.set(day, mark);
    }
    return { ...pupil, marks, count };
  });
  return {
    days: [...days].sort(([a], [b]) => compareDays(a, b)).map(([day, dayUnits]) => ({ day, units: dayUnits })),
    rows,
    countsFrom: span !== null && rules.from !== undefined && compareDays(rules.from, span.from) > 0 ? rules.from : null,
  };
}

/** The yearly summary for the course's group, each month counted up to `today` (answer 255). */
export function yearView(context: Context, classId: string, groupId: string, today: Day): YearView {
  const summary = countYear(context, classId, undefined, today);
  const of = (counts: RollCallCounts, pupilId: string) => {
    const count = counts.pupils.find((one) => one.pupilId === pupilId);
    return count === undefined || count.possible === 0 ? null : count;
  };
  const rows = bookPupils(context, classId, groupId, today, summary.year.pupils).map((pupil) => ({
    ...pupil,
    months: summary.months.map(({ counts }) => of(counts, pupil.id)),
    year: of(summary.year, pupil.id),
  }));
  return { months: summary.months, rows };
}

/** The sum of the rows' counts: possible, absent and present half-days, and late arrivals. */
export function totals(counts: readonly (PupilCount | null)[]) {
  const sum = (pick: (count: PupilCount) => number) => counts.reduce((all, one) => all + (one ? pick(one) : 0), 0);
  const possible = sum((count) => count.possible);
  const absent = sum((count) => count.absent);
  return {
    possible,
    absent,
    present: sum((count) => count.present),
    late: sum((count) => count.late.length),
    rate: possible === 0 ? null : (possible - absent) / possible,
  };
}

/** A rate as the book prints it: a percentage to one decimal, without a trailing zero. */
export function percent(rate: number | null): string {
  return rate === null ? '' : String(Math.round(rate * 1000) / 10);
}

export type MarkKey =
  'morning' | 'afternoon' | 'day' | 'morningJustified' | 'afternoonJustified' | 'dayJustified' | 'dayHalf';

const MARK_KEYS: Record<string, MarkKey> = {
  '-': 'morning',
  ǀ: 'afternoon',
  '+': 'day',
  '(-)': 'morningJustified',
  '(ǀ)': 'afternoonJustified',
  '(+)': 'dayJustified',
  '+م½': 'dayHalf',
};

/** The text key that says a day's mark in words. */
export function markKey(mark: string): MarkKey {
  return MARK_KEYS[mark] ?? 'day';
}
