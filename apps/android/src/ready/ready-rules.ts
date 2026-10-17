// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind Setup-7-Ready (#31): the week's hours, the September
// check of each class with a pinned pack, and the next session with what the
// plan proposes for it. Every figure is a fact for the teacher alone (PRD
// §3.1, rule 8); the gap between what the plan needs and what the year gives
// is spare time for remediation and the unexpected, never free time (PRD §4.7).

import {
  addDays,
  compareDays,
  courseOf,
  courseSetup,
  current,
  findSessionType,
  sessionsBetween,
  termCheck,
  walkCourse,
  type Context,
  type Course,
  type Day,
  type SchoolClass,
  type SchoolYear,
  type Session,
  type TermCheck,
} from '@minhajna/core';
import type { PlanGroup } from '../plan/plan-rules';

/** How far ahead the next session is looked for. */
const LOOK_AHEAD_DAYS = 28;

/** Today, or the year's first day before the year starts. */
export function startDay(year: SchoolYear, today: Day): Day {
  return compareDays(today, year.from) < 0 ? year.from : today;
}

/** The term the check is for: the one under way on `from`, or the next one. */
export function checkTerm(year: SchoolYear, from: Day): number | undefined {
  return year.terms.find((term) => compareDays(from, term.to) <= 0)?.number;
}

/** Minutes taught in a week of the latest timetable; an A or B week slot counts half. */
export function weekMinutes(context: Context): number {
  const entries = context.state.timetables.at(-1)?.version.entries ?? [];
  return entries.reduce((sum, entry) => {
    if (!context.state.courses.has(entry.courseId)) return sum;
    const share = entry.weeks === 'every' ? 1 : 0.5;
    return sum + share * courseSetup(context, entry.courseId).sessionMinutes;
  }, 0);
}

export interface CheckRow {
  readonly schoolClass: SchoolClass;
  readonly course: Course;
  readonly check: TermCheck;
}

export interface CheckGroup {
  readonly group: PlanGroup;
  readonly rows: readonly CheckRow[];
}

/**
 * For each grade and subject, the check of each class with a pinned pack
 * that places its items in terms. Counted from the year's first day, a
 * session still awaiting confirmation stays among those the year gives: it
 * is never read as a session lost (PRD §2.3, rule 5).
 */
export function checkGroups(
  context: Context,
  groups: readonly PlanGroup[],
  yearId: string,
  term: number,
): CheckGroup[] {
  return groups
    .map((group) => ({
      group,
      rows: group.classes.flatMap((schoolClass): CheckRow[] => {
        const course = courseOf(context.state, schoolClass.id, group.subject, yearId, group.grade);
        if (course === undefined || course.pack === null) return [];
        const check = termCheck(context, course.id, context.ref.year.from, term);
        return check === null ? [] : [{ schoolClass, course, check }];
      }),
    }))
    .filter((entry) => entry.rows.length > 0);
}

/** Sessions the year gives beyond what the plan needs; below zero, sessions short of it. */
export function spareOf(check: TermCheck): number {
  return check.gives - check.needs;
}

export interface NextSession {
  readonly session: Session;
  readonly schoolClass: SchoolClass;
  /** The item the plan proposes, if any. */
  readonly proposal: string | null;
  /** The session type, when its queue proposes nothing, such as a reception. */
  readonly sessionType: string | null;
}

/** The first session from `from` that the calendar leaves and that is not yet recorded. */
export function nextSession(context: Context, from: Day): NextSession | null {
  const { state } = context;
  const session = sessionsBetween(context, from, addDays(from, LOOK_AHEAD_DAYS)).find(
    (candidate) =>
      candidate.calendar === null &&
      state.courses.has(candidate.courseId) &&
      current(state.sessions.get(candidate.key)) === null,
  );
  if (session === undefined) return null;
  const setup = courseSetup(context, session.courseId);
  const proposal = walkCourse(context, session.courseId, session.day).proposals.get(session.key) ?? null;
  const queue = findSessionType(context.ref.country, session.sessionType).queue;
  return {
    session,
    schoolClass: setup.schoolClass,
    proposal: proposal?.item.title ?? null,
    sessionType: queue === 'none' ? session.sessionType : null,
  };
}
