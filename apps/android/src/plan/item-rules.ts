// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One plan item and the changes the teacher can make to it for one class
// (#225, Plan-item, R-4.2-02, R-4.2-14): its row in the class's plan, its
// stages, the item after it, and whether an exam-window answer names it,
// which keeps it from being split. Each change takes the next place in the
// course's order, and skipping or joining an item the pack marks essential
// asks first (answer 284); an item the teacher added is not the pack's, so
// it never asks. A change that would do nothing is not offered: moving an
// item before the one already after it, or to the end when it is last, or
// joining items already merged or joined.

import {
  budgetInSessions,
  courseDecisions,
  recordedDecisions,
  courseSetup,
  decisionsFor,
  mergesOf,
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
  /** The item the plan puts after it in its queue. */
  readonly next: PackItem | undefined;
  /** Whether it can be joined with the next item: neither is merged or joined yet. */
  readonly joinable: boolean;
  /** The other items of its queue it can move before: not the one already after it. */
  readonly others: readonly PackItem[];
  /** Whether it is the last of its queue, so moving it to the end does nothing. */
  readonly last: boolean;
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
  const next = queue[at + 1];
  const merges = mergesOf(view.pack, courseDecisions(context, courseId), courseId);
  const taken = new Set([...merges.keys(), ...merges.values()]);
  return {
    pack: view.pack,
    row,
    stages: stageNames(view.pack, row.item),
    sessions: budgetInSessions(view.pack, row.item, courseSetup(context, courseId).sessionMinutes),
    next,
    joinable: next !== undefined && !taken.has(itemId) && !taken.has(next.id),
    others: queue.filter((item) => item.id !== itemId && item.id !== next?.id),
    last: next === undefined,
    answered: decisionsFor(courseDecisions(context, courseId), courseId).some((one) =>
      one.kind === 'leave-out' ? one.item === itemId : one.items.includes(itemId),
    ),
  };
}

/** Whether the teacher added the item, or a part of one, so the pack marks it neither essential nor optional. */
export function isAdded(item: PackItem): boolean {
  return item.id.startsWith('add~');
}

/** The item that makes skipping or joining these ask first, the first essential in the pack, or undefined. */
export function asksFirst(items: readonly PackItem[]): PackItem | undefined {
  return items.find((item) => !isAdded(item) && item.optional !== true);
}

/** The ID to show for an item: a part of a split shows the pack item's own ID and its part. */
export function shownId(item: PackItem): { readonly id: string; readonly part?: string } {
  const [base = item.id, ...rest] = item.id.split('~');
  return rest.length === 0 ? { id: base } : { id: base, part: rest.at(-1)! };
}

/** A change as a screen makes it, before its ID, day and place in the order. */
export type Draft = PlanChange extends infer C
  ? C extends unknown
    ? Omit<C, 'seq' | 'id' | 'courseId' | 'day'>
    : never
  : never;

/** The event that records a change, checked by the core, with its ID, day and place in the order. */
export function changeEvent(context: Context, courseId: string, draft: Draft, id: string, day: Day): RecordEvent {
  const seq = nextSeq(recordedDecisions(context.state, courseId), courseId);
  return recordChange(context, { ...draft, id, courseId, day, seq });
}
