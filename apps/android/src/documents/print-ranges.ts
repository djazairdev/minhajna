// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which pages each document of the week's print set covers (#215,
// Print-set, R-3.8-55): what is new since its last print, a month, or the
// days between two dates, within the school year, and up to today for what
// is new. Each document goes by its own unit:
// - a day's document, the journals: each day with one of its own sessions,
//   a copy a day;
// - a month's, the roll-call and texts books: each month touched, a copy a
//   month, so a month printed part-way is offered again, as its later days
//   are new;
// - the year's, the front pages and the texts book's supervised lessons and
//   homework: the whole document, new until printed this school year;
// - the timetable: the version in force, new until a print holds it from the
//   day it applies, whatever was printed ahead. A version drawn again on its
//   own day after it was printed keeps its day, so the teacher picks it again
//   by hand.
// The cut-out strip prints on its own and is not in the set. The print's
// record keeps the days each document covered, so the next set starts after
// them, though never after the day of the print.

import {
  addDays,
  eachDay,
  lastPrinted,
  printedTo,
  maxDay,
  minDay,
  sessionsBetween,
  type Day,
  type PrintedDocument,
  type State,
} from '@minhajna/core';
import { coreContext } from '../storage/core-context';
import type { DocumentId } from './catalogue';
import type { DocumentData } from './document-data';
import { bySpecialist, specialistCourses } from './specialists';
import { bookCourses } from './texts-book-pages';
import { printedVersion } from './timetable-pages';

export type PrintUnit = 'day' | 'month' | 'year' | 'version';

/** Each document of the set and its unit; the cut-out strip is not one. */
export const PRINT_UNITS: Readonly<Partial<Record<DocumentId, PrintUnit>>> = {
  journal: 'day',
  'journal-front': 'year',
  'primary-journal': 'day',
  'primary-front': 'year',
  'specialist-journal': 'day',
  timetable: 'version',
  roll: 'month',
  texts: 'month',
  supervised: 'year',
  homework: 'year',
};

export type PrintRange =
  | { readonly kind: 'new' }
  /** Such as `2026-10`. */
  | { readonly kind: 'month'; readonly month: string }
  | { readonly kind: 'days'; readonly from: Day; readonly to: Day };

/** What a document covers: a copy's day for each copy, and the days the print's record keeps. */
export interface Covered {
  readonly days: readonly Day[];
  readonly printed: PrintedDocument;
}

const monthOf = (day: Day) => day.slice(0, 7);
const firstOf = (month: string) => `${month}-01` as Day;
const lastOf = (month: string) => addDays(firstOf(monthOf(addDays(firstOf(month), 31))), -1);

/** The courses whose sessions a journal prints: CEM and lycée, the class teacher's, or the specialist's. */
function journalCourses(data: DocumentData, id: DocumentId): ReadonlySet<string> {
  const courses =
    id === 'specialist-journal'
      ? specialistCourses(data)
      : bookCourses(data).filter(({ course, schoolClass }) =>
          id === 'journal'
            ? schoolClass.level !== 'primary'
            : schoolClass.level === 'primary' && !bySpecialist(data, course, schoolClass),
        );
  return new Set(courses.map(({ course }) => course.id));
}

/** The days with a session of the journal's own, from `from` to `to`. */
function sessionDays(data: DocumentData, id: DocumentId, from: Day, to: Day): Day[] {
  const courses = journalCourses(data, id);
  if (courses.size === 0) return [];
  const sessions = sessionsBetween(coreContext(data), from, to, courses).filter((session) => session.calendar === null);
  return [...new Set(sessions.map((session) => session.day))];
}

/** The first day of each month from `from` to `to`, kept within them. */
function months(from: Day, to: Day): Day[] {
  const firsts = [...new Set(eachDay(from, to).map(monthOf))].map(firstOf);
  return firsts.map((first) => maxDay(first, from));
}

/** The days the range holds, within the school year, and up to today for what is new; null when none. */
function span(data: DocumentData, state: Pick<State, 'prints'>, id: DocumentId, range: PrintRange): [Day, Day] | null {
  const { from: start, to: end } = data.year;
  const unit = PRINT_UNITS[id];
  const [from, to] =
    range.kind === 'month'
      ? [firstOf(range.month), lastOf(range.month)]
      : range.kind === 'days'
        ? [range.from, range.to]
        : [addDays(lastPrinted(state, id)?.through ?? addDays(start, -1), 1), data.day];
  if (from > to) return null;
  const first = maxDay(unit === 'month' && range.kind === 'new' ? firstOf(monthOf(from)) : from, start);
  const last = minDay(to, end);
  return first > last ? null : [first, last];
}

/** What `id` covers for `range` on `data.day`; null when it has nothing to print. */
export function covered(
  data: DocumentData,
  state: Pick<State, 'prints'>,
  id: DocumentId,
  range: PrintRange,
): Covered | null {
  const unit = PRINT_UNITS[id];
  if (unit === undefined) return null;
  if (unit === 'year' || unit === 'version') {
    const version = unit === 'version' ? printedVersion(data) : null;
    if (unit === 'version' && version === null) return null;
    const from = version?.from ?? data.year.from;
    const last = lastPrinted(state, id);
    const done = unit === 'version' ? printedTo(state, id, from) : last !== null && last.reached >= from;
    if (range.kind === 'new' && done) return null;
    return { days: [data.day], printed: { id, from, to: unit === 'version' ? from : maxDay(data.day, from) } };
  }
  const found = span(data, state, id, range);
  if (found === null) return null;
  const [from, to] = found;
  const days = unit === 'day' ? sessionDays(data, id, from, to) : months(from, to);
  if (days.length === 0) return null;
  return { days, printed: { id, from, to } };
}
