// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The seating plan (PRD §3.4): a class's or group's room, arranged once by
// placing each pupil on a seat, so the teacher takes the roll call by
// tapping seats. Rows run from the board to the back of the room, and
// columns from the start side, with an aisle after every few seats. The
// plan is private: it stays on the teacher's devices (§5.4). Error
// messages name no pupil, as the engineering rules ask.

import type { Context } from './context.ts';
import type { RecordEvent } from './events.ts';
import { wholeGroup, type Pupil, type Seat, type SeatingPlan } from './records.ts';
import { isEnrolled, pupilsFor, type RollCallUnit } from './roll-call.ts';
import type { Day } from './day.ts';

/** The most rows and seats per row a plan holds: room for a class of 120. */
export const MAX_ROWS = 12;
export const MAX_COLUMNS = 10;

/** An aisle after every two seats, every three, or none. */
export const AISLES = [2, 3, 0] as const;

export type Aisle = (typeof AISLES)[number];

/** A new plan of 6 rows of 6 seats in pairs, all empty, as the design starts it. */
export function newPlan(classId: string, groupId: string): SeatingPlan {
  return { classId, groupId, rows: 6, columns: 6, aisleEvery: 2, seats: [] };
}

/** The plan recorded for a class's group, or null. */
export function planOf(context: Context, classId: string, groupId: string): SeatingPlan | null {
  return context.state.seating.get(`${classId}/${groupId}`) ?? null;
}

/** The pupils a group's plan seats on `day`, in the class list's order. */
export function groupPupils(context: Context, classId: string, groupId: string, day: Day): Pupil[] {
  const schoolClass = context.state.classes.get(classId);
  if (schoolClass === undefined) return [];
  const whole = wholeGroup(schoolClass).id;
  return [...context.state.pupils.values()].filter(
    (pupil) =>
      pupil.classId === classId && isEnrolled(pupil, day) && (groupId === whole || pupil.groups.includes(groupId)),
  );
}

/** The plan with another number of rows and seats per row; pupils on seats that go are unseated. */
export function resizePlan(plan: SeatingPlan, rows: number, columns: number): SeatingPlan {
  const r = Math.min(MAX_ROWS, Math.max(1, Math.round(rows)));
  const c = Math.min(MAX_COLUMNS, Math.max(1, Math.round(columns)));
  return { ...plan, rows: r, columns: c, seats: plan.seats.filter((seat) => seat.row < r && seat.column < c) };
}

/** The pupil on a seat, or null. */
export function pupilAt(plan: SeatingPlan, row: number, column: number): string | null {
  return plan.seats.find((seat) => seat.row === row && seat.column === column)?.pupilId ?? null;
}

/** The pupil's seat, or null. */
export function seatOf(plan: SeatingPlan, pupilId: string): Seat | null {
  return plan.seats.find((seat) => seat.pupilId === pupilId) ?? null;
}

/**
 * The plan with a pupil on a seat. A pupil already seated moves, and the
 * seat's former pupil takes the moving pupil's old seat, or is unseated.
 */
export function seatPupil(plan: SeatingPlan, pupilId: string, row: number, column: number): SeatingPlan {
  if (row < 0 || row >= plan.rows || column < 0 || column >= plan.columns) throw new RangeError('No such seat');
  const from = seatOf(plan, pupilId);
  const other = pupilAt(plan, row, column);
  const seats = plan.seats.filter((seat) => seat.pupilId !== pupilId && seat.pupilId !== other);
  seats.push({ row, column, pupilId });
  if (other !== null && other !== pupilId && from !== null) seats.push({ ...from, pupilId: other });
  return { ...plan, seats };
}

/** The plan with a seat emptied. */
export function emptySeat(plan: SeatingPlan, row: number, column: number): SeatingPlan {
  return { ...plan, seats: plan.seats.filter((seat) => seat.row !== row || seat.column !== column) };
}

/** The plan with every seat empty. */
export function emptyAll(plan: SeatingPlan): SeatingPlan {
  return { ...plan, seats: [] };
}

/** The plan with the pupils still unseated placed on the empty seats, in list order, from the board. */
export function fillInListOrder(plan: SeatingPlan, pupils: readonly Pupil[]): SeatingPlan {
  const seated = new Set(plan.seats.map((seat) => seat.pupilId));
  const waiting = pupils.filter((pupil) => !seated.has(pupil.id));
  const seats = [...plan.seats];
  for (let row = 0; row < plan.rows; row++) {
    for (let column = 0; column < plan.columns; column++) {
      if (waiting.length === 0) return { ...plan, seats };
      if (pupilAt(plan, row, column) === null) seats.push({ row, column, pupilId: waiting.shift()!.id });
    }
  }
  return { ...plan, seats };
}

/** The event that records a plan, once checked against the class and its group. */
export function setSeating(context: Context, plan: SeatingPlan): RecordEvent {
  const schoolClass = context.state.classes.get(plan.classId);
  if (schoolClass === undefined) throw new RangeError('Unknown class');
  if (!schoolClass.groups.some((group) => group.id === plan.groupId)) throw new RangeError('Unknown group');
  const fits = (value: number, most: number) => Number.isInteger(value) && value >= 1 && value <= most;
  if (!fits(plan.rows, MAX_ROWS) || !fits(plan.columns, MAX_COLUMNS)) throw new RangeError('The room is too large');
  if (plan.aisleEvery !== undefined && !(AISLES as readonly number[]).includes(plan.aisleEvery))
    throw new RangeError('Unknown aisle');
  const places = new Set<string>();
  const pupils = new Set<string>();
  for (const seat of plan.seats) {
    if (seat.row < 0 || seat.row >= plan.rows || seat.column < 0 || seat.column >= plan.columns)
      throw new RangeError('A seat lies outside the room');
    const place = `${seat.row}/${seat.column}`;
    if (places.has(place) || pupils.has(seat.pupilId)) throw new RangeError('A seat or a pupil appears twice');
    places.add(place);
    pupils.add(seat.pupilId);
    if (context.state.pupils.get(seat.pupilId)?.classId !== plan.classId)
      throw new RangeError('A pupil is not in the class');
  }
  return { kind: 'seating.set', plan };
}

export interface SeatedRoll {
  /** By row from the board, then by column: the pupil on each seat, or null. */
  readonly seats: readonly (readonly (Pupil | null)[])[];
  /** The unit's pupils with no seat, such as one who joined after the plan was made. */
  readonly unseated: readonly Pupil[];
}

/** A roll call's pupils on its group's plan, or null when the group has no plan. */
export function seatedRoll(context: Context, unit: RollCallUnit): SeatedRoll | null {
  const plan = planOf(context, unit.classId, unit.groupId);
  if (plan === null) return null;
  const pupils = new Map(pupilsFor(context, unit).map((pupil) => [pupil.id, pupil]));
  const seats = Array.from({ length: plan.rows }, (_, row) =>
    Array.from({ length: plan.columns }, (_, column) => {
      const id = pupilAt(plan, row, column);
      return id === null ? null : (pupils.get(id) ?? null);
    }),
  );
  const seated = new Set(plan.seats.map((seat) => seat.pupilId));
  return { seats, unseated: [...pupils.values()].filter((pupil) => !seated.has(pupil.id)) };
}
