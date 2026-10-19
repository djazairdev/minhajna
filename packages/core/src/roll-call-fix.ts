// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Correcting one pupil in a roll call already taken (PRD §3.4, §5.5): the
// mark it becomes, the reason, and what the month's totals become. The
// correction is a new version of the whole roll call, so the history keeps
// both, with their days and order and no clock time, and a pupil's changes
// can be listed from them. Absences are justified or not; the cause is
// never typed (PRD §5.6).

import type { Context } from './context.ts';
import type { RecordEvent } from './events.ts';
import { compareDays, type Day } from './day.ts';
import { compareHalves, type Half, type RollCall } from './records.ts';
import { countMonth, type PupilCount } from './roll-call-counts.ts';
import { pupilsFor, type Marks, type RollCallUnit } from './roll-call.ts';
import { current, type State } from './state.ts';

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
 * it was is refused, so the history holds no empty correction. Only that
 * pupil must be on the roll call's list now: the others' marks stay as they
 * were taken, even if a pupil has since changed group or left.
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
  if (mark !== 'present' && !pupilsFor(context, unit).some((pupil) => pupil.id === pupilId)) {
    throw new RangeError('A marked pupil is not on this roll call');
  }
  const marks = withMark(rollCall, pupilId, mark);
  return {
    kind: 'roll-call.taken',
    rollCall: {
      ...rollCall,
      absent: marks.absent.map(({ pupilId: id, justified }) => ({ pupilId: id, justified })),
      late: [...marks.late],
    },
    reason,
  };
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

/** One change to a pupil's mark: the roll call's day and half, when it was recorded, and why. */
export interface MarkChange {
  /** The roll call's unit key. */
  readonly unit: string;
  readonly day: Day;
  readonly half: Half;
  /** The day the change was recorded. */
  readonly changed: Day;
  readonly from: PupilMark;
  readonly to: PupilMark;
  readonly reason?: string;
}

/**
 * Every change to the pupil's marks after a roll call was first taken
 * (R-3.4-18): by the day each was recorded, then by the roll call's day,
 * half and unit, a roll call's own changes in their order.
 */
export function pupilChanges(state: State, pupilId: string): MarkChange[] {
  const changes: MarkChange[] = [];
  for (const [unit, versions] of state.rollCalls) {
    versions.forEach((version, index) => {
      const before = versions[index - 1]?.value;
      if (before === undefined) return;
      const from = markOf(before, pupilId);
      const to = markOf(version.value, pupilId);
      if (from === to) return;
      const { day, half } = version.value;
      const change = { unit, day, half, changed: version.day, from, to };
      changes.push(version.reason === undefined ? change : { ...change, reason: version.reason });
    });
  }
  return changes.sort(
    (a, b) =>
      compareDays(a.changed, b.changed) ||
      compareDays(a.day, b.day) ||
      compareHalves(a.half, b.half) ||
      a.unit.localeCompare(b.unit),
  );
}
