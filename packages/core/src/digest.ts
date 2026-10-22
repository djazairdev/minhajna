// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The weekly digest's facts, for the teacher alone (#234, PRD §3.9, answers
// 402 and 405). It covers the week before the digest day, Sunday's or
// Saturday's for a teacher who works then, or the week so far: its
// sessions and those confirmed, those still awaiting confirmation, this
// week's and earlier; the sessions lost to the calendar, apart, so a
// closure never reads as slow teaching; the make-ups due; each class's next
// exam window; and each class falling behind a parallel class before a
// common test or the exams, towards the class furthest ahead. An exam takes
// its sessions' place and is not a loss (answer 396), and a rotating group
// off its turn is not one either. Only this year's classes count, archived
// ones left out. Each class's pace and position come from `pace` and
// `planView`, as on the Classes tab.

import { makeUpsDue } from './catch-up-add.ts';
import type { Context } from './context.ts';
import { addDays, compareDays, type Day } from './day.ts';
import { nextExams } from './exam-window.ts';
import { digestDays } from './notify-times.ts';
import { driftBefore, type Drift } from './plan-drift.ts';
import type { CalendarEntry } from './reference.ts';
import { compareSlots, type SessionRef } from './records.ts';
import { sessionsBetween, type Session } from './sessions.ts';
import { current } from './state.ts';

/** The causes a digest counts as lost to the calendar. */
const LOST = new Set(['holiday', 'closure', 'teacher']);

export interface WeekDigest {
  /** The first and last days covered, within the year. */
  readonly from: Day;
  readonly to: Day;
  /** The week's sessions the calendar leaves to teach, and those of them recorded. */
  readonly sessions: number;
  readonly confirmed: number;
  /** Sessions still awaiting confirmation: this week's, and those of the weeks before it. */
  readonly awaiting: number;
  readonly earlier: number;
  /** The week's sessions lost to a holiday, a closure or the teacher's own calendar, in order. */
  readonly lost: readonly Session[];
  /** Sessions not held and marked to be made up that no catch-up session names, oldest first. */
  readonly makeUps: readonly SessionRef[];
  /** Each class's next exam window, by course. */
  readonly exams: ReadonlyMap<string, CalendarEntry>;
  /** Each class behind a parallel class, towards the one furthest ahead, as on its plan. */
  readonly drifts: readonly { readonly courseId: string; readonly drift: Drift }[];
}

/** The weekly digest on `today`; null before the year's first day has passed. */
export function weekDigest(context: Context, today: Day, saturday = false): WeekDigest | null {
  const days = digestDays(context, today, saturday);
  if (days === null) return null;
  const { state, ref } = context;
  const recorded = (one: Session) => current(state.sessions.get(one.key)) !== null;
  const week = sessionsBetween(context, days.from, days.to);
  const taught = week.filter((one) => one.calendar === null);
  const before = addDays(days.from, -1);
  const earlier =
    compareDays(before, ref.year.from) < 0
      ? 0
      : sessionsBetween(context, ref.year.from, before).filter((one) => one.calendar === null && !recorded(one)).length;
  const courses = [...state.courses.values()].filter((course) => {
    if (course.year !== ref.year.id) return false;
    const archived = state.classes.get(course.classId)?.archivedFrom;
    return archived === undefined || compareDays(today, archived) < 0;
  });
  const exams = new Map<string, CalendarEntry>();
  for (const course of courses) {
    const entry = nextExams(context, course.id, today);
    if (entry !== null) exams.set(course.id, entry);
  }
  const drifts = courses.flatMap((course) => {
    const drift = driftBefore(context, course.id, today);
    return drift === null || !drift.behind ? [] : [{ courseId: course.id, drift }];
  });
  return {
    ...days,
    sessions: taught.length,
    confirmed: taught.filter(recorded).length,
    awaiting: taught.filter((one) => !recorded(one)).length,
    earlier,
    lost: week.filter((one) => one.calendar !== null && LOST.has(one.calendar)),
    makeUps: courses
      .flatMap((course) => makeUpsDue(context, course.id))
      .sort((a, b) => compareDays(a.day, b.day) || compareSlots(a.slot, b.slot)),
    exams,
    drifts,
  };
}
