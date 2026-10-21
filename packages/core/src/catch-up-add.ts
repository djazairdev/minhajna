// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Adding and cancelling a catch-up session (#228, Catchup-add, answers 353
// to 358). The free times offered are school days of the class's school, at
// the slots the caller gives for each day (those with a bell time), where
// the teacher has no session in any school, no time of their own marked on
// the week and no catch-up session already. Any day from today to the
// year's end can be chosen instead, a day off included, but never a time
// when the teacher already teaches. Slots of the same school meet by their
// number; slots of two schools meet as the caller's `meets` says, from their
// bell times. A session not held that the teacher marked «تُعوَّض هذه الحصة»
// is a make-up due until a catch-up session that takes place names it. A
// catch-up session is cancelled only while it is not recorded; one a later
// timetable hides behind a usual session stays cancellable, and makes up
// nothing. A cancelled one comes back only if its time is still free.

import type { CatchUpSession } from './catch-up-sessions.ts';
import type { Context } from './context.ts';
import { compareDays, isWithin, maxDay, minDay, weekday, eachDay, type Day } from './day.ts';
import type { RecordEvent } from './events.ts';
import { courseGrade, forGrade } from './joint.ts';
import { compareSlots, slotKey, wholeGroup, type School, type SessionRef, type Slot } from './records.ts';
import { sessionKey } from './session-keys.ts';
import { sessionsBetween, versionOn, type Session } from './sessions.ts';
import { current } from './state.ts';
import { blockCovers } from './week.ts';

/** A free time to offer. */
export interface FreeSlot {
  readonly day: Day;
  readonly slot: Slot;
}

/** A slot at a school. */
export interface SchoolSlot {
  readonly school: School;
  readonly slot: Slot;
}

/** Whether two slots meet on `day`. */
export type Meets = (day: Day, a: SchoolSlot, b: SchoolSlot) => boolean;

/** Slots meet when their numbers are the same, whatever the school. */
export const sameSlot: Meets = (_day, a, b) => slotKey(a.slot) === slotKey(b.slot);

/** A class's catch-up session not yet recorded, and whether it takes place or a usual session took its time. */
export interface OpenCatchUp {
  readonly catchUp: CatchUpSession;
  readonly placed: boolean;
}

type Taken = { readonly one: Session | CatchUpSession; readonly at: SchoolSlot };

function schoolOf(context: Context, courseId: string): School | undefined {
  const { state } = context;
  const course = state.courses.get(courseId);
  const schoolClass = course && state.classes.get(course.classId);
  return schoolClass && state.schools.get(schoolClass.schoolId);
}

/** The teacher's time taken from `first` to `last`, by day: sessions not lost to the calendar, and every catch-up. */
function takenBetween(context: Context, first: Day, last: Day): Map<Day, Taken[]> {
  const ones = [
    ...sessionsBetween(context, first, last).filter((session) => session.calendar === null),
    ...[...context.state.catchUps.values()].filter((catchUp) => isWithin(catchUp.day, first, last)),
  ];
  const taken = new Map<Day, Taken[]>();
  for (const one of ones) {
    const school = schoolOf(context, one.courseId);
    if (school !== undefined)
      taken.set(one.day, [...(taken.get(one.day) ?? []), { one, at: { school, slot: one.slot } }]);
  }
  return taken;
}

/** The ID of each catch-up session that takes place. */
function placedIds(context: Context, courseId: string): Set<string> {
  const { ref } = context;
  return new Set(
    sessionsBetween(context, ref.year.from, ref.year.to, new Set([courseId])).flatMap((one) => one.catchUp ?? []),
  );
}

/** The class's sessions not held and marked to be made up that no catch-up session taking place names, oldest first. */
export function makeUpsDue(context: Context, courseId: string): SessionRef[] {
  const { state } = context;
  const placed = placedIds(context, courseId);
  const named = new Set(
    [...state.catchUps.values()].flatMap((one) =>
      placed.has(one.id) && one.replaces !== undefined ? [one.replaces] : [],
    ),
  );
  return [...state.sessions.values()]
    .flatMap((versions) => {
      const record = current(versions);
      return record !== null &&
        record.outcome === 'not-held' &&
        record.makeUp === true &&
        record.session.courseId === courseId &&
        !named.has(record.session.key)
        ? [record.session]
        : [];
    })
    .sort((a, b) => compareDays(a.day, b.day) || compareSlots(a.slot, b.slot));
}

/** The session or catch-up session that takes the teacher's time when the class's `slot` is on `day`, or null. */
export function clashOf(
  context: Context,
  courseId: string,
  day: Day,
  slot: Slot,
  meets: Meets = sameSlot,
): Session | CatchUpSession | null {
  const school = schoolOf(context, courseId);
  if (school === undefined) return null;
  const taken = takenBetween(context, day, day).get(day) ?? [];
  return taken.find((one) => meets(day, { school, slot }, one.at))?.one ?? null;
}

/** The first `most` free times from `from` to `to`, in order of day and of the slots `slotsOn` gives. */
export function freeSlots(
  context: Context,
  courseId: string,
  from: Day,
  to: Day,
  slotsOn: (day: Day) => readonly Slot[],
  meets: Meets = sameSlot,
  most = 6,
): FreeSlot[] {
  const { ref, state, calendar } = context;
  const course = state.courses.get(courseId);
  const schoolClass = course && state.classes.get(course.classId);
  const school = schoolOf(context, courseId);
  if (course === undefined || schoolClass === undefined || school === undefined) return [];
  const first = maxDay(from, ref.year.from);
  const last = minDay(to, ref.year.to);
  if (compareDays(first, last) > 0) return [];
  const taken = takenBetween(context, first, last);
  const forLevel = forGrade(schoolClass, courseGrade(course, schoolClass));
  const found: FreeSlot[] = [];
  for (const day of eachDay(first, last)) {
    if (!ref.country.workingDays.includes(weekday(day))) continue;
    const parity = calendar.parityOn(day, school);
    const blocks = (versionOn(state.timetables, day)?.blocks ?? []).filter(
      (block) => block.weeks === undefined || block.weeks === 'every' || block.weeks === parity,
    );
    for (const slot of slotsOn(day)) {
      if (blocks.some((block) => blockCovers(block, weekday(day), slot))) continue;
      const info = calendar.info(day, school, forLevel, slot.half);
      if (!info.schoolDay || info.closure !== null || info.exam !== null || info.teacher !== null) continue;
      if ((taken.get(day) ?? []).some((one) => meets(day, { school, slot }, one.at))) continue;
      found.push({ day, slot });
      if (found.length === most) return found;
    }
  }
  return found;
}

function checkFree(context: Context, catchUp: CatchUpSession, meets: Meets): void {
  const { ref, state } = context;
  if (state.catchUps.has(catchUp.id)) throw new RangeError('The catch-up session exists');
  if (!isWithin(catchUp.day, ref.year.from, ref.year.to)) throw new RangeError('The day is outside the school year');
  if (clashOf(context, catchUp.courseId, catchUp.day, catchUp.slot, meets) !== null) {
    throw new RangeError('The teacher has a session at this time');
  }
  const { replaces } = catchUp;
  if (replaces !== undefined && !makeUpsDue(context, catchUp.courseId).some((one) => one.key === replaces)) {
    throw new RangeError('No such make-up due');
  }
}

/**
 * The event that adds a catch-up session for a class on `day` at `slot`,
 * from `today` to the year's end, for the whole class or, when it makes up
 * a session, for that session's group and with its type.
 */
export function addCatchUp(
  context: Context,
  input: { readonly id: string; readonly courseId: string; readonly day: Day; readonly slot: Slot },
  today: Day,
  replaces?: string,
  meets: Meets = sameSlot,
): RecordEvent {
  const { ref, state } = context;
  const { id, courseId, day, slot } = input;
  const course = state.courses.get(courseId);
  const schoolClass = course && state.classes.get(course.classId);
  if (course === undefined || schoolClass === undefined) throw new RangeError('No such course');
  if (compareDays(day, today) < 0) throw new RangeError('A catch-up session is added from today on');
  const made = replaces === undefined ? undefined : makeUpsDue(context, courseId).find((one) => one.key === replaces);
  if (replaces !== undefined && made === undefined) throw new RangeError('No such make-up due');
  const lesson = ref.country.sessionTypes.find((type) => type.queue === 'main');
  const sessionType = (made && current(state.sessions.get(made.key)))?.sessionType ?? lesson?.code;
  if (sessionType === undefined) throw new RangeError('The country has no lesson type');
  const catchUp: CatchUpSession = {
    id,
    courseId,
    groupId: made?.groupId ?? wholeGroup(schoolClass).id,
    day,
    slot,
    sessionType,
    ...(made !== undefined && { replaces: made.key }),
  };
  checkFree(context, catchUp, meets);
  return { kind: 'catchup.set', catchUp };
}

/** The event that brings back a cancelled catch-up session as it was, refused when its time or its make-up is taken. */
export function restoreCatchUp(context: Context, catchUp: CatchUpSession, meets: Meets = sameSlot): RecordEvent {
  if (!context.state.courses.has(catchUp.courseId)) throw new RangeError('No such course');
  checkFree(context, catchUp, meets);
  return { kind: 'catchup.set', catchUp };
}

function recorded(context: Context, catchUp: CatchUpSession, placed: ReadonlySet<string>): boolean {
  const key = sessionKey(catchUp.courseId, catchUp.day, catchUp.slot, catchUp.groupId);
  return placed.has(catchUp.id) && current(context.state.sessions.get(key)) !== null;
}

/** A class's catch-up sessions not yet recorded, which can still be cancelled, in order. */
export function openCatchUps(context: Context, courseId: string): OpenCatchUp[] {
  const placed = placedIds(context, courseId);
  return [...context.state.catchUps.values()]
    .filter((catchUp) => catchUp.courseId === courseId && !recorded(context, catchUp, placed))
    .sort((a, b) => compareDays(a.day, b.day) || compareSlots(a.slot, b.slot))
    .map((catchUp) => ({ catchUp, placed: placed.has(catchUp.id) }));
}

/** The event that cancels a catch-up session, refused once it is recorded. */
export function cancelCatchUp(context: Context, id: string): RecordEvent {
  const catchUp = context.state.catchUps.get(id);
  if (catchUp === undefined) throw new RangeError('No such catch-up session');
  if (recorded(context, catchUp, placedIds(context, catchUp.courseId))) {
    throw new RangeError('A recorded catch-up session stays');
  }
  return { kind: 'catchup.removed', id };
}
