// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The engine proposes each session's lesson: the class's next unfinished
// item, from the first stage not yet covered (PRD §4.7). Only the teacher's
// confirmation records it (PRD §2.3, rule 1), and changing the proposal costs
// no more than confirming it (rule 2). Two items the teacher decided to merge
// are proposed together, in the first one's session, each to its last stage
// (#221).
//
// In a week pack, the class's plan week is the week of its first item not
// finished, and a session takes its items from that week only, so the week
// is finished before the next begins (#230, answer 375).

import { budgetInSessions, queueItems, stageCount, stageNames, type PackItem, type PlanPack } from './pack.ts';
import type { PlanWeekPlace, Progress, Proposal } from './progress.ts';
import type { Queue } from './reference.ts';

export interface ProposalInput {
  readonly queue: Queue;
  readonly groupId: string;
  readonly activity?: string;
  readonly sessionMinutes: number;
  /** The items the teacher decided to merge: the first item's ID, then the second's. */
  readonly merges?: ReadonlyMap<string, string>;
}

/**
 * The next unfinished item and its stages. When a slot names an activity,
 * as primary activity slots do, it takes the next item of that activity, and
 * a slot without one takes the next item that has none (PRD §4.7). In a week
 * pack, both look only in the class's plan week, and take the week's first
 * item when it has none of theirs left.
 *
 * The stages are spread evenly over the item's budget. Once the budget is
 * used up, the proposal is to finish the item.
 */
export function propose(pack: PlanPack, progress: Progress, input: ProposalInput): Proposal | null {
  if (input.queue === 'none') return null;
  const items = queueItems(pack, input.queue);
  const open = items.filter((item) => !progress.isFinished(pack, item, input.groupId));
  const week = pack.anchor.kind === 'weeks' ? open[0]?.week : undefined;
  const scope = week === undefined ? open : open.filter((item) => item.week === week);
  const usesActivity = input.activity !== undefined && items.some((item) => item.activity === input.activity);
  const item = usesActivity
    ? (scope.find((candidate) => candidate.activity === input.activity) ?? (week === undefined ? undefined : scope[0]))
    : (scope.find((candidate) => candidate.activity === undefined) ?? scope[0]);
  if (item === undefined) return null;

  const stages = stageCount(pack, item);
  const budget = budgetInSessions(pack, item, input.sessionMinutes);
  const from = progress.firstOpen(item.id, input.groupId);
  const spent = Math.floor(progress.spent(item.id, input.groupId));
  const session = spent + 1;
  const merged = pack.items.find((other) => other.id === input.merges?.get(item.id));
  const joins = merged !== undefined && !progress.isFinished(pack, merged, input.groupId);
  const planned =
    session >= budget ? stages : Math.max(from, Math.min(stages, Math.floor((session * stages) / budget)));
  const to = joins ? stages : planned;
  return {
    queue: input.queue,
    item,
    from,
    to,
    stages,
    stageNames: stageNames(pack, item),
    session,
    budget,
    continued: progress.covered(item.id, input.groupId) > 0 || spent > 0,
    ...(week !== undefined && item.week === week && { planWeek: placeInWeek(pack, items, item, session, input) }),
    ...(joins && {
      with: { item: merged, from: progress.firstOpen(merged.id, input.groupId), to: stageCount(pack, merged) },
    }),
  };
}

/** The item's plan week, and for an activity of the weekly model, which of the week's sessions of it this one is. */
function placeInWeek(
  pack: PlanPack,
  items: readonly PackItem[],
  item: PackItem,
  session: number,
  input: ProposalInput,
): PlanWeekPlace {
  const week = item.week ?? 0;
  if (item.activity === undefined || !(pack.activities ?? []).some((one) => one.code === item.activity))
    return { week };
  const same = items.filter((one) => one.week === week && one.activity === item.activity);
  const sessions = (list: readonly PackItem[]) =>
    list.reduce((sum, one) => sum + budgetInSessions(pack, one, input.sessionMinutes), 0);
  const before = sessions(same.slice(0, same.indexOf(item)));
  const own = Math.min(session, budgetInSessions(pack, item, input.sessionMinutes));
  return { week, activity: { code: item.activity, session: before + own, of: sessions(same) } };
}
