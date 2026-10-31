// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a school's timetable changes in a teacher's week, and a week of several
// schools (#580, PRD §3.2, §7.4, R-3.2-18, R-7.4-02, R-7.4-03, answer 608). A
// teacher's week, drawn by hand or received, is compared session by session:
// the same lesson, by class, group and subject, in the same week at the same
// day and times is the same session, its room changed or not; of the rest, a
// session of the drawn week and one received of the same class, group and
// subject moved, its day, times or week, paired in the order of their day and
// time; what is left was removed or added. Each class's sessions are counted
// before and after, a session of week A or B counting as one, its hours left to
// the app. A week of several schools puts each school's sessions together,
// counts each school's, and marks every two sessions of different schools at
// the same time in a week they share, which only a new version from either
// school settles.

import type { PartSession } from './timetable-sessions.ts';
import { timetableNameKey } from './timetable-import.ts';

/** A session of a teacher's week, without an ID. */
export type TimetableRow = Omit<PartSession, 'id'>;

/** One difference between a drawn week and a received one. */
export type WeekDifference =
  | { readonly kind: 'moved'; readonly before: TimetableRow; readonly after: TimetableRow }
  | { readonly kind: 'room'; readonly before: TimetableRow; readonly after: TimetableRow }
  | { readonly kind: 'added'; readonly before: null; readonly after: TimetableRow }
  | { readonly kind: 'removed'; readonly before: TimetableRow; readonly after: null };

const lesson = (one: TimetableRow) => [one.class, one.group, one.subject].map(timetableNameKey).join('\n');
const slot = (one: TimetableRow) => `${lesson(one)}\n${one.week}\n${one.day}\n${one.start}\n${one.end}`;
const byTime = (a: TimetableRow, b: TimetableRow) => a.day - b.day || a.start - b.start || a.end - b.end;

/** The differences a received week makes in a drawn one, in the order of their day and time. */
export function weekDifferences(drawn: readonly TimetableRow[], received: readonly TimetableRow[]): WeekDifference[] {
  const left = [...received];
  const gone: TimetableRow[] = [];
  const found: WeekDifference[] = [];
  for (const one of [...drawn].sort(byTime)) {
    const at = left.findIndex((other) => slot(other) === slot(one));
    if (at < 0) {
      gone.push(one);
      continue;
    }
    const same = left.splice(at, 1)[0]!;
    if (timetableNameKey(same.room) !== timetableNameKey(one.room))
      found.push({ kind: 'room', before: one, after: same });
  }
  const came = left.sort(byTime);
  for (const one of gone) {
    const at = came.findIndex((other) => lesson(other) === lesson(one));
    if (at < 0) found.push({ kind: 'removed', before: one, after: null });
    else found.push({ kind: 'moved', before: one, after: came.splice(at, 1)[0]! });
  }
  for (const one of came) found.push({ kind: 'added', before: null, after: one });
  return found.sort((a, b) => byTime(a.after ?? a.before, b.after ?? b.before));
}

/** Each class's sessions in a week, by the class as first written, in the order the classes first come. */
export function classSessions(rows: readonly TimetableRow[]): Map<string, number> {
  const names = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const one of [...rows].sort(byTime)) {
    const key = timetableNameKey(one.class);
    const name = names.get(key) ?? one.class;
    names.set(key, name);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

/** A session of a week of several schools, with its school. */
export type SchoolRow = TimetableRow & { readonly school: string };

/** Two sessions of different schools at the same time in a week they share. */
export type SchoolClash = readonly [SchoolRow, SchoolRow];

const meets = (a: TimetableRow, b: TimetableRow) =>
  a.day === b.day &&
  a.start < b.end &&
  b.start < a.end &&
  (a.week === 'both' || b.week === 'both' || a.week === b.week);

/** Several schools' weeks as one, in the order of day and time, with every clash between two schools. */
export function schoolsWeek(schools: readonly { readonly school: string; readonly rows: readonly TimetableRow[] }[]) {
  const rows: SchoolRow[] = schools.flatMap(({ school, rows: theirs }) => theirs.map((one) => ({ ...one, school })));
  rows.sort(byTime);
  const clashes: SchoolClash[] = [];
  rows.forEach((one, at) => {
    for (const other of rows.slice(at + 1))
      if (other.school !== one.school && meets(one, other)) clashes.push([one, other]);
  });
  const counts = new Map(schools.map(({ school, rows: theirs }) => [school, theirs.length]));
  return { rows, clashes, counts };
}
