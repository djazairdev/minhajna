// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The digital roll-call book (PRD §3.4). Everyone is present by default and
// the teacher marks only the exceptions: absent, justified or not, and late.
// The cause of an absence is never typed, because it is often a health
// matter (PRD §5.6). Roll calls carry legal weight, so a correction needs a
// reason, and every version stays in the history.

import type { Context } from './context.ts';
import { compareDays, type Day } from './day.ts';
import { findLevel, type RollCallUnitKind } from './reference.ts';
import {
  slotKey,
  wholeGroup,
  type Absence,
  type Half,
  type Pupil,
  type RollCall,
  type SchoolClass,
} from './records.ts';
import { sessionsBetween, type Session } from './sessions.ts';
import type { RecordEvent } from './events.ts';
import { current } from './state.ts';

/** One roll call's place: a half-day of a class, or one session of a group. */
export interface RollCallUnit {
  readonly key: string;
  readonly classId: string;
  readonly groupId: string;
  readonly day: Day;
  readonly half: Half;
  /** The sessions it covers. */
  readonly sessions: readonly Session[];
}

function findClass(context: Context, classId: string): SchoolClass {
  const schoolClass = context.state.classes.get(classId);
  if (schoolClass === undefined) throw new RangeError('Unknown class');
  return schoolClass;
}

/** Per half-day or per session, from the class's own setting or its level (PRD §3.4). */
export function unitKind(context: Context, schoolClass: SchoolClass): RollCallUnitKind {
  return schoolClass.rollCallUnit ?? findLevel(context.ref.country, schoolClass.level).rollCallUnit;
}

/**
 * The roll-call units of a class, in order. They come from the teacher's
 * own sessions with the class, so a specialist counts only their own
 * sessions. A joint class's levels share a slot, and so its roll call. Holidays, closures and exams have no roll call. The teacher's
 * own calendar never removes one: the class is still there (PRD §4.5).
 */
export function rollCallUnits(context: Context, classId: string, from: Day, to: Day): RollCallUnit[] {
  const schoolClass = findClass(context, classId);
  const courseIds = new Set(
    [...context.state.courses.values()].filter((course) => course.classId === classId).map((course) => course.id),
  );
  const sessions = sessionsBetween(context, from, to, courseIds).filter(
    (session) => session.calendar === null || session.calendar === 'teacher',
  );

  const bySession = unitKind(context, schoolClass) === 'session';
  const whole = wholeGroup(schoolClass).id;
  const units = new Map<string, { readonly unit: Omit<RollCallUnit, 'sessions'>; readonly sessions: Session[] }>();
  for (const session of sessions) {
    const place = bySession
      ? `${session.day}/${slotKey(session.slot)}/${session.groupId}`
      : `half-day:${classId}/${session.day}/${session.slot.half}`;
    const found = units.get(place);
    if (found !== undefined) found.sessions.push(session);
    else
      units.set(place, {
        unit: {
          key: bySession ? `session:${session.key}` : place,
          classId,
          groupId: bySession ? session.groupId : whole,
          day: session.day,
          half: session.slot.half,
        },
        sessions: [session],
      });
  }
  return [...units.values()].map(({ unit, sessions: covered }) => ({ ...unit, sessions: covered }));
}

/**
 * Whether a pupil is on the class list on `day`, from their movements. A
 * pupil who left stays listed until the teacher records the director's
 * confirmation (PRD §3.2).
 * A pupil whose first movement is an arrival was not on the list before it.
 */
export function isEnrolled(pupil: Pupil, day: Day): boolean {
  const movements = pupil.movements
    .filter((movement) => movement.kind === 'in' || movement.confirmed === true)
    .sort((a, b) => compareDays(a.day, b.day));
  let enrolled = movements[0]?.kind !== 'in';
  for (const movement of movements) {
    if (compareDays(movement.day, day) <= 0) enrolled = movement.kind === 'in';
  }
  return enrolled;
}

/** The pupils a roll call covers, in the class list's order. */
export function pupilsFor(context: Context, unit: RollCallUnit): Pupil[] {
  const schoolClass = findClass(context, unit.classId);
  const whole = wholeGroup(schoolClass).id;
  return [...context.state.pupils.values()].filter(
    (pupil) =>
      pupil.classId === unit.classId &&
      isEnrolled(pupil, unit.day) &&
      (unit.groupId === whole || pupil.groups.includes(unit.groupId)),
  );
}

export interface Marks {
  readonly absent: readonly Absence[];
  readonly late: readonly string[];
}

/**
 * The event that records a roll call. Everyone not marked is present.
 * Correcting a roll call already taken needs a short reason (PRD §5.5).
 * Its error messages name no pupil, as the engineering rules ask.
 */
export function takeRollCall(context: Context, unit: RollCallUnit, marks: Marks, reason?: string): RecordEvent {
  const listed = new Set(pupilsFor(context, unit).map((pupil) => pupil.id));
  const marked = [...marks.absent.map((absence) => absence.pupilId), ...marks.late];
  if (!marked.every((id) => listed.has(id))) throw new RangeError('A marked pupil is not on this roll call');
  if (new Set(marked).size !== marked.length) throw new RangeError('A pupil is marked twice');

  const correction = current(context.state.rollCalls.get(unit.key)) !== null;
  if (correction && (reason === undefined || reason.trim() === '')) {
    throw new RangeError('Correcting a roll call needs a reason');
  }
  const rollCall: RollCall = {
    unit: unit.key,
    classId: unit.classId,
    groupId: unit.groupId,
    day: unit.day,
    half: unit.half,
    absent: marks.absent.map(({ pupilId, justified }) => ({ pupilId, justified })),
    late: [...marks.late],
  };
  return { kind: 'roll-call.taken', rollCall, ...(correction && reason !== undefined && { reason }) };
}
