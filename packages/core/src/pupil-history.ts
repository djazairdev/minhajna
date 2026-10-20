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

/**
 * A roll call already taken keeps the groups as they stood when it was
 * taken, from the dated pupil.set history up to its cutoff; before the
 * list was first recorded, the groups it was first recorded with. Anything
 * not yet taken, even on an earlier day, uses the pupil's current groups.
 */
export function groupsOn(
  pupil: Pupil,
  history: readonly Membership[] | undefined,
  day: Day,
  cutoff = Infinity,
): readonly string[] {
  if (history === undefined || cutoff === Infinity) return pupil.groups;
  const known = history.filter((one) => one.order <= cutoff);
  return (known.filter((one) => one.day <= day).at(-1) ?? known[0])?.groups ?? [];
}
