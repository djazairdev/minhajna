// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One plan item and the changes the teacher can make to it for one class
// (#225, Plan-item, R-4.2-02, R-4.2-14): its row in the class's plan, its
// stages, the item after it, and whether an exam-window answer names it,
// which keeps it from being split. Each change takes the next place in the
// course's order, and skipping or joining an essential item asks first
// (answer 284).

import {
  budgetInSessions,
  courseSetup,
  decisionsFor,
  nextSeq,
  planView,
  queueItems,
  recordChange,
  stageNames,
  type Context,
  type Day,
  type PackItem,
  type PlanChange,
  type PlanPack,
  type PlanRow,
  type RecordEvent,
} from '@minhajna/core';

export type ItemPage = {
  readonly pack: PlanPack;
  readonly row: PlanRow;
  readonly stages: readonly string[];
  readonly sessions: number;
  /** The item the plan puts after it in its queue, to join it with. */
  readonly next: PackItem | undefined;
  /** The other items of its queue, to move it before. */
  readonly others: readonly PackItem[];
  /** An exam-window answer names it, so it is not split. */
  readonly answered: boolean;
};

/** The item as the class's plan has it, or null when the plan no longer has it. */
export function itemPage(context: Context, courseId: string, itemId: string, day: Day): ItemPage | null {
  const view = planView(context, courseId, day);
  if (view === null) return null;
  const row = [...view.main, ...view.td].find((one) => one.item.id === itemId);
  if (row === undefined) return null;
  const queue = queueItems(view.pack, row.item.kind === 'td' ? 'td' : 'main');
  const at = queue.findIndex((item) => item.id === itemId);
  return {
    pack: view.pack,
    row,
    stages: stageNames(view.pack, row.item),
    sessions: budgetInSessions(view.pack, row.item, courseSetup(context, courseId).sessionMinutes),
    next: queue[at + 1],
    others: queue.filter((item) => item.id !== itemId),
    answered: decisionsFor(context.state.decisions, courseId).some((one) =>
      one.kind === 'leave-out' ? one.item === itemId : one.items.includes(itemId),
    ),
  };
}

/** Whether a change to the item asks first: skipping or joining an item the pack does not mark optional. */
export function asksFirst(item: PackItem, kind: PlanChange['kind']): boolean {
  return item.optional !== true && (kind === 'skip' || kind === 'join');
}

/** A change as a screen makes it, before its ID, day and place in the order. */
export type Draft = PlanChange extends infer C
  ? C extends unknown
    ? Omit<C, 'seq' | 'id' | 'courseId' | 'day'>
    : never
  : never;

/** The event that records a change, checked by the core, with its ID, day and place in the order. */
export function changeEvent(context: Context, courseId: string, draft: Draft, id: string, day: Day): RecordEvent {
  const seq = nextSeq(context.state.decisions, courseId);
  return recordChange(context, { ...draft, id, courseId, day, seq });
}
