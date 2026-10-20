// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { compareDays, type Day } from './day.ts';
import type { Pupil, PupilMovement } from './records.ts';

export interface Movement {
  readonly movement: PupilMovement;
  readonly order: number;
}

export interface Membership {
  readonly day: Day;
  readonly order: number;
  readonly groups: readonly string[];
}

/** Name corrections never discard separately recorded movements. */
export function withMovements(pupil: Pupil, order: number, moved: readonly Movement[]): Pupil {
  const latest = new Map<string, Movement>();
  const all = [...pupil.movements.map((movement) => ({ movement, order })), ...moved].sort((a, b) => a.order - b.order);
  for (const candidate of all) latest.set(`${candidate.movement.day}/${candidate.movement.kind}`, candidate);
  const movements = [...latest.values()]
    .sort((a, b) => compareDays(a.movement.day, b.movement.day) || a.order - b.order)
    .map((candidate) => candidate.movement);
  return { ...pupil, movements };
}

/** Existing pupil.set history supplies dated membership; a taken roll call also fixes its history cutoff. */
export function groupsOn(
  pupil: Pupil,
  history: readonly Membership[] | undefined,
  day: Day,
  cutoff = Infinity,
): readonly string[] {
  if (history === undefined) return pupil.groups;
  return history.filter((one) => one.day <= day && one.order <= cutoff).at(-1)?.groups ?? [];
}
