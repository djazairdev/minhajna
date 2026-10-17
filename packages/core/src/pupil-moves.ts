// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Pupils who join or leave during the year (PRD §3.2). Each move carries
// its day and a coded reason. A pupil who joins is added at the end of the
// list, as on the paper roll-call book, and is called from that day. A
// pupil who leaves stays on the list, with the reason, until the teacher
// records the director's confirmation. Error messages name no pupil, as
// the engineering rules ask.

import type { Context } from './context.ts';
import { compareDays, type Day } from './day.ts';
import type { RecordEvent } from './events.ts';
import type { Pupil, PupilMovement } from './records.ts';
import { isEnrolled } from './roll-call.ts';

/** Why a pupil joined or left: a code, never words about the pupil. */
export const MOVEMENT_REASONS = ['transfer', 'class-change', 'other'] as const;

export type MovementReason = (typeof MOVEMENT_REASONS)[number];

export interface Joining {
  readonly id: string;
  readonly classId: string;
  readonly name: string;
  readonly sex: 'f' | 'm';
  readonly registration?: string;
  readonly day: Day;
  readonly reason: MovementReason;
}

/** A departure the director has not confirmed yet, or null. */
export function pendingDeparture(pupil: Pupil): PupilMovement | null {
  const last = [...pupil.movements].sort((a, b) => compareDays(a.day, b.day)).at(-1);
  return last?.kind === 'out' && last.confirmed !== true ? last : null;
}

/** The event that adds a pupil who joins the class on `joining.day`. */
export function joinPupil(context: Context, joining: Joining): RecordEvent {
  const { state } = context;
  const schoolClass = state.classes.get(joining.classId);
  if (schoolClass === undefined) throw new RangeError('Unknown class');
  if (state.pupils.has(joining.id)) throw new RangeError('The pupil is already listed');
  const name = joining.name.trim();
  if (name === '') throw new RangeError('A pupil needs a name');
  const registration = joining.registration?.trim() ?? '';
  if (registration !== '' && !/^\d+$/.test(registration)) throw new RangeError('A registration number has digits only');
  const school = schoolClass.schoolId;
  const taken = [...state.pupils.values()].some(
    (pupil) => pupil.registration === registration && state.classes.get(pupil.classId)?.schoolId === school,
  );
  if (registration !== '' && taken) throw new RangeError('The registration number is already listed');
  return {
    kind: 'pupil.set',
    pupil: {
      id: joining.id,
      classId: joining.classId,
      name,
      sex: joining.sex,
      ...(registration !== '' && { registration }),
      groups: [],
      movements: [{ day: joining.day, kind: 'in', reason: joining.reason }],
    },
  };
}

/** The event that records a pupil leaving on `day`, to be confirmed by the director. */
export function leavePupil(context: Context, pupilId: string, day: Day, reason: MovementReason): RecordEvent {
  const pupil = context.state.pupils.get(pupilId);
  if (pupil === undefined) throw new RangeError('Unknown pupil');
  if (!isEnrolled(pupil, day)) throw new RangeError('The pupil is not on the list that day');
  if (pendingDeparture(pupil) !== null) throw new RangeError('The departure is already recorded');
  return { kind: 'pupil.moved', pupilId, movement: { day, kind: 'out', reason } };
}

/** The event that records the director's confirmation of a departure. */
export function confirmDeparture(context: Context, pupilId: string): RecordEvent {
  const pupil = context.state.pupils.get(pupilId);
  const pending = pupil === undefined ? null : pendingDeparture(pupil);
  if (pending === null) throw new RangeError('No departure awaits confirmation');
  return { kind: 'pupil.moved', pupilId, movement: { ...pending, confirmed: true } };
}
