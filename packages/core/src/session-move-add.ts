// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Keeping a clash between two schools, or moving one of its sessions for one
// day (#232, Week-slot, answer 400). Only a clash of two schools or more on
// the drawn week is kept, once. A move takes a session the timetable gives on
// a day from today to the year's end, every level of a joint class and any
// rotating group's turn with it, none recorded, a test, lost to the calendar
// or moved already, to another slot of that day where the class's school
// teaches and the teacher has no session, catch-up session or time of their
// own; slots of two schools meet as the caller's `meets` says, as for
// catch-up sessions. A move is taken back only while no session it moved is
// recorded.

import { clashOf, sameSlot, type Meets } from './catch-up-add.ts';
import type { Context } from './context.ts';
import { compareDays, isWithin, weekday, type Day, type Weekday } from './day.ts';
import type { RecordEvent } from './events.ts';
import { courseGrade, entryCourses, forGrade } from './joint.ts';
import { slotKey, type Slot, type TimetableVersion } from './records.ts';
import { keptClashAt, type SessionMove } from './session-moves.ts';
import { sessionsBetween, versionOn, type Session } from './sessions.ts';
import { current } from './state.ts';
import type { State } from './state-type.ts';
import { blockCovers, weekClashes } from './week.ts';

/** Why a move cannot be recorded. */
export type MoveRefusal = 'past' | 'outside' | 'same' | 'moved' | 'no-session' | 'recorded' | 'closed' | 'busy';

/**
 * Why the session cannot move to `to` on its day, or null when it can. `to` is one of the slots the caller offers for
 * the class's school that day, those with a bell time; it must not meet `from`, so the session never meets itself. The
 * move names the timetable entry's group, never a rotating group's turn.
 */
export function moveRefusal(
  context: Context,
  move: Omit<SessionMove, 'id'>,
  today: Day,
  meets: Meets = sameSlot,
): MoveRefusal | null {
  const { ref, state, calendar } = context;
  const course = state.courses.get(move.courseId);
  const schoolClass = course && state.classes.get(course.classId);
  const school = schoolClass && state.schools.get(schoolClass.schoolId);
  if (course === undefined || schoolClass === undefined || school === undefined) return 'no-session';
  if (compareDays(move.day, today) < 0) return 'past';
  if (!isWithin(move.day, ref.year.from, ref.year.to)) return 'outside';
  if (meets(move.day, { school, slot: move.from }, { school, slot: move.to })) return 'same';
  const levels = entryCourses(state, course).map((one) => one.id);
  const version = versionOn(state.timetables, move.day);
  const entry = version?.entries.find(
    (one) =>
      levels.includes(one.courseId) &&
      one.weekday === weekday(move.day) &&
      slotKey(one.slot) === slotKey(move.from) &&
      one.groupId === move.groupId,
  );
  if (entry === undefined) return 'no-session';
  const moved = (one: SessionMove) => levels.includes(one.courseId) && one.day === move.day;
  if ([...state.moves.values()].some((one) => moved(one) && slotKey(one.from) === slotKey(move.from))) return 'moved';
  const found = sessionsBetween(context, move.day, move.day, new Set(levels)).filter(
    (one) => slotKey(one.slot) === slotKey(move.from) && (one.rotation !== undefined || one.groupId === move.groupId),
  );
  const timetabled = (one: Session) => one.scheduled && one.catchUp === undefined && one.added === undefined;
  if (found.length === 0 || found.some((one) => !timetabled(one) || one.test !== undefined || one.calendar !== null)) {
    return 'no-session';
  }
  if (found.some((one) => current(state.sessions.get(one.key)) !== null)) return 'recorded';
  const closed = entryCourses(state, course).some((level) => {
    const info = calendar.info(move.day, school, forGrade(schoolClass, courseGrade(level, schoolClass)), move.to.half);
    return !info.schoolDay || info.closure !== null || info.exam !== null || info.teacher !== null;
  });
  if (closed) return 'closed';
  const parity = calendar.parityOn(move.day, school);
  const blocks = (version?.blocks ?? []).filter(
    (block) => block.weeks === undefined || block.weeks === 'every' || block.weeks === parity,
  );
  if (blocks.some((block) => blockCovers(block, weekday(move.day), move.to))) return 'busy';
  return clashOf(context, move.courseId, move.day, move.to, meets) === null ? null : 'busy';
}

/** The event that moves the session for one day; throws when it cannot move. */
export function moveSession(context: Context, move: SessionMove, today: Day, meets: Meets = sameSlot): RecordEvent {
  if (context.state.moves.has(move.id)) throw new RangeError('The move exists');
  const refusal = moveRefusal(context, move, today, meets);
  if (refusal !== null) throw new RangeError(`The session cannot move: ${refusal}`);
  return { kind: 'move.set', move };
}

/** The event that takes a move back; throws once a session it moved is recorded. */
export function unmoveSession(state: State, id: string): RecordEvent {
  const move = state.moves.get(id);
  const course = move && state.courses.get(move.courseId);
  if (move === undefined || course === undefined) throw new RangeError('Unknown move');
  const levels = entryCourses(state, course).map((one) => one.id);
  const recorded = [...state.sessions.values()].some((versions) => {
    const one = current(versions)?.session;
    return (
      one !== undefined &&
      levels.includes(one.courseId) &&
      one.day === move.day &&
      slotKey(one.slot) === slotKey(move.to)
    );
  });
  if (recorded) throw new RangeError('The moved session is recorded');
  return { kind: 'move.removed', id };
}

/** The event that keeps the version's clash of two schools or more; throws for any other slot. */
export function keepClash(state: State, version: TimetableVersion, at: { weekday: Weekday; slot: Slot }, id: string) {
  const clash = weekClashes(version, state).find(
    (one) => one.weekday === at.weekday && slotKey(one.slot) === slotKey(at.slot),
  );
  if (clash === undefined || clash.schools.length < 2) throw new RangeError('No clash of two schools there');
  if (keptClashAt(state, version.id, at.weekday, at.slot) !== undefined) throw new RangeError('The clash is kept');
  if (state.keptClashes.has(id)) throw new RangeError('The kept clash exists');
  return { kind: 'clash.kept', kept: { id, versionId: version.id, weekday: at.weekday, slot: at.slot } } as const;
}

/** The event that opens a kept clash again. */
export function reopenClash(state: Pick<State, 'keptClashes'>, id: string): RecordEvent {
  if (!state.keptClashes.has(id)) throw new RangeError('Unknown kept clash');
  return { kind: 'clash.reopened', id };
}
