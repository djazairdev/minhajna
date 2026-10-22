// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the Digest screen shows (#234, answers 402 and 405), from the core's
// week digest: the days covered, up to the last working one; the losses to
// the calendar grouped by entry and day, with the classes they took; each
// next exam window once, with the schools it covers; the drifts not
// dismissed on either class's plan; and a card for each of this year's
// classes not archived: its pace and plan check as on the Classes tab, its
// position in the plan, TD's own list before the exams, this week's losses,
// and whether the catch-up options apply.

import {
  addDays,
  behindPlan,
  catchUp,
  compareDays,
  planView,
  type CalendarEntry,
  type CalendarMark,
  type Context,
  type CountryProfile,
  type Day,
  type Drift,
  type PackItem,
  type Session,
  type WeekDigest,
  weekday,
} from '@minhajna/core';
import { classRows, type ClassRow } from '../classes/class-rules';
import { isDismissed } from '../plan/drift-dismissal';

type Dismissed = Parameters<typeof isDismissed>[0];
type Lost = Extract<CalendarMark, 'holiday' | 'closure' | 'teacher'>;

/** Sessions lost on one day to one calendar entry, and the courses they belong to. */
export interface LostGroup {
  readonly day: Day;
  readonly cause: Lost;
  readonly entry: CalendarEntry | undefined;
  /** The sessions lost, by course. */
  readonly courses: ReadonlyMap<string, number>;
  readonly count: number;
}

export interface DigestClass {
  readonly row: ClassRow;
  /** The item the class is on, null at the plan's end; undefined without a plan. */
  readonly at: PackItem | null | undefined;
  readonly td: { readonly gives: number; readonly items: number } | null;
  /** This week's losses of the class, with its own count of sessions. */
  readonly lost: readonly { readonly group: LostGroup; readonly count: number }[];
  readonly behind: boolean;
}

/** The calendar entry behind a lost session, from its school's and class's calendar. */
function entryOf(context: Context, session: Session): CalendarEntry | undefined {
  const { state, calendar } = context;
  const schoolClass = state.classes.get(session.classId);
  const school = schoolClass && state.schools.get(schoolClass.schoolId);
  if (school === undefined || session.calendarEntry === null) return undefined;
  return calendar.entriesFor(school, schoolClass).find((entry) => entry.id === session.calendarEntry);
}

/** The last day of the digest's days that is a working day, Saturday too for a teacher who works then. */
export function lastWorking(profile: CountryProfile, days: { from: Day; to: Day }, saturday: boolean): Day {
  const working = (day: Day) => profile.workingDays.includes(weekday(day)) || (saturday && weekday(day) === 6);
  let day = days.to;
  while (compareDays(day, days.from) > 0 && !working(day)) day = addDays(day, -1);
  return day;
}

/** The lost sessions by day and entry, in order of day. */
export function lostGroups(context: Context, lost: readonly Session[]): LostGroup[] {
  const groups = new Map<string, LostGroup>();
  for (const session of lost) {
    const key = `${session.day}/${session.calendarEntry ?? session.calendar ?? ''}`;
    const group = groups.get(key);
    const courses = new Map(group?.courses);
    courses.set(session.courseId, (courses.get(session.courseId) ?? 0) + 1);
    groups.set(key, {
      day: session.day,
      cause: session.calendar === 'closure' || session.calendar === 'teacher' ? session.calendar : 'holiday',
      entry: group?.entry ?? entryOf(context, session),
      courses,
      count: (group?.count ?? 0) + 1,
    });
  }
  return [...groups.values()].sort((a, b) => compareDays(a.day, b.day));
}

/** Each next exam window once, with the schools of the courses it covers, by first day. */
export function examGroups(context: Context, exams: WeekDigest['exams']) {
  const groups = new Map<string, { entry: CalendarEntry; schoolIds: string[] }>();
  for (const [courseId, entry] of exams) {
    const course = context.state.courses.get(courseId);
    const schoolId = (course && context.state.classes.get(course.classId)?.schoolId) ?? '';
    const group = groups.get(entry.id) ?? { entry, schoolIds: [] };
    if (!group.schoolIds.includes(schoolId)) group.schoolIds.push(schoolId);
    groups.set(entry.id, group);
  }
  return [...groups.values()].sort((a, b) => compareDays(a.entry.from, b.entry.from));
}

/** The drifts not dismissed on the plan of the class behind or of the class ahead (answer 405). */
export function shownDrifts(drifts: WeekDigest['drifts'], dismissed: Dismissed) {
  return drifts.filter(
    (one: { courseId: string; drift: Drift }) =>
      !isDismissed(dismissed, one.courseId, one.drift) && !isDismissed(dismissed, one.drift.other, one.drift),
  );
}

/** A card for each of this year's classes not archived, in the Classes tab's order. */
export function digestClasses(context: Context, groups: readonly LostGroup[], today: Day) {
  return classRows(context, today)
    .filter((row) => row.archived === undefined && row.course.year === context.ref.year.id)
    .map((row): DigestClass => {
      const id = row.course.id;
      const view = row.pace === null ? null : planView(context, id, today);
      const at = view === null ? undefined : (view.main.find((one) => one.position)?.item ?? null);
      return {
        row,
        at,
        td: row.pace === null ? null : (catchUp(context, id, today)?.td ?? null),
        lost: groups.flatMap((group) => {
          const count = group.courses.get(id) ?? 0;
          return count === 0 ? [] : [{ group, count }];
        }),
        behind: behindPlan(row.pace),
      };
    });
}
