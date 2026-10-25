// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What each of a class's changes costs its plan, in sessions (#225,
// Plan-changes, R-4.7-35): the main plan's sessions with the change, less
// those without it, the changes before it applied in their order. A
// positive count is taken from the buffers, a negative one given back.
// Every session counts, buffers too, and items left out count none. Two
// items merged or joined are taught in one session, so the pair takes one.
// The counts add up to what all the changes cost together, over the
// district and school layers the class has on (#226).

import { courseDecisions } from './lineage.ts';
import type { Context } from './context.ts';
import { budgetInSessions, queueItems, type PlanPack } from './pack.ts';
import { mergesOf, type PlanDecision } from './plan-decisions.ts';
import { changesFor, isChange, layered, skippedBy } from './plan-layer.ts';
import { packKey } from './reference.ts';
import { courseSetup } from './choices.ts';
import { courseLayers } from './variant-layers.ts';

/** Each change in force, by its ID, with the sessions it takes from the buffers, or gives back when negative. */
export function changeEffects(context: Context, courseId: string): ReadonlyMap<string, number> {
  const { course, sessionMinutes } = courseSetup(context, courseId);
  const effects = new Map<string, number>();
  const pin = course.pack;
  const pack = pin === null ? undefined : context.ref.packs.get(packKey(pin.id, pin.release));
  if (pack === undefined) return effects;
  const own = courseDecisions(context, courseId);
  const others = [...own].filter(([, one]) => !isChange(one) || one.courseId !== courseId);
  const changes = changesFor(own, courseId);
  const total = (count: number): number => {
    const decisions = new Map<string, PlanDecision>([
      ...others,
      ...changes.slice(0, count).map((one) => [one.id, one] as const),
    ]);
    const plan = layered(pack, decisions, courseId, sessionMinutes, courseLayers(context.state, courseId));
    return sessionsOf(plan, decisions, courseId, sessionMinutes);
  };
  let before = total(0);
  changes.forEach((change, index) => {
    const after = total(index + 1);
    effects.set(change.id, after - before);
    before = after;
  });
  return effects;
}

function sessionsOf(
  plan: PlanPack,
  decisions: ReadonlyMap<string, PlanDecision>,
  courseId: string,
  sessionMinutes: number,
): number {
  const skipped = new Set(skippedBy(plan, decisions, courseId));
  const main = queueItems(plan, 'main').filter((item) => !skipped.has(item.id));
  const sessions = new Map(main.map((item) => [item.id, budgetInSessions(plan, item, sessionMinutes)]));
  let count = [...sessions.values()].reduce((sum, one) => sum + one, 0);
  for (const [first, second] of mergesOf(plan, decisions, courseId)) {
    const pair = [sessions.get(first), sessions.get(second)];
    if (pair[0] !== undefined && pair[1] !== undefined) count -= pair[0] + pair[1] - 1;
  }
  return count;
}
