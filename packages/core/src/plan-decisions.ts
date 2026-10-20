// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the teacher decided when the plan would push an item past an exam
// window (#221, PRD §4.7, R-4.7-32, answer 268): leave out an item the pack
// marks optional, merge two items the pack says may be merged, or postpone
// the items past the window, which keeps them in the plan, in the first
// sessions after the exams, until they are taught. Nothing is applied before
// the teacher chooses, and every decision can be taken back. A decision
// never deletes a recorded session: the past never moves (PRD §4.6).
// A decision the course's pack does not allow, such as leaving out an item
// it does not mark optional, is never applied, even from another release.
// Two items merge only when they stand side by side in one of the pack's
// merge groups. They are taught in the session of the one the plan puts
// first, and an item takes part in one merge only, the first one made.

import type { PlanPack } from './pack.ts';
import { isChange, joinsOf, type PlanChange } from './plan-layer.ts';

/** An answer to an exam window (#221). */
export type ExamDecision =
  | {
      readonly id: string;
      readonly courseId: string;
      readonly kind: 'leave-out';
      readonly item: string;
    }
  | {
      readonly id: string;
      readonly courseId: string;
      readonly kind: 'merge';
      /** Taught together in one session, the first item's session. */
      readonly items: readonly [string, string];
    }
  | {
      readonly id: string;
      readonly courseId: string;
      readonly kind: 'postpone';
      /** The items the teacher accepts to teach after the window. */
      readonly items: readonly string[];
      readonly term: number;
    };

/** An exam-window answer, or one of the class's own changes to its plan (#225). */
export type PlanDecision = ExamDecision | PlanChange;

/** A course's answers to exam windows, in the order made. */
export function decisionsFor(decisions: ReadonlyMap<string, PlanDecision>, courseId: string): ExamDecision[] {
  return [...decisions.values()].filter(
    (decision): decision is ExamDecision => !isChange(decision) && decision.courseId === courseId,
  );
}

/** Whether a course's pack allows a decision: an optional item, two items it lets merge, items it has. */
export function allowedBy(pack: PlanPack, decision: PlanDecision): boolean {
  if (isChange(decision)) return false;
  const has = (id: string): boolean => pack.items.some((item) => item.id === id && item.kind !== 'unit');
  switch (decision.kind) {
    case 'leave-out':
      return pack.items.some((item) => item.id === decision.item && item.optional === true);
    case 'merge': {
      const [a, b] = decision.items;
      return pack.merges.some(
        (group) => group.includes(a) && group.includes(b) && Math.abs(group.indexOf(a) - group.indexOf(b)) === 1,
      );
    }
    case 'postpone':
      return decision.items.length > 0 && decision.items.every(has);
  }
}

/** A course's merges the pack allows, from the item the plan puts first to the other. */
export function mergesOf(
  pack: PlanPack,
  decisions: ReadonlyMap<string, PlanDecision>,
  courseId: string,
): ReadonlyMap<string, string> {
  const order = (id: string): number => pack.items.findIndex((item) => item.id === id);
  const merges = new Map<string, string>();
  const taken = new Set<string>();
  for (const decision of decisionsFor(decisions, courseId)) {
    if (decision.kind !== 'merge' || !allowedBy(pack, decision)) continue;
    const [first, second] = [...decision.items].sort((a, b) => order(a) - order(b)) as [string, string];
    if (taken.has(first) || taken.has(second)) continue;
    merges.set(first, second);
    taken.add(first).add(second);
  }
  for (const [first, second] of joinsOf(pack, decisions, courseId)) {
    if (taken.has(first) || taken.has(second)) continue;
    merges.set(first, second);
    taken.add(first).add(second);
  }
  return merges;
}

/** Whether the teacher may still merge two items: the pack allows it, and neither is in a merge yet. */
export function mayMerge(
  pack: PlanPack,
  decisions: ReadonlyMap<string, PlanDecision>,
  courseId: string,
  items: readonly [string, string],
): boolean {
  const merges = mergesOf(pack, decisions, courseId);
  const taken = new Set([...merges.keys(), ...merges.values()]);
  return allowedBy(pack, { id: '', courseId, kind: 'merge', items }) && !taken.has(items[0]) && !taken.has(items[1]);
}
