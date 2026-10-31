// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reading a school's timetable from FET's timetable CSV export (#575, PRD §7.4,
// R-7.4-08, R-7.4-10, answer 590) into the template's sessions, through the
// same checks (timetable-import.ts). The header is FET's own, in any order and
// letter case: the activity's ID, the day, the hour, the students sets, the
// subject, the teachers and the room, which may be missing; other columns, such
// as the activity tags, are not read. FET writes a row for each hour, so the
// rows of one activity on one day are one session, from the first hour's start
// to the last hour's end, said with the first row's number; its hours must
// follow one another among the hours the file and the bells name, each starting
// no sooner than the one before ends, and a row with no activity ID is a
// session of its own. Days are read in the app's words. An hour is named by its
// times, as 08:00-09:00, or, with the school's bell times, by its number, FET's
// default, or by its start. Students sets joined by + are one session for each,
// taught together by FET's own definition and so not listed for checking. The
// export drops FET's years, groups and subgroups, so a group is a guess, listed
// for the preparer to confirm, or to rename in FET and export again: a set
// named as another set of the file, then a space, a dash, a slash or an
// underscore, then one of the app's group words and a number, as 4AM2 G1, or a
// half, as 4AM2 1/2, so only beside its class's own set; any other set is a
// class, so a level beside its classes is not their parent. One teacher per
// session, as the template: an activity with teachers joined by + is said and
// left out. FET has no weeks A and B, so every session is weekly. Written from
// FET's documented format, with none of FET's code.

import type { Weekday } from './day.ts';
import {
  checkSessions,
  dayReader,
  latinDigits,
  readTime,
  type ImportedSession,
  type ImportProblem,
  type TimetableImport,
  type TimetableWords,
} from './timetable-import.ts';

/** The columns of FET's timetable export that are read; the room may be missing. */
export const FET_COLUMNS = ['activity id', 'day', 'hour', 'students sets', 'subject', 'teachers', 'room'] as const;
export type FetColumn = (typeof FET_COLUMNS)[number];

/** The app's words for FET's export: the days, and the words that mark a group, as `g` or `groupe`, in any case. */
export interface FetWords {
  readonly days: TimetableWords['days'];
  readonly groups: readonly string[];
}

/** What is wrong with an activity, as the template says it, or FET's own: its header, or several teachers. */
export type FetProblem =
  | ImportProblem
  | { readonly row: number; readonly kind: 'fet-columns'; readonly missing: readonly FetColumn[] }
  | { readonly row: number; readonly kind: 'teachers'; readonly value: string };

/** A students set read as a group of a class, for the preparer to confirm. */
export interface FetGroup {
  readonly set: string;
  readonly class: string;
  readonly group: string;
}

export interface FetImport extends Omit<TimetableImport, 'problems'> {
  readonly problems: readonly FetProblem[];
  readonly groups: readonly FetGroup[];
}

/** A school's bell times, each a start and an end in minutes from midnight, the first for hour 1. */
export type BellTimes = readonly (readonly [number, number])[];

/** The start and end of an hour named by its times, or by its number or its start in the bell times, or null. */
export function readFetHour(cell: string, bells: BellTimes = []): readonly [number, number] | null {
  const name = latinDigits(cell.trim());
  if (/^\d{1,2}$/u.test(name)) return bells[Number(name) - 1] ?? null;
  const start = readTime(name);
  if (start !== null) return bells.find((bell) => bell[0] === start) ?? null;
  const parts = name.split(/[-\u2013\u2014]/u).map((part) => part.trim());
  if (parts.length !== 2) return null;
  const [from, to] = [readTime(parts[0]!), readTime(parts[1]!)];
  return from !== null && to !== null && from < to ? [from, to] : null;
}

/** Each students set's class and group, the group's class found through any group it belongs to. */
function classesOf(sets: ReadonlySet<string>, marks: readonly string[]): ReadonlyMap<string, FetGroup> {
  const words = marks.map((mark) => mark.toLowerCase());
  const isMark = (rest: string) => {
    const text = latinDigits(rest).toLowerCase().trim();
    const word = /^(\D*)\d{1,2}$/u.exec(text)?.[1]?.trim().replace(/\.$/u, '').trim();
    return /^\d\/\d$/u.test(text) || (word !== undefined && words.includes(word));
  };
  const parentOf = (set: string) =>
    [...sets].find((other) => {
      const rest = /^[\s/_-]+(.+)$/u.exec(set.slice(other.length));
      return other !== set && set.toLowerCase().startsWith(other.toLowerCase()) && rest !== null && isMark(rest[1]!);
    });
  const found = new Map<string, FetGroup>();
  const resolve = (set: string): FetGroup => {
    const parent = parentOf(set);
    if (parent === undefined) return { set, class: set, group: '' };
    const above = found.get(parent) ?? resolve(parent);
    const rest = set.slice(parent.length).replace(/^[\s/_-]+/u, '');
    return { set, class: above.class, group: above.group === '' ? rest : `${above.group} ${rest}` };
  };
  for (const set of sets) found.set(set, resolve(set));
  return found;
}

/** The rows of one activity on one day: the first one's number and cells, and each hour with its row. */
interface Activity {
  readonly row: number;
  readonly cells: (column: FetColumn) => string;
  readonly hours: { readonly row: number; readonly name: string }[];
}

/**
 * Reads FET's timetable export, as `parseCsv` gives it, its header first, into the template's sessions, each checked
 * against every one before it. Rows are numbered from 1, as a spreadsheet numbers them, and rows with no cell filled
 * in are skipped. Throws when one of the app's words names two days.
 */
export function readFetTimetable(
  rows: readonly (readonly string[])[],
  words: FetWords,
  bells: BellTimes = [],
): FetImport {
  const readDay = dayReader(words.days);
  const header = (rows[0] ?? []).map((cell) =>
    cell
      .replace(/\p{Cf}/gu, '')
      .trim()
      .toLowerCase(),
  );
  const missing = FET_COLUMNS.filter((column) => column !== 'room' && !header.includes(column));
  if (missing.length > 0)
    return { sessions: [], problems: [{ row: 1, kind: 'fet-columns', missing }], together: [], groups: [] };
  const activities = new Map<string, Activity>();
  for (const [index, cells] of rows.entries()) {
    if (index === 0 || cells.every((one) => one.trim() === '')) continue;
    const cell = (column: FetColumn) => (cells[header.indexOf(column)] ?? '').trim();
    const id = cell('activity id');
    const at = id === '' ? `row ${index}` : `${id}|${readDay(cell('day')) ?? cell('day')}`;
    const known = activities.get(at) ?? { row: index + 1, cells: cell, hours: [] };
    known.hours.push({ row: index + 1, name: cell('hour') });
    activities.set(at, known);
  }
  const all = [...activities.values()];
  const sets = new Set(all.flatMap((one) => one.cells('students sets').split('+')).map((set) => set.trim()));
  sets.delete('');
  const classes = classesOf(sets, words.groups);
  const named = all.flatMap((one) => one.hours.map((hour) => readFetHour(hour.name, bells)));
  const starts = [...bells, ...named].flatMap((hour) => (hour === null ? [] : [hour[0]]));
  const order = [...new Set(starts)].sort((one, other) => one - other);
  const read = all.flatMap((one) => sessionsOf(one, readDay, bells, order, classes));
  const checked = checkSessions(read);
  return {
    ...checked,
    together: checked.together.filter((pair) => pair.row !== pair.with),
    groups: [...classes.values()].filter((one) => one.group !== ''),
  };
}

/** An activity's sessions, one for each students set, or what is wrong with it. */
function sessionsOf(
  { row, cells, hours }: Activity,
  readDay: (cell: string) => Weekday | undefined,
  bells: BellTimes,
  order: readonly number[],
  classes: ReadonlyMap<string, FetGroup>,
): (ImportedSession | FetProblem)[] {
  const empty = (['day', 'hour', 'students sets', 'subject', 'teachers'] as const).find((one) => cells(one) === '');
  const said = {
    day: 'day',
    hour: 'start',
    'students sets': 'class',
    subject: 'subject',
    teachers: 'teacher',
  } as const;
  if (empty !== undefined) return [{ row, kind: 'empty', column: said[empty] }];
  const day = readDay(cells('day'));
  if (day === undefined) return [{ row, kind: 'day', value: cells('day') }];
  const unread = hours.find((hour) => hour.name === '' || readFetHour(hour.name, bells) === null);
  if (unread !== undefined) return [{ row: unread.row, kind: 'time', value: unread.name }];
  const times = hours
    .map((hour) => ({ ...hour, time: readFetHour(hour.name, bells)! }))
    .sort((one, other) => one.time[0] - other.time[0]);
  const apart = times.find(
    (hour, at) =>
      at > 0 &&
      (order.indexOf(hour.time[0]) !== order.indexOf(times[at - 1]!.time[0]) + 1 ||
        hour.time[0] < times[at - 1]!.time[1]),
  );
  if (apart !== undefined) return [{ row: apart.row, kind: 'time', value: apart.name }];
  if (cells('teachers').includes('+')) return [{ row, kind: 'teachers', value: cells('teachers') }];
  const names = cells('students sets')
    .split('+')
    .map((set) => set.trim())
    .filter((set) => set !== '');
  if (names.length === 0) return [{ row, kind: 'empty', column: 'class' }];
  return names.map((set) => ({
    row,
    class: classes.get(set)!.class,
    group: classes.get(set)!.group,
    subject: cells('subject'),
    teacher: cells('teachers'),
    room: cells('room'),
    day,
    start: times[0]!.time[0],
    end: times[times.length - 1]!.time[1],
    week: 'both' as const,
  }));
}
