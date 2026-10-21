// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How a session is named and ordered: by its course, day, slot and group,
// never by a clock time (PRD §3.3), and in the order of the day and slot.
// And the calendar mark a session added to a day keeps: a closure, an exam
// or the teacher's own calendar, never the day off it was added on.

import type { Context } from './context.ts';
import { compareDays, type Day } from './day.ts';
import { compareSlots, slotKey, type Slot, type TimetableVersion } from './records.ts';
import type { CalendarMark, Session } from './sessions.ts';

/**
 * A timetable session as a day that adds sessions takes it: its course,
 * slot, group and weeks, whatever the entry's ID.
 */
export function takeKey(
  entry: Pick<TimetableVersion['entries'][number], 'courseId' | 'slot' | 'groupId' | 'weeks'>,
): string {
  return `${entry.courseId}/${slotKey(entry.slot)}/${entry.groupId}/${entry.weeks}`;
}

export function sessionKey(courseId: string, day: Day, slot: Slot, groupId: string): string {
  return `${courseId}/${day}/${slotKey(slot)}/${groupId}`;
}

function compareIds(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function compareSessions(a: Session, b: Session): number {
  return (
    compareDays(a.day, b.day) ||
    compareSlots(a.slot, b.slot) ||
    compareIds(a.courseId, b.courseId) ||
    compareIds(a.groupId, b.groupId)
  );
}

export function markOf(info: ReturnType<Context['calendar']['info']>): CalendarMark | null {
  if (info.closure !== null) return 'closure';
  if (info.exam !== null) return 'exam';
  return info.teacher !== null ? 'teacher' : null;
}

/**
 * Whether a session added to a day takes the place of the usual one at its
 * key: one lost to a holiday, or to a mark the added one is free of.
 */
export function takesPlace(usual: Session | undefined, added: Session): boolean {
  return usual === undefined || usual.calendar === 'holiday' || (usual.calendar !== null && added.calendar === null);
}
