// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The answers to an exam-window warning (#221, R-4.7-32, answers 268 and
// 269). «دمج موارد أو ترك الاختيارية» lists every optional item the teacher
// may leave out and every merge the pack allows, among the items not yet
// taught that the window's term needs. A few come ticked, chosen one at a
// time, each the one that brings back the most items before the window, so
// a long list still takes only a few projections. «تأجيله بعد الاختبارات»
// postpones the items past the window. Each answer can be previewed first,
// as can a test before it is added: the same projection, with the change.

import { courseDecisions } from './lineage.ts';
import { courseSetup } from './choices.ts';
import { makeContext, type Context } from './context.ts';
import type { Day } from './day.ts';
import { walkCourse } from './engine.ts';
import { pastWindow, type PastWindow } from './exam-window.ts';
import { queueItems, type PackItem } from './pack.ts';
import { decisionsFor, mayMerge, type PlanDecision } from './plan-decisions.ts';
import { wholeGroup } from './records.ts';
import type { ScheduledTest } from './test-schedule.ts';

/** One change the answer sheet may offer. */
export type PlanChoice =
  | { readonly kind: 'leave-out'; readonly item: PackItem }
  | { readonly kind: 'merge'; readonly items: readonly [PackItem, PackItem] };

/** The most choices the suggestion ticks together. */
const MOST_TICKED = 3;

/** The context with tests and decisions added or replaced, for a preview. */
export function withPlanChanges(
  context: Context,
  changes: { readonly tests?: readonly ScheduledTest[]; readonly decisions?: readonly PlanDecision[] },
): Context {
  const tests = new Map(context.state.tests);
  for (const test of changes.tests ?? []) tests.set(test.id, test);
  const decisions = new Map(context.state.decisions);
  for (const decision of changes.decisions ?? []) decisions.set(decision.id, decision);
  return makeContext(context.ref, { ...context.state, tests, decisions });
}

/** The decision a choice records. */
export function decisionOf(choice: PlanChoice, id: string, courseId: string): PlanDecision {
  return choice.kind === 'leave-out'
    ? { id, courseId, kind: 'leave-out', item: choice.item.id }
    : { id, courseId, kind: 'merge', items: [choice.items[0].id, choice.items[1].id] };
}

/** The decision that postpones the items past the window. */
export function postponeOf(warning: PastWindow, id: string): PlanDecision {
  return {
    id,
    courseId: warning.courseId,
    kind: 'postpone',
    items: warning.items.map(({ item }) => item.id),
    term: warning.term,
  };
}

/** The leave-outs and merges a course's pack allows now, for a term's items, in plan order. */
export function planChoices(context: Context, warning: Pick<PastWindow, 'courseId' | 'term'>): PlanChoice[] {
  const setup = courseSetup(context, warning.courseId);
  const pack = setup.pack;
  if (pack === null) return [];
  const { progress } = walkCourse(context, warning.courseId, context.ref.year.to);
  const whole = wholeGroup(setup.schoolClass).id;
  const open = (item: PackItem | undefined): item is PackItem =>
    item !== undefined && item.buffer !== true && !progress.isFinished(pack, item, whole);
  const due = (item: PackItem): boolean => item.term !== undefined && item.term <= warning.term;
  const leftOut = new Set(
    decisionsFor(courseDecisions(context.state, warning.courseId), warning.courseId).flatMap((decision) =>
      decision.kind === 'leave-out' ? [decision.item] : [],
    ),
  );
  const main = queueItems(pack, 'main');
  const choices: PlanChoice[] = [];
  for (const [index, item] of main.entries()) {
    if (!open(item) || !due(item) || leftOut.has(item.id)) continue;
    if (item.optional === true) choices.push({ kind: 'leave-out', item });
    const next = main[index + 1];
    if (
      open(next) &&
      !leftOut.has(next.id) &&
      mayMerge(pack, courseDecisions(context.state, warning.courseId), warning.courseId, [item.id, next.id])
    ) {
      choices.push({ kind: 'merge', items: [item, next] });
    }
  }
  return choices;
}

function itemsOf(choice: PlanChoice): string[] {
  return choice.kind === 'leave-out' ? [choice.item.id] : choice.items.map((item) => item.id);
}

/**
 * The choices to tick first, by their place in `choices`: one at a time, each
 * the one that leaves the fewest items past the window, the earliest on a
 * tie, until none is left, none helps, or three are ticked.
 */
export function suggestedChoices(
  context: Context,
  warning: PastWindow,
  choices: readonly PlanChoice[],
  today: Day,
): number[] {
  const picked: number[] = [];
  let left = warning.items.length;
  while (left > 0 && picked.length < MOST_TICKED) {
    const used = new Set(picked.flatMap((i) => itemsOf(choices[i] as PlanChoice)));
    let best: { readonly index: number; readonly left: number } | null = null;
    for (const [index, choice] of choices.entries()) {
      if (picked.includes(index) || itemsOf(choice).some((item) => used.has(item))) continue;
      const decisions = [...picked, index].map((i) =>
        decisionOf(choices[i] as PlanChoice, `preview-${i}`, warning.courseId),
      );
      const after = pastWindow(withPlanChanges(context, { decisions }), warning.courseId, today)?.items.length ?? 0;
      if (best === null || after < best.left) best = { index, left: after };
    }
    if (best === null || best.left >= left) break;
    picked.push(best.index);
    left = best.left;
  }
  return picked;
}
