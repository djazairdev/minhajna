// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the screen for a make-up, support or revision day (#219,
// Calendar-add-sessions) works from: the schools the teacher teaches at, a
// first day to offer, the weekday's sessions as choices, the day's entry, and
// each class's spare sessions before the exams, before and after the day;
// and the support and revision sessions as rows for the texts book's page.

import {
  addDays,
  compareDays,
  eachDay,
  slotKey,
  supportDayRows,
  termCheck,
  weekday,
  type AddedKind,
  type Context,
  type CountryProfile,
  type Day,
  type ExtraSession,
  type Weekday,
  type FollowedEntry,
  type LocalizedText,
  type School,
  type State,
} from '@minhajna/core';
import type { AppData } from '../storage/AppData';
import { catalogues, type Language } from '../text/i18n';
import { sessionTime } from '../times/times-rules';

/** The schools where the teacher has a class, in their order. */
export function taughtSchools(state: State): School[] {
  const used = new Set([...state.classes.values()].map((schoolClass) => schoolClass.schoolId));
  return [...state.schools.values()].filter((school) => used.has(school.id));
}

/** The first day off after today in the school year, as days that add sessions often are; today otherwise. */
export function firstOffer(
  year: { readonly from: Day; readonly to: Day },
  today: Day,
  profile: Pick<CountryProfile, 'workingDays'>,
): Day {
  const start = compareDays(today, year.from) < 0 ? year.from : today;
  for (
    let day = addDays(start, 1);
    compareDays(day, year.to) <= 0 && compareDays(day, addDays(start, 7)) <= 0;
    day = addDays(day, 1)
  ) {
    if (!profile.workingDays.includes(weekday(day))) return day;
  }
  return compareDays(start, year.to) <= 0 ? start : year.to;
}

/** The first working weekday a closure covers, whose timetable a make-up day follows; null when it covers none. */
export function closureWeekday(
  closure: { readonly from: Day; readonly to: Day },
  profile: Pick<CountryProfile, 'workingDays'>,
): Weekday | null {
  const day = eachDay(closure.from, closure.to).find((one) => profile.workingDays.includes(weekday(one)));
  return day === undefined ? null : weekday(day);
}

/** The day's name in every language the app speaks, for the calendar entry. */
export function addedName(kind: AddedKind): LocalizedText {
  const names: Record<string, string> = {};
  for (const [language, texts] of Object.entries(catalogues) as [Language, (typeof catalogues)[Language]][]) {
    names[language] = texts.addSessions.names[kind];
  }
  return names;
}

/** The sessions offered first: those of the day's week that fall in no slot already taught. */
export function firstChoice(followed: readonly FollowedEntry[], busy: ReadonlySet<string>): string[] {
  return followed.filter((one) => one.inWeek && !busy.has(slotKey(one.entry.slot))).map((one) => one.take);
}

export interface SpareChange {
  readonly courseId: string;
  readonly classId: string;
  /** Sessions the timetable and the calendar give before the term's exams, beyond what the plan needs. */
  readonly before: number;
  readonly after: number;
}

/** Each course's spare sessions before its next exams, without the day and with it; a course without a pack is left out. */
export function spareChanges(
  without: Context,
  withDay: Context,
  courseIds: readonly string[],
  today: Day,
): SpareChange[] {
  const spare = (context: Context, courseId: string) => {
    const check = termCheck(context, courseId, today);
    return check === null ? null : check.gives - check.needs;
  };
  return courseIds.flatMap((courseId) => {
    const course = without.state.courses.get(courseId);
    const before = spare(without, courseId);
    const after = spare(withDay, courseId);
    if (course === undefined || before === null || after === null) return [];
    return [{ courseId, classId: course.classId, before, after }];
  });
}

/** The school year's support and revision sessions as rows for the page for additional lessons, timed by the bells. */
export function supportRows(
  data: Pick<AppData, 'state' | 'bells' | 'calendar' | 'year'>,
  context: Context,
): ExtraSession[] {
  return supportDayRows(context, data.year.from, data.year.to, (session) => {
    const schoolClass = data.state.classes.get(session.classId);
    return sessionTime(data, schoolClass && data.state.schools.get(schoolClass.schoolId), session.slot, session.day);
  });
}
