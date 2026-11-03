// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The exams of a demo world that thresholds are formed for (#601, §7.10, answer
// 631), each with the level that sets it, its first and last days, the grades
// that sit it, its figures day and its signing deadline, so both move with the
// exam. The figures day is the Thursday ten days before the week of its first
// day, a week earlier while that Thursday is outside the terms or a national
// day without school, since figures do not move while no one teaches, or the
// year's first day when none is left; the signing deadline, five days before
// its first day, may fall on any day, since a cut is signed on a phone. The
// school exams are the calendar's term exam windows, in any layer, each set by
// every school: for each term, a grade's window runs from the first day of the
// term's exam entries that cover it to the last, and the grades with the same
// window sit one exam, an entry naming levels rather than grades covering each
// grade of those levels, one naming both read by its grades, and a zone layer's
// or a school layer's own entry making an exam of that zone's or school's. An
// exam's ID, never shown, names its term and place, and what it covers when the
// place holds other exams that term, so it stays as entries are reordered or
// added elsewhere; a new window at the same place and term renames that term's
// exams there, which are then other exams. A demo world adds two made-up exams
// of its own, worked out from its calendar and never from real reference data:
// the directorate's unified mock exam for the CEM's last grade, on the Sunday
// four weeks before the week of that grade's term 3 exams, and the BEM, on the
// first Sunday of June, each three days long within term 3, moved a week,
// earlier for the mock exam and later for the BEM, while one of its days is
// outside the terms, a national day without school or a day of an exam that
// grade sits, the mock exam's among them for the BEM, and left out when no week
// is left. An exam entry with neither grades nor levels covers everyone, which
// an exam's empty lists say too.

import { addDays, compareDays, isWithin, parseDay, startOfWeek, type Day } from './day.ts';
import type { CalendarEntry, SchoolYear } from './reference.ts';

/** The level that sets an exam. */
export type ExamLevel = 'school' | 'directorate' | 'national';

export interface WorldExam {
  /** Such as `term-1`, `term-3-4am`, `term-2-zone-16-1am`, `mock` or `bem`. */
  readonly id: string;
  readonly setBy: ExamLevel;
  readonly term: number;
  readonly from: Day;
  /** The last day, included. */
  readonly to: Day;
  /** The grades that sit it, and the levels whose every grade does; both empty for everyone. */
  readonly grades: readonly string[];
  readonly levels: readonly string[];
  /** For a zone's or a school's own exam window: that zone or school. */
  readonly zone?: string;
  readonly schoolId?: string;
  /** The day its figures are taken. */
  readonly figuresDay: Day;
  /** The last day a cut may be signed. */
  readonly signBy: Day;
}

/** How many days before an exam's week its figures are taken, and before its first day its cut signed at the latest. */
export const FIGURES_DAYS_BEFORE = 10;
export const SIGN_DAYS_BEFORE = 5;
/** The CEM's last grade, which sits the directorate's mock exam and the BEM. */
export const MOCK_GRADE = '4am';
const MOCK_LEVEL = 'cem';
const SUNDAY = 0;
const WEEK = 7;
const MOCK_WEEKS = 4;
const LAST_DAYS = 2;
const EVERY = '*';
const LEVEL = 'level:';

type Closed = (day: Day) => boolean;

/** Whether a day is outside the terms, or a national entry without school, for everyone, covers it. */
function closedOn(year: SchoolYear, entries: readonly CalendarEntry[]): Closed {
  const off = entries.filter(
    (entry) =>
      entry.layer === 'national' &&
      entry.effect === 'no-school' &&
      entry.grades === undefined &&
      entry.levels === undefined,
  );
  return (day) =>
    !year.terms.some((term) => isWithin(day, term.from, term.to)) ||
    off.some((entry) => isWithin(day, entry.from, entry.to));
}

/** A day moved by whole weeks, back or forward, until `open` holds; null once it leaves the span. */
function weekWhere(day: Day, step: -1 | 1, span: { from: Day; to: Day }, open: (day: Day) => boolean): Day | null {
  let at = day;
  while (isWithin(at, span.from, span.to)) {
    if (open(at)) return at;
    at = addDays(at, step * WEEK);
  }
  return null;
}

function exam(
  closed: Closed,
  year: SchoolYear,
  made: { id: string; setBy: ExamLevel; term: number; from: Day; to: Day; grades: readonly string[] },
) {
  const thursday = addDays(startOfWeek(made.from, SUNDAY), -FIGURES_DAYS_BEFORE);
  const figuresDay = weekWhere(thursday, -1, year, (day) => !closed(day)) ?? year.from;
  return { ...made, levels: [] as string[], figuresDay, signBy: addDays(made.from, -SIGN_DAYS_BEFORE) };
}

/** What an exam entry covers: its zone or school, by its layer, and each grade, or each level, or everyone. */
function coverage(entry: CalendarEntry): { place: [string, string]; items: string[] } {
  const items = entry.grades ?? entry.levels?.map((level) => `${LEVEL}${level}`) ?? [EVERY];
  const zone = entry.layer === 'zone' ? (entry.zone ?? '') : '';
  const school = entry.layer === 'school' ? (entry.schoolId ?? '') : '';
  return { place: [zone, school], items: [...items] };
}

/** An exam's ID: its term and place, and what it covers when its place holds more than one exam that term. */
function examId(term: number, zone: string, school: string, items: readonly string[] | null): string {
  const named = (items ?? []).map((item) => (item === EVERY ? 'all' : item.replace(LEVEL, ''))).sort();
  const place = [zone === '' ? [] : ['zone', zone], school === '' ? [] : ['school', school]].flat();
  return ['term', String(term), ...place, ...named].join('-');
}

/** The school exams of a calendar's term exam windows, by term, place and window. */
function schoolExams(entries: readonly CalendarEntry[], year: SchoolYear, closed: Closed): WorldExam[] {
  const windows = new Map<string, { term: number; from: Day; to: Day }>();
  for (const entry of entries) {
    if (entry.effect !== 'exam' || entry.term === undefined) continue;
    const { place, items } = coverage(entry);
    for (const item of items) {
      const key = JSON.stringify([entry.term, ...place, item]);
      const held = windows.get(key);
      windows.set(key, {
        term: entry.term,
        from: held === undefined || compareDays(entry.from, held.from) < 0 ? entry.from : held.from,
        to: held === undefined || compareDays(entry.to, held.to) > 0 ? entry.to : held.to,
      });
    }
  }
  const grouped = new Map<
    string,
    { term: number; from: Day; to: Day; zone: string; school: string; items: string[] }
  >();
  for (const [key, window] of windows) {
    const [, zone, school, item] = JSON.parse(key) as [number, string, string, string];
    const at = JSON.stringify([window.term, zone, school, window.from, window.to]);
    const held = grouped.get(at) ?? { ...window, zone, school, items: [] };
    grouped.set(at, { ...held, items: [...held.items, item] });
  }
  const found = [...grouped.values()];
  return found.map((one) => {
    const levels = one.items.filter((item) => item.startsWith(LEVEL)).map((item) => item.slice(LEVEL.length));
    const every = one.items.includes(EVERY);
    const grades = every ? [] : one.items.filter((item) => !item.startsWith(LEVEL)).sort();
    const shared = found.filter(
      (other) => other.term === one.term && other.zone === one.zone && other.school === one.school,
    );
    const id = examId(one.term, one.zone, one.school, shared.length > 1 ? one.items : null);
    const made = exam(closed, year, { id, setBy: 'school', term: one.term, from: one.from, to: one.to, grades });
    return {
      ...made,
      levels: every ? [] : levels.sort(),
      ...(one.zone === '' ? {} : { zone: one.zone }),
      ...(one.school === '' ? {} : { schoolId: one.school }),
    };
  });
}

/** Every exam of a demo world's calendar, in order of their first days, then of their IDs. */
export function worldExams(year: SchoolYear, entries: readonly CalendarEntry[]): WorldExam[] {
  const closed = closedOn(year, entries);
  const school = schoolExams(entries, year, closed);
  const sits = (one: WorldExam) =>
    (one.grades.length === 0 && one.levels.length === 0) ||
    one.grades.includes(MOCK_GRADE) ||
    one.levels.includes(MOCK_LEVEL);
  const taken = school.filter(sits);
  const third = year.terms.find((term) => term.number === 3);
  const open = (avoid: readonly WorldExam[]) => (from: Day) =>
    third !== undefined &&
    compareDays(addDays(from, LAST_DAYS), third.to) <= 0 &&
    [0, 1, LAST_DAYS].every((at) => {
      const day = addDays(from, at);
      return !closed(day) && !avoid.some((one) => isWithin(day, one.from, one.to));
    });
  const made = (id: string, setBy: ExamLevel, week: Day | undefined, step: -1 | 1, avoid: readonly WorldExam[]) => {
    const from = week === undefined || third === undefined ? null : weekWhere(week, step, third, open(avoid));
    const days = from === null ? null : { id, setBy, term: 3, from, to: addDays(from, LAST_DAYS) };
    return days === null ? [] : [exam(closed, year, { ...days, grades: [MOCK_GRADE] })];
  };
  const last = taken
    .filter((one) => one.term === 3 && one.zone === undefined && one.schoolId === undefined)
    .sort((a, b) => compareDays(a.from, b.from))[0];
  const mockWeek = last && addDays(startOfWeek(last.from, SUNDAY), -MOCK_WEEKS * WEEK);
  const june = startOfWeek(addDays(parseDay(`${year.to.slice(0, 4)}-06-01`), WEEK - 1), SUNDAY);
  const mock = made('mock', 'directorate', mockWeek, -1, taken);
  const bem = made('bem', 'national', june, 1, [...taken, ...mock]);
  return [...school, ...mock, ...bem].sort((a, b) => compareDays(a.from, b.from) || (a.id < b.id ? -1 : 1));
}

/** The exams a class of a grade, at a level, in a zone and a school, sits. */
export function examsFor(
  exams: readonly WorldExam[],
  place: { readonly grade: string; readonly level: string; readonly zone?: string; readonly schoolId?: string },
): WorldExam[] {
  return exams.filter((one) => {
    const everyone = one.grades.length === 0 && one.levels.length === 0;
    const sits = everyone || one.grades.includes(place.grade) || one.levels.includes(place.level);
    const here =
      (one.zone === undefined || one.zone === place.zone) &&
      (one.schoolId === undefined || one.schoolId === place.schoolId);
    return sits && here;
  });
}
