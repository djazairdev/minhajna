// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What closures took from each wilaya Obs-Report shows (#627, answer 680),
// worked out on the device from the world's public calendar, never from what
// teachers enter: the working days of the term a national or zone closure
// covers for the wilaya's classes of the pack's grade, half a day where it
// takes one half, in the calendar's own days, since a class's sessions a day
// are not the observatory's to know. One school's closure is no wilaya's, and a
// holiday is no school day to lose. Wilayas come in the reference data's order,
// those it does not hold after them by code, never by a figure, so the list
// ranks no one. Only the wilayas the server shows are ever asked for.

import {
  addDays,
  CalendarView,
  compareDays,
  weekday,
  type CountryProfile,
  type Day,
  type School,
  type SchoolClass,
  type SchoolCalendar,
} from '@minhajna/core';
import type { Figure } from './figures-read';

/** The day the IGP's 30 days to comment end, from the term's last day. */
export const commentsEnd = (termEnd: Day) => addDays(termEnd, 30);

/** Whether the world's date has passed the end of the IGP's 30 days. */
export const commentsOver = (termEnd: Day, date: Day) => compareDays(date, commentsEnd(termEnd)) > 0;

/** A shown wilaya's row. */
export interface ClosureRow {
  readonly code: string;
  /** The school days closures took in the term, in halves. */
  readonly days: number;
  readonly classes: number;
}

/** The world's public calendar, its national and zone layers alone. */
export function publicCalendar(calendar: SchoolCalendar, profile: CountryProfile): CalendarView {
  const entries = calendar.entries.filter((one) => one.layer === 'national' || one.layer === 'zone');
  return new CalendarView({ country: profile, year: calendar.year, calendar: entries, packs: new Map() }, []);
}

/**
 * The school days closures took in the term from a wilaya's classes of the grade. As the calendar reads a day, a
 * holiday of either half, or a lunar one still expected, leaves it no school day, so no closure on it counts.
 */
export function closureDays(
  view: CalendarView,
  profile: CountryProfile,
  term: { readonly from: Day; readonly to: Day },
  wilaya: string,
  grade: string,
): number {
  const level = profile.levels.find((one) => one.grades.some((each) => each.code === grade))?.code ?? '';
  const school: School = { id: '', name: '', levels: [level], subjects: [], zone: wilaya };
  const made = { id: '', level, grade } as SchoolClass;
  let days = 0;
  for (let day = term.from; compareDays(day, term.to) <= 0; day = addDays(day, 1)) {
    if (!profile.workingDays.includes(weekday(day)) || view.info(day, school, made).closure === null) continue;
    const morning = view.info(day, school, made, 'morning').closure !== null;
    const afternoon = view.info(day, school, made, 'afternoon').closure !== null;
    days += morning && afternoon ? 1 : 0.5;
  }
  return days;
}

/** Each wilaya shown with what closures took from it, in the reference data's order. */
export function closureRows(
  wilayas: readonly (readonly [string, Figure])[],
  calendar: SchoolCalendar,
  profile: CountryProfile,
  term: { readonly from: Day; readonly to: Day },
  grade: string,
): readonly ClosureRow[] {
  const place = (code: string) => {
    const at = profile.zones?.findIndex((zone) => zone.code === code) ?? -1;
    return at === -1 ? Infinity : at;
  };
  const view = publicCalendar(calendar, profile);
  return [...wilayas]
    .sort(([one], [other]) => (place(one) === place(other) ? (one < other ? -1 : 1) : place(one) - place(other)))
    .map(([code, figure]) => ({
      code,
      days: closureDays(view, profile, term, code, grade),
      classes: figure.classes,
    }));
}
