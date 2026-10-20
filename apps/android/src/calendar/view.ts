// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  addDays,
  appliesTo,
  classGrades,
  compareDays,
  eachDay,
  forGrade,
  validLunarConfirmation,
  replacesReceived,
  monthRange,
  startOfWeek,
  type CalendarEntry,
  type Day,
  type Weekday,
} from '@minhajna/core';
import type { AppData } from '../storage/AppData';

/** Where an entry is actually kept, not a claim about its issuer or signature. */
export type CalendarOrigin = 'bundled' | 'local';
/** An entry's origin keeps two entries with the same ID distinguishable. */
export interface CalendarRow {
  readonly entry: CalendarEntry;
  readonly origin: CalendarOrigin;
  /** A historical local confirmation whose reference changed; it has no calendar effect. */
  readonly inactive?: true;
}

/** Only entries that cover this school and, for grade-specific dates, one of its saved classes. */
export function schoolEntries(data: Pick<AppData, 'calendar' | 'state' | 'year'>, schoolId: string): CalendarRow[] {
  const school = data.state.schools.get(schoolId);
  if (school === undefined) return [];
  const classes = [...data.state.classes.values()].filter((one) => one.schoolId === schoolId);
  const rows: CalendarRow[] = [
    ...data.calendar
      .filter((entry) => !data.state.calendar.some((own) => validLunarConfirmation(own, entry)))
      .map((entry) => ({ entry, origin: 'bundled' as const })),
    ...data.state.calendar
      .filter((entry) => !data.calendar.some((base) => replacesReceived(base, entry)))
      .map((entry) => ({
        entry,
        origin: 'local' as const,
        ...(entry.confirmedFrom !== undefined &&
          !data.calendar.some((base) => validLunarConfirmation(entry, base)) && { inactive: true as const }),
      })),
  ];
  return rows
    .filter(
      ({ entry }) =>
        entry.from <= data.year.to &&
        entry.to >= data.year.from &&
        (entry.grades === undefined
          ? appliesTo(entry, school)
          : classes.some((one) => classGrades(one).some((grade) => appliesTo(entry, school, forGrade(one, grade))))),
    )
    .sort(
      (a, b) =>
        compareDays(a.entry.from, b.entry.from) ||
        a.entry.id.localeCompare(b.entry.id) ||
        a.origin.localeCompare(b.origin),
    );
}

/** A month includes entries that start earlier or end later, not only entries beginning in it. */
export function inMonth(rows: readonly CalendarRow[], month: string): CalendarRow[] {
  const { from, to } = monthRange(month);
  return rows.filter(({ entry }) => entry.from <= to && entry.to >= from);
}

/** Month navigation uses civil days only, including leap years and year boundaries. */
export function adjacentMonth(month: string, step: -1 | 1): string {
  const { from, to } = monthRange(month);
  return addDays(step === -1 ? from : to, step).slice(0, 7);
}

/** Complete rows of seven civil dates, beginning on the country's first weekday. */
export function calendarWeeks(month: string, first: Weekday): Day[][] {
  const { from, to } = monthRange(month);
  const days = eachDay(startOfWeek(from, first), addDays(startOfWeek(to, first), 6));
  return Array.from({ length: days.length / 7 }, (_, index) => days.slice(index * 7, index * 7 + 7));
}
