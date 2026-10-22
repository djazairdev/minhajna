// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind a clash between two schools on Week-slot (#232, answer
// 400): the clash of the drawn week at a slot, its sessions with their class
// and school, the next days that slot is taught, the free times one of them
// can take on such a day, with its school's bell times and two schools'
// slots meeting by those times, and the moves recorded for them from today.

import {
  addDays,
  compareDays,
  freeSlots,
  moveRefusal,
  slotKey,
  weekClashes,
  weekday,
  type Clash,
  type Context,
  type Day,
  type School,
  type SchoolClass,
  type SessionMove,
  type Slot,
  type State,
  type TimetableEntry,
  type TimetableVersion,
  current,
  entryCourses,
} from '@minhajna/core';
import { meetsByBells, timedSlots } from '../plan/catch-up-add-rules';
import type { AppData } from '../storage/AppData';
import type { Cell } from './week-rules';

type Data = Pick<AppData, 'state' | 'bells' | 'calendar' | 'profile'>;

/** One session of a clash: its timetable entry, class and school. */
export interface ClashSession {
  readonly entry: TimetableEntry;
  readonly schoolClass: SchoolClass;
  readonly school: School;
}

/** The clash of two schools or more at the cell of the drawn week, if there is one. */
export function schoolsClash(version: TimetableVersion, data: Data, cell: Cell): Clash | undefined {
  return weekClashes(version, data.state).find(
    (one) => one.weekday === cell.weekday && slotKey(one.slot) === slotKey(cell.slot) && one.schools.length > 1,
  );
}

/** The clash's sessions, in the order drawn. */
export function clashSessions(data: Data, clash: Clash): ClashSession[] {
  return clash.items.flatMap((item) => {
    if (item.kind !== 'entry') return [];
    const course = data.state.courses.get(item.entry.courseId);
    const schoolClass = course && data.state.classes.get(course.classId);
    const school = schoolClass && data.state.schools.get(schoolClass.schoolId);
    return schoolClass === undefined || school === undefined ? [] : [{ entry: item.entry, schoolClass, school }];
  });
}

/** The next `most` days from `today` on the clash's weekday, within the year, where one of its schools teaches. */
export function clashDays(context: Context, sessions: readonly ClashSession[], cell: Cell, today: Day, most = 4) {
  const days: Day[] = [];
  for (let day = today; compareDays(day, context.ref.year.to) <= 0 && days.length < most; day = addDays(day, 1)) {
    if (weekday(day) !== cell.weekday) continue;
    if (sessions.some((one) => context.calendar.info(day, one.school).schoolDay)) days.push(day);
  }
  return days;
}

/** A move a session of the clash can take on `day`, to a free time of its school with a bell time. */
export interface MoveChoice {
  readonly session: ClashSession;
  readonly move: Omit<SessionMove, 'id'>;
}

/** The moves the clash's sessions can take on `day`, each to a free time the core would accept. */
export function moveChoices(
  context: Context,
  data: Data,
  sessions: readonly ClashSession[],
  cell: Cell,
  day: Day,
  today: Day,
): MoveChoice[] {
  const meets = meetsByBells(data);
  return sessions.flatMap((session) => {
    const { courseId, groupId } = session.entry;
    const slots = (on: Day): Slot[] => timedSlots(data, session.school, on);
    return freeSlots(context, courseId, day, day, slots, meets, 8)
      .map((free) => ({ session, move: { courseId, groupId, day, from: cell.slot, to: free.slot } }))
      .filter((choice) => moveRefusal(context, choice.move, today, meets) === null);
  });
}

/** The moves of the clash's sessions from `today` on, in order of day. */
export function clashMoves(data: Data, sessions: readonly ClashSession[], cell: Cell, today: Day): SessionMove[] {
  return [...data.state.moves.values()]
    .filter(
      (move) =>
        compareDays(move.day, today) >= 0 &&
        slotKey(move.from) === slotKey(cell.slot) &&
        weekday(move.day) === cell.weekday &&
        sessions.some((one) => one.entry.courseId === move.courseId && one.entry.groupId === move.groupId),
    )
    .sort((a, b) => compareDays(a.day, b.day));
}

/** Whether a session the move takes is recorded at its new time, so the move stays. */
export function moveRecorded(state: State, move: SessionMove): boolean {
  const course = state.courses.get(move.courseId);
  const levels = new Set((course === undefined ? [] : entryCourses(state, course)).map((one) => one.id));
  return [...state.sessions.values()].some((versions) => {
    const one = current(versions)?.session;
    return (
      one !== undefined && levels.has(one.courseId) && one.day === move.day && slotKey(one.slot) === slotKey(move.to)
    );
  });
}
