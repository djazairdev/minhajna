// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The homework record of the texts book (PRD §3.8, R-3.8-19 to 23): each
// piece of homework a course's sessions set, with the day it was set, the
// day it comes back and the activity, and, once the teacher enters them
// when it comes back, two class counts: pupils who did not do it, and
// pupils who relied on someone else. Each count is also a percentage of
// the pupils on the class list on the day it came back, rounded to a whole
// number; in a joint class, the list of the course's level. Counts only,
// never names (R-3.8-22). Homework a corrected session no longer sets
// leaves the record, and counts made for homework due another day are left
// behind, so they never show against other homework or leave the teacher.

import type { Context } from './context.ts';
import { compareDays, type Day } from './day.ts';
import type { RecordEvent } from './events.ts';
import { courseGrade, isJoint, levelGroups } from './joint.ts';
import { compareSlots, type Course, type SessionRef } from './records.ts';
import { pupilsOn } from './roll-call.ts';
import { current, type State } from './state.ts';

/**
 * The two counts the texts book takes when homework comes back (PRD §3.8):
 * class counts only, never names.
 */
export interface HomeworkCount {
  /** The key of the session that set the homework. */
  readonly sessionKey: string;
  /** The day the homework came back: a correction that moves it, or sets other homework, leaves the counts behind. */
  readonly due: Day;
  /** Pupils who did not do it. */
  readonly notDone: number;
  /** Pupils who relied on someone else. */
  readonly reliedOn: number;
}

/** One piece of homework in the record. */
export interface HomeworkItem {
  /** The session that set it. */
  readonly session: SessionRef;
  readonly text: string;
  readonly set: Day;
  readonly due: Day;
  /** The pupils on the class list, for the session's group, on the day it comes back. */
  readonly listed: number;
  readonly count: HomeworkCount | null;
}

/** A count as a percentage of `listed`, rounded to a whole number; null with no list, or a count the list no longer holds. */
export function homeworkPercent(count: number, listed: number): number | null {
  return listed === 0 || count > listed ? null : Math.round((count * 100) / listed);
}

/** The counts of the homework a session sets now, or null: counts left from homework since corrected away do not count. */
export function countOf(state: State, sessionKey: string): HomeworkCount | null {
  const count = current(state.homeworkCounts.get(sessionKey));
  const homework = current(state.sessions.get(sessionKey))?.homework;
  return count !== null && homework !== undefined && compareDays(count.due, homework.due) === 0 ? count : null;
}

/** The pupils on the list for a session's group on `day`; in a joint class, of the course's level only. */
function listed(context: Context, course: Course, groupId: string, day: Day): number {
  const schoolClass = context.state.classes.get(course.classId);
  if (schoolClass === undefined) return 0;
  const pupils = pupilsOn(context, schoolClass.id, groupId, day);
  if (!isJoint(schoolClass)) return pupils.length;
  const level = levelGroups(schoolClass).find((group) => group.grade === courseGrade(course, schoolClass))?.id;
  return level === undefined ? 0 : pupils.filter((pupil) => pupil.groups.includes(level)).length;
}

/** A course's homework, in the order it was set. */
export function homeworkRecord(context: Context, courseId: string): HomeworkItem[] {
  const { state } = context;
  const course = state.courses.get(courseId);
  if (course === undefined) return [];
  const items: HomeworkItem[] = [];
  for (const versions of state.sessions.values()) {
    const record = current(versions);
    if (record === null || record.homework === undefined || record.session.courseId !== courseId) continue;
    const { session, homework } = record;
    items.push({
      session,
      text: homework.text,
      set: session.day,
      due: homework.due,
      listed: listed(context, course, session.groupId, homework.due),
      count: countOf(state, session.key),
    });
  }
  return items.sort(
    (a, b) =>
      compareDays(a.set, b.set) ||
      compareSlots(a.session.slot, b.session.slot) ||
      (a.session.key < b.session.key ? -1 : a.session.key > b.session.key ? 1 : 0),
  );
}

/** The homework of a course's group that comes back on `day`. */
export function homeworkDue(context: Context, courseId: string, groupId: string, day: Day): HomeworkItem[] {
  return homeworkRecord(context, courseId).filter(
    (item) => item.session.groupId === groupId && compareDays(item.due, day) === 0,
  );
}

/**
 * The event that records homework's two counts, or corrects them. Each is a
 * whole number of pupils on the class list, and a pupil is counted once at
 * most, so together they are never more than the list. Homework is counted
 * once it has come back, never before. The error messages name no class or
 * pupil.
 */
export function countHomework(
  context: Context,
  item: HomeworkItem,
  notDone: number,
  reliedOn: number,
  today: Day,
): RecordEvent {
  if (compareDays(item.due, today) > 0) throw new RangeError('Homework is counted once it has come back');
  if (item.listed === 0) throw new RangeError('The class list is empty');
  if (![notDone, reliedOn].every((count) => Number.isSafeInteger(count) && count >= 0)) {
    throw new RangeError('A count is a whole number of pupils');
  }
  if (notDone + reliedOn > item.listed) throw new RangeError('The counts are more than the pupils on the list');
  const record = current(context.state.sessions.get(item.session.key));
  if (record?.homework === undefined) throw new RangeError('The session sets no homework');
  if (compareDays(record.homework.due, item.due) !== 0) throw new RangeError('The homework has changed');
  return { kind: 'homework.counted', count: { sessionKey: item.session.key, due: item.due, notDone, reliedOn } };
}

/** The event that takes homework's counts back; the history keeps them. */
export function uncountHomework(sessionKey: string): RecordEvent {
  return { kind: 'homework.uncounted', sessionKey };
}
