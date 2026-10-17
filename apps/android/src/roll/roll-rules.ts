// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind the Roll screen (#38): the roll-call unit a session
// belongs to, the marks a roll call starts from, and one tap's change.
// Absent and late exclude each other: a pupil who came late is present
// (PRD §3.4). A roll call started and left keeps its marks until it is
// saved, so stepping away from the screen loses nothing (PRD §6.8).

import {
  compareDays,
  compareSessions,
  current,
  pupilsFor,
  rollCallUnits,
  type Context,
  type Day,
  type Marks,
  type RollCallUnit,
} from '@minhajna/core';

/** Every class's roll-call units from `from` to `to`, in the order of their first sessions. */
function unitsBetween(context: Context, from: Day, to: Day): RollCallUnit[] {
  return [...new Set([...context.state.courses.values()].map((course) => course.classId))]
    .flatMap((classId) => rollCallUnits(context, classId, from, to))
    .sort((a, b) => compareSessions(a.sessions[0], b.sessions[0]));
}

/** The unit that covers a session: the session itself, or its half-day. */
export function unitOf(context: Context, sessionKey: string, day: Day): RollCallUnit | null {
  return unitsBetween(context, day, day).find((unit) => unit.sessions.some((one) => one.key === sessionKey)) ?? null;
}

/**
 * The roll calls still to enter from the paper sheet between two days: a
 * class list to call, no roll call recorded, and not every session
 * recorded as not held.
 */
export function rollsToEnter(context: Context, from: Day, to: Day): RollCallUnit[] {
  if (compareDays(from, to) > 0) return [];
  return unitsBetween(context, from, to).filter(
    (unit) =>
      current(context.state.rollCalls.get(unit.key)) === null &&
      pupilsFor(context, unit).length > 0 &&
      !unit.sessions.every((session) => current(context.state.sessions.get(session.key))?.outcome === 'not-held'),
  );
}

/** The marks recorded for a unit, or null before its roll call is taken. */
export function recordedMarks(context: Context, unit: RollCallUnit): Marks | null {
  const record = current(context.state.rollCalls.get(unit.key));
  return record === null ? null : { absent: record.absent, late: record.late };
}

/** The day the roll call was last recorded, or null before it is taken. */
export function takenOn(context: Context, unit: RollCallUnit): Day | null {
  return context.state.rollCalls.get(unit.key)?.at(-1)?.day ?? null;
}

export const noMarks: Marks = { absent: [], late: [] };

const started = new Map<string, Marks>();

/** The marks a roll call was left with, kept in memory only. */
export function startedMarks(key: string): Marks | null {
  return started.get(key) ?? null;
}

export function keepMarks(key: string, marks: Marks | null): void {
  if (marks === null) started.delete(key);
  else started.set(key, marks);
}

/** One tap: marking a pupil absent clears their lateness, and the other way round. */
export function mark(marks: Marks, pupilId: string, kind: 'absent' | 'late', on: boolean): Marks {
  const absent = marks.absent.filter((absence) => absence.pupilId !== pupilId);
  const late = marks.late.filter((id) => id !== pupilId);
  if (!on) return { absent, late };
  return kind === 'absent'
    ? { absent: [...absent, { pupilId, justified: false }], late }
    : { absent, late: [...late, pupilId] };
}

/** Whether two sets of marks say the same, in any order. */
export function sameMarks(a: Marks, b: Marks): boolean {
  const key = (marks: Marks) =>
    [
      ...marks.absent.map((absence) => `a:${absence.pupilId}:${absence.justified}`),
      ...marks.late.map((id) => `l:${id}`),
    ]
      .sort()
      .join(',');
  return key(a) === key(b);
}

/** The figures over the list: present, absent and late. */
export function counts(context: Context, unit: RollCallUnit, marks: Marks) {
  const pupils = pupilsFor(context, unit).length;
  return { present: pupils - marks.absent.length, absent: marks.absent.length, late: marks.late.length };
}

/** Why a roll call already taken is corrected; never a detail about a pupil (PRD §5.5, §5.6). */
export const fixReasons = ['arrived-late', 'entry-error', 'administration', 'other'] as const;
export type FixReason = (typeof fixReasons)[number];
