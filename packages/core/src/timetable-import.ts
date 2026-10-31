// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reading a school's timetable from its template (#574, PRD §7.4, R-7.4-08,
// R-7.4-10, answer 585): a CSV file, as Excel saves it, a row for each weekly
// session: the class, and the group when only part of it comes, the subject,
// the teacher, the day, the start and end times, the room, and the week when
// sessions alternate, A or B. A row in the first five, after any title, names
// the columns in any order, in any of the app's languages, as the day and week
// cells are, so the core holds no language's words; an unknown header cell is
// said without stopping the reading. Names are compared word by word
// (name-replace.ts), so two spellings of a name are one. Each row is checked
// against every row before it that reads: a teacher, a class or a room in two
// places at once is a clash, said on the row that makes it, with the row it
// meets. A group meets the whole class, its own group, and a group within it or
// that it is within, as G1 1/2 or G1-2 is within G1; a session of week A never
// meets one of week B. Rows giving one teacher, subject, time, week and room
// are one session taught to several classes together, as option languages often
// are, and said so the preparer can check them, since two classes booked at
// once with no room read the same; a place that holds several sessions at once,
// such as the yard, is left without a room. Every problem is said with its row,
// as a spreadsheet numbers it, and its row is left out while the rest are read.
// FET's export takes the same checks (timetable-fet.ts). Minhajna reads the
// timetable and never builds one (R-7.4-09).

import type { Weekday } from './day.ts';
import { nameKey } from './name-replace.ts';

/** The columns of the template; the group, the room and the week may be left out. */
export const TIMETABLE_COLUMNS = [
  'class',
  'group',
  'subject',
  'teacher',
  'day',
  'start',
  'end',
  'room',
  'week',
] as const;
export type TimetableColumn = (typeof TIMETABLE_COLUMNS)[number];

const REQUIRED: readonly TimetableColumn[] = ['class', 'subject', 'teacher', 'day', 'start', 'end'];

/** Which weeks a session comes in: every week, or only week A or week B. */
export type TimetableWeek = 'both' | 'A' | 'B';

/** The words the app's languages use in the template, each list in any letter case. */
export interface TimetableWords {
  readonly columns: Readonly<Record<TimetableColumn, readonly string[]>>;
  readonly days: Readonly<Partial<Record<Weekday, readonly string[]>>>;
  readonly weeks: Readonly<Record<'A' | 'B', readonly string[]>>;
}

/** A session the template gives, with the row it came from. */
export interface ImportedSession {
  readonly row: number;
  readonly class: string;
  /** Empty for the whole class. */
  readonly group: string;
  readonly subject: string;
  readonly teacher: string;
  /** Empty when the template gives none. */
  readonly room: string;
  readonly day: Weekday;
  /** Minutes from midnight. */
  readonly start: number;
  readonly end: number;
  readonly week: TimetableWeek;
}

/**
 * What is wrong with a row: a cell, or a clash with an earlier row, each leaving the row out, or the header. Only an
 * unknown header cell, `column-unknown`, leaves every row in: a notice for the screen to show, not a stop.
 */
export type ImportProblem =
  | { readonly row: number; readonly kind: 'columns'; readonly missing: readonly TimetableColumn[] }
  | { readonly row: number; readonly kind: 'column-twice'; readonly column: TimetableColumn }
  | { readonly row: number; readonly kind: 'column-unknown'; readonly value: string }
  | { readonly row: number; readonly kind: 'empty'; readonly column: TimetableColumn }
  | { readonly row: number; readonly kind: 'day' | 'time' | 'week'; readonly value: string }
  | { readonly row: number; readonly kind: 'order' }
  | { readonly row: number; readonly kind: 'teacher' | 'class' | 'room'; readonly with: number };

export interface TimetableImport {
  readonly sessions: readonly ImportedSession[];
  readonly problems: readonly ImportProblem[];
  /** Each kept row read as taught together with an earlier one, and that row, for the preparer to check. */
  readonly together: readonly { readonly row: number; readonly with: number }[];
}

/** How many rows may come before the header, such as a title. */
const ROWS_BEFORE_HEADER = 4;

/** A cell as the template compares it: without format marks, word by word as names are compared (`nameKey`). */
const key = (cell: string) =>
  cell
    .replace(/\p{Cf}/gu, '')
    .trim()
    .split(/\s+/u)
    .map(nameKey)
    .join(' ');

/** A name as the timetable compares it, so two spellings of one class, group or teacher are one. */
export const timetableNameKey = key;

/** Whether a group is the other or within it: its name, then a space, - or _ and more, as G1 1/2 or G1-2. */
export function groupWithin(group: string, outer: string): boolean {
  const [inner, around] = [key(group), key(outer)];
  return inner.startsWith(around) && (inner.length === around.length || /^[\s_-]/u.test(inner.slice(around.length)));
}

/** Each word's key and what it names. Throws when one word names two things, a mistake in the app's words. */
function lookup<T>(entries: readonly (readonly [T, readonly string[]])[]): ReadonlyMap<string, T> {
  const found = new Map<string, T>();
  for (const [value, list] of entries)
    for (const word of list) {
      const known = found.get(key(word));
      if (known !== undefined && known !== value) throw new RangeError(`One word names two things: ${word}`);
      found.set(key(word), value);
    }
  return found;
}

/** A cell with its Arabic-Indic and Persian digits written in Latin ones. */
export const latinDigits = (cell: string) =>
  cell.replace(/[\u0660-\u0669\u06F0-\u06F9]/gu, (digit) => String(digit.charCodeAt(0) % 16));

/**
 * The minutes from midnight of a time written H:MM, HH:MM, HhMM or H.MM, with or without :00 seconds, in Latin or
 * Arabic-Indic digits, or null.
 */
export function readTime(cell: string): number | null {
  const digits = latinDigits(cell.trim());
  const found = /^(\d{1,2})[:hH.](\d{2})(?::00)?$/u.exec(digits);
  if (found === null) return null;
  const [hours, minutes] = [Number(found[1]), Number(found[2])];
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/** Whether two sessions take the same time: the same day, overlapping times, and weeks that meet. */
function sameTime(one: ImportedSession, other: ImportedSession): boolean {
  const weeks = one.week === 'both' || other.week === 'both' || one.week === other.week;
  return weeks && one.day === other.day && one.start < other.end && other.start < one.end;
}

/** Whether two rows are one session taught to several classes together: one teacher, subject, time, week and room. */
function together(one: ImportedSession, other: ImportedSession): boolean {
  const rooms = one.room === '' || other.room === '' || key(one.room) === key(other.room);
  const same = (field: 'teacher' | 'subject') => key(one[field]) === key(other[field]);
  const time = one.day === other.day && one.start === other.start && one.end === other.end && one.week === other.week;
  return same('teacher') && same('subject') && time && rooms;
}

/**
 * The clashes a session makes with the sessions before it, at most one of each kind, with the first row it meets: a
 * teacher or a room in two places, unless the rows are one session taught to several classes together, or a class
 * twice, unless they are two different groups of it, neither within the other.
 */
export function clashesOf(before: readonly ImportedSession[], session: ImportedSession): ImportProblem[] {
  const meets = before.filter((one) => sameTime(one, session));
  const first = (kind: 'teacher' | 'class' | 'room', test: (one: ImportedSession) => boolean): ImportProblem[] => {
    const found = meets.find(test);
    return found === undefined ? [] : [{ row: session.row, kind, with: found.row }];
  };
  const groups = (one: ImportedSession) =>
    one.group === '' ||
    session.group === '' ||
    groupWithin(one.group, session.group) ||
    groupWithin(session.group, one.group);
  return [
    ...first('teacher', (one) => key(one.teacher) === key(session.teacher) && !together(one, session)),
    ...first('class', (one) => key(one.class) === key(session.class) && groups(one)),
    ...first('room', (one) => session.room !== '' && key(one.room) === key(session.room) && !together(one, session)),
  ];
}

/** Each column's place in a header row, the problems that keep it from being read, and the cells it does not know. */
function headerOf(cells: readonly string[], columns: ReadonlyMap<string, TimetableColumn>, row: number) {
  const places = new Map<TimetableColumn, number>();
  const problems: ImportProblem[] = [];
  const unknown: ImportProblem[] = [];
  for (const [place, cell] of cells.entries()) {
    const column = columns.get(key(cell));
    if (column === undefined) {
      if (cell.trim() !== '') unknown.push({ row, kind: 'column-unknown', value: cell.trim() });
    } else if (places.has(column)) problems.push({ row, kind: 'column-twice', column });
    else places.set(column, place);
  }
  const missing = REQUIRED.filter((column) => !places.has(column));
  if (missing.length > 0) problems.push({ row, kind: 'columns', missing });
  return { places, problems, unknown };
}

/** The words of the template, looked up by their keys. */
interface Lookups {
  readonly columns: ReadonlyMap<string, TimetableColumn>;
  readonly days: ReadonlyMap<string, Weekday>;
  readonly weeks: ReadonlyMap<string, 'A' | 'B'>;
}

/** A row's session, or what is wrong with its cells. */
function sessionOf(
  cells: readonly string[],
  places: ReadonlyMap<TimetableColumn, number>,
  words: Lookups,
  row: number,
): ImportedSession | ImportProblem {
  const cell = (column: TimetableColumn) => {
    const place = places.get(column);
    return place === undefined ? '' : (cells[place] ?? '').trim();
  };
  const empty = REQUIRED.find((column) => cell(column) === '');
  if (empty !== undefined) return { row, kind: 'empty', column: empty };
  const day = words.days.get(key(cell('day')));
  if (day === undefined) return { row, kind: 'day', value: cell('day') };
  const [start, end] = [readTime(cell('start')), readTime(cell('end'))];
  if (start === null) return { row, kind: 'time', value: cell('start') };
  if (end === null) return { row, kind: 'time', value: cell('end') };
  if (end <= start) return { row, kind: 'order' };
  const weekCell = cell('week');
  const week = words.weeks.get(key(weekCell));
  if (weekCell !== '' && week === undefined) return { row, kind: 'week', value: weekCell };
  return {
    row,
    class: cell('class'),
    group: cell('group'),
    subject: cell('subject'),
    teacher: cell('teacher'),
    room: cell('room'),
    day,
    start,
    end,
    week: week ?? 'both',
  };
}

/**
 * Reads the template's rows, as `parseCsv` gives them. The header is the first of the first five rows that names every
 * column it must, so a title may come above it; each row after it is a session, checked against every row before it
 * that reads, and kept only when it clashes with none, so each clash is said in one reading. Rows with no cell filled
 * in are skipped. Rows are numbered from 1, as a spreadsheet numbers them. Throws when one of the app's words names
 * two columns, days or weeks.
 */
export function readTimetable(rows: readonly (readonly string[])[], words: TimetableWords): TimetableImport {
  const lookups: Lookups = {
    columns: lookup(TIMETABLE_COLUMNS.map((column) => [column, words.columns[column]] as const)),
    days: lookup(Object.entries(words.days).map(([day, list]) => [Number(day) as Weekday, list ?? []] as const)),
    weeks: lookup((['A', 'B'] as const).map((week) => [week, words.weeks[week]] as const)),
  };
  const tried = rows
    .slice(0, ROWS_BEFORE_HEADER + 1)
    .map((cells, index) => headerOf(cells, lookups.columns, index + 1));
  const at = tried.findIndex((one) => !one.problems.some((problem) => problem.kind === 'columns'));
  const header = tried[at];
  if (header === undefined)
    return { sessions: [], problems: (tried[0] ?? headerOf([], lookups.columns, 1)).problems, together: [] };
  if (header.problems.length > 0) return { sessions: [], problems: header.problems, together: [] };
  const read = rows.flatMap((cells, index) =>
    index <= at || cells.every((one) => one.trim() === '') ? [] : [sessionOf(cells, header.places, lookups, index + 1)],
  );
  const checked = checkSessions(read);
  return { ...checked, problems: [...header.unknown, ...checked.problems] };
}

/**
 * Checks sessions in their order, each against every one before it that reads, keeping it only when it clashes with
 * none, so each clash is said in one reading; a problem passed in is kept as it is. Lists the kept sessions taught
 * together with an earlier one.
 */
export function checkSessions<P extends { readonly row: number; readonly kind: string } = ImportProblem>(
  read: readonly (ImportedSession | P)[],
): Omit<TimetableImport, 'problems'> & { readonly problems: readonly (P | ImportProblem)[] } {
  const before: ImportedSession[] = [];
  const sessions: ImportedSession[] = [];
  const problems: (P | ImportProblem)[] = [];
  const joined: { row: number; with: number }[] = [];
  for (const session of read) {
    if ('kind' in session) {
      problems.push(session);
      continue;
    }
    const clashes = clashesOf(before, session);
    before.push(session);
    if (clashes.length > 0) {
      problems.push(...clashes);
      continue;
    }
    const partner = sessions.find((one) => together(one, session));
    if (partner !== undefined) joined.push({ row: session.row, with: partner.row });
    sessions.push(session);
  }
  return { sessions, problems, together: joined };
}

/** Reads a day's name in the app's words, in any letter case. Throws when one word names two days. */
export function dayReader(days: TimetableWords['days']): (cell: string) => Weekday | undefined {
  const found = lookup(Object.entries(days).map(([day, list]) => [Number(day) as Weekday, list ?? []] as const));
  return (cell) => found.get(key(cell));
}
