// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A re-pace the teacher confirmed (#229, PRD §4.7, R-4.7-29, R-4.7-30,
// answer 366): a new distribution of the rest of the term. It keeps how far
// behind the current distribution the class was when it was confirmed, and
// from the day it applies the class's pace is measured against the new one:
// the reference moves back by that much. It never changes what a session
// proposes. Each re-pace is measured on the ones before it, so their shifts
// add up. It applies from the day it is recorded, in primary too, where the
// director's approval date is kept with it, with the printed draft the
// director approved (Decision 839 Art. 12, answers 369 and 372).

import { lineageIds } from './lineage.ts';
import { compareDays, type Day } from './day.ts';
import type { State } from './state-type.ts';

export interface Repace {
  readonly id: string;
  readonly courseId: string;
  /** The day the teacher recorded it, which it applies from. */
  readonly on: Day;
  /** The draft's first and last days: the first session not yet recorded, and the day before the exams. */
  readonly from: Day;
  readonly to: Day;
  /** How far behind the current distribution the class was, in sessions of the plan, buffers included. */
  readonly gap: number;
  /** For a week pack, the same in plan weeks. */
  readonly weeks?: number;
  /** The decisions confirmed with it, by ID. */
  readonly decisions: readonly string[];
  /** In primary, the day the director approved it. */
  readonly approved?: Day;
  /** In primary, the ID of the print the director approved, so later drafts count only later prints. */
  readonly print?: string;
}

/** A course's re-paces, oldest first, in the order recorded. */
export function repacesOf(state: State, courseId: string): Repace[] {
  const courses = new Set(lineageIds(state, courseId));
  return [...state.repaces.values()]
    .filter((repace) => courses.has(repace.courseId))
    .sort((a, b) => compareDays(a.on, b.on));
}

/** How far a course's re-paces applying on `today` move its reference back, in sessions and plan weeks. */
export function repaceShift(state: State, courseId: string, today: Day): { gap: number; weeks: number } {
  const applying = repacesOf(state, courseId).filter((repace) => compareDays(repace.on, today) <= 0);
  return {
    gap: applying.reduce((sum, repace) => sum + repace.gap, 0),
    weeks: applying.reduce((sum, repace) => sum + (repace.weeks ?? 0), 0),
  };
}
