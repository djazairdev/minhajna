// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A clash between two schools, kept or moved for one day (#232, Week-slot,
// R-3.2-18, answer 400). A kept clash names the drawn timetable version, the
// weekday and the slot: it is no longer open, and a new version starts with
// every clash open again. A one-day move takes one session of the timetable,
// its course, the timetable entry's group and day, from its slot to another
// of that day, every level of a joint class together, before any rotation
// gives the slot its turn; the drawn week is never rewritten. On that day
// every reader of the sessions sees it at its new time, with the slot it
// came from.

import type { Context } from './context.ts';
import { isWithin, type Day, type Weekday } from './day.ts';
import { courseGrade, entryCourses, forGrade } from './joint.ts';
import { slotKey, type Slot } from './records.ts';
import { markOf, sessionKey } from './session-keys.ts';
import type { Session } from './sessions.ts';
import type { State } from './state-type.ts';

export interface KeptClash {
  readonly id: string;
  /** The ID of the timetable version whose week was drawn with the clash. */
  readonly versionId: string;
  readonly weekday: Weekday;
  readonly slot: Slot;
}

export interface SessionMove {
  readonly id: string;
  readonly courseId: string;
  /** The timetable entry's group, before any rotation. */
  readonly groupId: string;
  readonly day: Day;
  /** The slot the timetable gives the session. */
  readonly from: Slot;
  /** The slot it takes on that day only. */
  readonly to: Slot;
}

/** The kept mark of a version's clash at a weekday and slot, if the teacher kept it. */
export function keptClashAt(
  state: Pick<State, 'keptClashes'>,
  versionId: string,
  weekday: Weekday,
  slot: Slot,
): KeptClash | undefined {
  return [...state.keptClashes.values()].find(
    (one) => one.versionId === versionId && one.weekday === weekday && slotKey(one.slot) === slotKey(slot),
  );
}

/** The sessions with each move from `first` to `last` applied to the timetable's session it takes, if it is there. */
export function movedSessions(
  context: Context,
  sessions: Map<string, Session>,
  first: Day,
  last: Day,
): Map<string, Session> {
  const { state, calendar } = context;
  for (const move of state.moves.values()) {
    const course = state.courses.get(move.courseId);
    const schoolClass = course && state.classes.get(course.classId);
    const school = schoolClass && state.schools.get(schoolClass.schoolId);
    if (!isWithin(move.day, first, last) || course === undefined || schoolClass === undefined || !school) continue;
    for (const level of entryCourses(state, course)) {
      const session = sessions.get(sessionKey(level.id, move.day, move.from, move.groupId));
      if (session?.scheduled !== true) continue;
      const forLevel = forGrade(schoolClass, courseGrade(level, schoolClass));
      const info = calendar.info(move.day, school, forLevel, move.to.half);
      const blocking = info.closure ?? info.exam ?? info.teacher;
      const key = sessionKey(level.id, move.day, move.to, move.groupId);
      sessions.delete(session.key);
      sessions.set(key, {
        ...session,
        key,
        slot: move.to,
        calendar: info.schoolDay ? markOf(info) : 'holiday',
        calendarEntry: blocking?.id ?? null,
        movedFrom: move.from,
      });
    }
  }
  return sessions;
}
