// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A course that continues another (#231, Reorient, R-4.7-39, answer 391):
// when the school reshapes its classes, each new class's course names the
// old class's course whose history it takes, from the day of the
// reorientation. The new course reads the old one's recorded sessions
// before that day, its plan changes and decisions, its layers, its own list
// and its support and remediation lists, as if they were its own; the old
// class is archived from that day and has no sessions after it.

import type { Day } from './day.ts';
import type { PlanDecision } from './plan-decisions.ts';
import type { State } from './state-type.ts';

type Decisions = ReadonlyMap<string, PlanDecision>;

/** A course the course continues, nearest first, with the day from which its successor takes over. */
export interface Ancestor {
  readonly courseId: string;
  readonly until: Day;
}

/** The courses `courseId` continues, nearest first; none for a course that continues none. */
export function ancestors(state: Pick<State, 'courses'>, courseId: string): readonly Ancestor[] {
  const found: Ancestor[] = [];
  const seen = new Set([courseId]);
  let next = state.courses.get(courseId)?.continues;
  while (next !== undefined && !seen.has(next.courseId)) {
    found.push({ courseId: next.courseId, until: next.from });
    seen.add(next.courseId);
    next = state.courses.get(next.courseId)?.continues;
  }
  return found;
}

/** The course and the courses it continues, nearest first. */
export function lineageIds(state: Pick<State, 'courses'>, courseId: string): readonly string[] {
  return [courseId, ...ancestors(state, courseId).map((one) => one.courseId)];
}

const views = new WeakMap<Decisions, Map<string, Decisions>>();

/**
 * The plan decisions as `courseId` sees them: those of the courses it
 * continues read as its own, under their own IDs, so the items their
 * changes made keep their IDs. Without ancestors, the decisions as they are.
 */
export function courseDecisions(state: Pick<State, 'courses' | 'decisions'>, courseId: string): Decisions {
  const older = ancestors(state, courseId).map((one) => one.courseId);
  if (older.length === 0) return state.decisions;
  const byCourse = views.get(state.decisions) ?? new Map<string, Decisions>();
  views.set(state.decisions, byCourse);
  const key = `${courseId}/${older.join('/')}`;
  const known = byCourse.get(key);
  if (known !== undefined) return known;
  const view = new Map(
    [...state.decisions].map(([id, decision]): [string, PlanDecision] => [
      id,
      older.includes(decision.courseId) ? { ...decision, courseId } : decision,
    ]),
  );
  byCourse.set(key, view);
  return view;
}

/** The first of the course's lineage that has a value for `read`, nearest first. */
export function inherited<T>(state: Pick<State, 'courses'>, courseId: string, read: (id: string) => T | undefined) {
  for (const id of lineageIds(state, courseId)) {
    const value = read(id);
    if (value !== undefined) return value;
  }
  return undefined;
}
