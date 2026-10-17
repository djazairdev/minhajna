// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Correcting one pupil in a roll call already taken (PRD §3.4, §5.5): the
// mark it becomes, the reason, and what the month's totals become. The
// correction is a new version of the whole roll call, so the history keeps
// both, with their days and order and no clock time. Absences are justified
// or not; the cause is never typed (PRD §5.6).

import type { Context } from './context.ts';
import type { RecordEvent } from './events.ts';
import type { RollCall } from './records.ts';
import { countMonth, type PupilCount } from './roll-call-counts.ts';
import { takeRollCall, type Marks, type RollCallUnit } from './roll-call.ts';
import { current } from './state.ts';

/** A pupil's mark in one roll call. */
export type PupilMark = 'present' | 'late' | 'justified' | 'unjustified';

/** Why a roll call was corrected: a code, never words about a pupil. */
export const ROLL_CALL_REASONS = ['arrived-late', 'entry-error', 'administration', 'other'] as const;

export type RollCallReason = (typeof ROLL_CALL_REASONS)[number];

export function markOf(rollCall: RollCall, pupilId: string): PupilMark {
  const absence = rollCall.absent.find((candidate) => candidate.pupilId === pupilId);
  if (absence !== undefined) return absence.justified ? 'justified' : 'unjustified';
  return rollCall.late.includes(pupilId) ? 'late' : 'present';
}

/** The marks with one pupil's changed. */
export function withMark(rollCall: RollCall, pupilId: string, mark: PupilMark): Marks {
  const absent = rollCall.absent.filter((absence) => absence.pupilId !== pupilId);
  const late = rollCall.late.filter((id) => id !== pupilId);
  if (mark === 'late') return { absent, late: [...late, pupilId] };
  if (mark === 'present') return { absent, late };
  return { absent: [...absent, { pupilId, justified: mark === 'justified' }], late };
}

function recorded(context: Context, unit: RollCallUnit): RollCall {
  const rollCall = current(context.state.rollCalls.get(unit.key));
  if (rollCall === null) throw new RangeError('No roll call to correct');
  return rollCall;
}

/**
 * The event that corrects one pupil's mark, with its reason. A mark left as
 * it was is refused, so the history holds no empty correction.
 */
export function correctPupil(
  context: Context,
  unit: RollCallUnit,
  pupilId: string,
  mark: PupilMark,
  reason: RollCallReason,
): RecordEvent {
  const rollCall = recorded(context, unit);
  if (markOf(rollCall, pupilId) === mark) throw new RangeError('The mark does not change');
  return takeRollCall(context, unit, withMark(rollCall, pupilId, mark), reason);
}

/** The pupil's totals for the unit's month, before and after the correction. */
export function previewCorrection(
  context: Context,
  unit: RollCallUnit,
  pupilId: string,
  mark: PupilMark,
): { readonly before: PupilCount | null; readonly after: PupilCount | null } {
  const rollCall = recorded(context, unit);
  const marks = withMark(rollCall, pupilId, mark);
  const versions = context.state.rollCalls.get(unit.key) ?? [];
  const rollCalls = new Map(context.state.rollCalls);
  rollCalls.set(unit.key, [...versions, { entry: 'preview', day: unit.day, value: { ...rollCall, ...marks } }]);
  const month = unit.day.slice(0, 7);
  const find = (target: Context) =>
    countMonth(target, unit.classId, month).pupils.find((count) => count.pupilId === pupilId) ?? null;
  return { before: find(context), after: find({ ...context, state: { ...context.state, rollCalls } }) };
}
