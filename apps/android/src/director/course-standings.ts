// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Each class's standing on the director's dashboard, from the school's signed
// weeks as D-Record reads them (records-session.ts), for #549 and answer 627: a
// class of the school is matched by its name key, a class the school does not
// list left out; each week counts under the subject code its totals name,
// whatever name the timetable gives the subject; a subject's weeks are gathered
// from every course of the class in it, each teacher's chain apart, so two
// teachers in turn who each signed part of a week both count, a week once for
// each teacher at the highest version read; and the core works out the standing
// (week-standing.ts) against the class's pinned pack and the world's calendar
// as it stands, its closures and exam days read for the school's zone and the
// class, each day once, as the seeded term reads them. An exam's chart takes
// the standing on its figures day, from the weeks that begin by then (answer
// 631), or, on a teacher's phone, from their own signed weeks (answer 633).

import {
  CalendarView,
  demoSchoolClass,
  demoSchoolPlace,
  timetableNameKey,
  weekStanding,
  type CourseStanding,
  type Day,
  type DayInfo,
  type DemoSchool,
  type WeekRecord,
} from '@minhajna/core';
import type { ClassRecords } from './records-session';
import { termReference, type TermReference } from './seeded-fill';

const key = (classId: string, subject: string) => `${classId}\n${subject}`;

/** A class's signed weeks, course by course, as the standings read them: the director's records or a teacher's own. */
export type StandingRecords = Pick<ClassRecords, 'class'> & {
  readonly courses: readonly { readonly key: string; readonly weeks: readonly { readonly week: WeekRecord }[] }[];
};

/** Each class and subject's standing from its signed weeks, those that begin by `until` when given. */
export function courseStandings(
  records: readonly StandingRecords[],
  school: DemoSchool,
  reference: TermReference,
  until?: Day,
): (classId: string, subject: string) => CourseStanding | null {
  const view = new CalendarView(termReference(reference), []);
  const place = demoSchoolPlace(school);
  const found = new Map<string, CourseStanding>();
  for (const one of records) {
    const named = school.classes.find((each) => timetableNameKey(each.name) === timetableNameKey(one.class));
    if (named === undefined) continue;
    const schoolClass = demoSchoolClass(school, named);
    const days = new Map<Day, DayInfo>();
    const info = (day: Day) => days.get(day) ?? days.set(day, view.info(day, place, schoolClass)).get(day)!;
    const calendar = { closure: (day: Day) => info(day).closure !== null, exam: (day: Day) => info(day).exam !== null };
    const bySubject = new Map<string, Map<string, WeekRecord>>();
    for (const course of one.courses)
      for (const { week } of course.weeks) {
        if (until !== undefined && week.week > until) continue;
        const weeks = bySubject.get(week.totals.subject) ?? new Map<string, WeekRecord>();
        const at = `${course.key}\n${week.week}`;
        if ((weeks.get(at)?.version ?? -1) < week.version) weeks.set(at, week);
        bySubject.set(week.totals.subject, weeks);
      }
    for (const [subject, weeks] of bySubject) {
      const pinned = named.packs[subject];
      const pack = reference.packs.find((each) => each.id === pinned?.id && each.release === pinned.release);
      const standing = weekStanding([...weeks.values()], pack?.items ?? [], calendar);
      if (standing !== null) found.set(key(named.id, subject), standing);
    }
  }
  return (classId, subject) => found.get(key(classId, subject)) ?? null;
}
