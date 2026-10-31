// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A timetable read from a file, as each class's week and the balance of its
// alternating weeks (#576, D-TT-import, §7.4, R-7.4-10, answer 593). The
// classes are listed under their first spelling, two spellings of one name
// being one class, in the order a person reads them, 1AM2 before 1AM10. A
// class's grid, and a teacher's or a room's laid out the same way for printing
// (#581), has a row for each start and end its sessions take, earliest first,
// and a column for each of the school's working days, then any other day its
// sessions fall on, so nothing read is hidden; a cell holds the sessions of
// that time, by class, the whole class first, then each group, week A before
// week B; a session with no room is in no room's grid. When sessions alternate,
// each group of pupils and each teacher must have as long a week A as week B: a
// group's week holds the whole class's sessions, its own, and those of each
// group it is within, as G1 1/2 is within G1; the smallest groups are checked,
// taken to cover any group split into several, so a group with a single group
// directly within it is checked too; a class without groups is one group; and a
// session taught to several classes together counts once for its teacher. The
// balance is of the sessions a reading kept, never of the rows left out. The
// grid shows the timetable as read and never changes it.

import type { Weekday } from './day.ts';
import { groupWithin, timetableNameKey as key, type ImportedSession } from './timetable-import.ts';

/** A row of a class's grid: one start and end, in minutes from midnight, with the sessions of each day's column. */
export interface GridSlot {
  readonly start: number;
  readonly end: number;
  readonly cells: readonly (readonly ImportedSession[])[];
}

export interface ClassGrid {
  readonly days: readonly Weekday[];
  readonly slots: readonly GridSlot[];
}

/** A group of pupils or a teacher whose weeks A and B differ, with each week's minutes. */
export interface WeekImbalance {
  readonly kind: 'class' | 'teacher';
  readonly name: string;
  /** The class's group, or empty for the whole class and for a teacher. */
  readonly group: string;
  readonly a: number;
  readonly b: number;
}

const byReading = (one: string, other: string) => one.localeCompare(other, undefined, { numeric: true });

/** Each name under its first spelling, in reading order. */
function names(cells: readonly string[]): string[] {
  const found = new Map<string, string>();
  for (const cell of cells) if (cell !== '' && !found.has(key(cell))) found.set(key(cell), cell);
  return [...found.values()].sort(byReading);
}

/** The classes a timetable gives, each under its first spelling, in reading order. */
export function timetableClasses(sessions: readonly ImportedSession[]): string[] {
  return names(sessions.map((one) => one.class));
}

/** Whose week a grid is: a class's, a teacher's or a room's. */
export type GridOf = 'class' | 'teacher' | 'room';

/** The classes, teachers or rooms a timetable names, each under its first spelling, in reading order. */
export function timetableNames(sessions: readonly ImportedSession[], of: GridOf): string[] {
  return names(sessions.map((one) => one[of]));
}

const WEEK_ORDER = { both: 0, A: 1, B: 2 } as const;

/**
 * A class's week in the sessions a reading kept: the working days given, then any other day its sessions take, and a
 * row for each time.
 */
export function classGrid(
  sessions: readonly ImportedSession[],
  name: string,
  workingDays: readonly Weekday[],
): ClassGrid {
  return gridOf(sessions, 'class', name, workingDays);
}

/** A class's, a teacher's or a room's week, as a class's is laid out, a cell's sessions by class first. */
export function gridOf(
  sessions: readonly ImportedSession[],
  of: GridOf,
  name: string,
  workingDays: readonly Weekday[],
): ClassGrid {
  const mine = sessions.filter((one) => one[of] !== '' && key(one[of]) === key(name));
  const others = [...new Set(mine.map((one) => one.day))].filter((day) => !workingDays.includes(day));
  const days = [...workingDays, ...others.sort((one, other) => one - other)];
  const times = new Map(mine.map((one) => [`${one.start}-${one.end}`, [one.start, one.end] as const]));
  const order = (one: ImportedSession, other: ImportedSession) =>
    byReading(key(one.class), key(other.class)) ||
    Number(one.group !== '') - Number(other.group !== '') ||
    byReading(one.group, other.group) ||
    WEEK_ORDER[one.week] - WEEK_ORDER[other.week];
  const slots = [...times.values()]
    .sort((one, other) => one[0] - other[0] || one[1] - other[1])
    .map(([start, end]) => ({
      start,
      end,
      cells: days.map((day) =>
        mine.filter((one) => one.day === day && one.start === start && one.end === end).sort(order),
      ),
    }));
  return { days, slots };
}

/** Whether any session comes only in week A or week B. */
export const alternates = (sessions: readonly ImportedSession[]) => sessions.some((one) => one.week !== 'both');

/** The minutes of a week, A or B, in sessions given, each time counted once. */
function weekMinutes(sessions: readonly ImportedSession[], week: 'A' | 'B'): number {
  const times = new Map<string, number>();
  for (const one of sessions)
    if (one.week === 'both' || one.week === week) times.set(`${one.day}-${one.start}-${one.end}`, one.end - one.start);
  return [...times.values()].reduce((sum, minutes) => sum + minutes, 0);
}

/**
 * Each smallest group of pupils, and each group with a single group directly within it, then each teacher, whose week A
 * is not as long as week B, in reading order, among the sessions a reading kept, which never clash. A group's week is
 * the whole class's sessions, its own, and those of each group it is within; a class without groups is one group. Empty
 * when the weeks balance.
 */
export function weekBalance(sessions: readonly ImportedSession[]): WeekImbalance[] {
  const found: WeekImbalance[] = [];
  const keyed = sessions.map((one) => ({ one, class: key(one.class), teacher: key(one.teacher) }));
  const check = (kind: 'class' | 'teacher', name: string, group: string, list: readonly ImportedSession[]) => {
    const [a, b] = [weekMinutes(list, 'A'), weekMinutes(list, 'B')];
    if (a !== b) found.push({ kind, name, group, a, b });
  };
  for (const name of timetableClasses(sessions)) {
    const mine = keyed.filter((row) => row.class === key(name)).map((row) => row.one);
    const groups = names(mine.map((one) => one.group));
    const below = (group: string) => groups.filter((other) => other !== group && groupWithin(other, group));
    const inside = (group: string) =>
      below(group).filter((other) => !below(group).some((middle) => middle !== other && groupWithin(other, middle)))
        .length;
    const checked = groups.filter((group) => inside(group) < 2);
    for (const group of checked.length === 0 ? [''] : checked)
      check(
        'class',
        name,
        group,
        mine.filter((one) => one.group === '' || groupWithin(group, one.group)),
      );
  }
  for (const name of names(sessions.map((one) => one.teacher)))
    check(
      'teacher',
      name,
      '',
      keyed.filter((row) => row.teacher === key(name)).map((row) => row.one),
    );
  return found;
}
