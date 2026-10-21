// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A catch-up session (#228, R-4.7-28, R-7.7-02, answers 353 and 355): one
// session for one class, on a day and a bell slot of its school, never a
// clock time (PRD §3.3). The time is agreed with the administration; the
// app records only the teacher's choice. It is a plan session: it takes the
// class's next item like any session, shows on Today and goes on the
// subject's pages of the texts book with its date. It can name the session
// not held that it makes up. A day off for the school does not mark it,
// since the administration decides; a closure, an exam or the teacher's own
// calendar still does, as for a make-up day.

import type { Context } from './context.ts';
import { isWithin, type Day } from './day.ts';
import { courseGrade, forGrade } from './joint.ts';
import type { Slot } from './records.ts';
import { markOf, sessionKey } from './session-keys.ts';
import type { Session } from './sessions.ts';

export interface CatchUpSession {
  readonly id: string;
  readonly courseId: string;
  readonly groupId: string;
  readonly day: Day;
  readonly slot: Slot;
  /** The type of the session it makes up, or the country's first lesson type. */
  readonly sessionType: string;
  /** The key of the session not held that it makes up. */
  readonly replaces?: string;
}

/** The catch-up sessions from `first` to `last` as sessions, with `courseIds` only those courses'. */
export function catchUpSessions(context: Context, first: Day, last: Day, courseIds?: ReadonlySet<string>): Session[] {
  const { state, calendar } = context;
  const found: Session[] = [];
  for (const catchUp of state.catchUps.values()) {
    if (!isWithin(catchUp.day, first, last)) continue;
    if (courseIds !== undefined && !courseIds.has(catchUp.courseId)) continue;
    const course = state.courses.get(catchUp.courseId);
    const schoolClass = course && state.classes.get(course.classId);
    const school = schoolClass && state.schools.get(schoolClass.schoolId);
    if (course === undefined || schoolClass === undefined || school === undefined) continue;
    const forLevel = forGrade(schoolClass, courseGrade(course, schoolClass));
    const info = calendar.info(catchUp.day, school, forLevel, catchUp.slot.half);
    const blocking = info.closure ?? info.exam ?? info.teacher;
    found.push({
      key: sessionKey(course.id, catchUp.day, catchUp.slot, catchUp.groupId),
      courseId: course.id,
      classId: schoolClass.id,
      groupId: catchUp.groupId,
      day: catchUp.day,
      slot: catchUp.slot,
      sessionType: catchUp.sessionType,
      calendar: markOf(info),
      calendarEntry: blocking?.id ?? null,
      scheduled: true,
      catchUp: catchUp.id,
    });
  }
  return found;
}
