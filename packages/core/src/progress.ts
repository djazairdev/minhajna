// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The engine proposes each session's lesson: the class's next unfinished
// item, from the first stage not yet covered (PRD §4.7). Only the teacher's
// confirmation records it (PRD §2.3, rule 1), and changing the proposal costs
// no more than confirming it (rule 2).
//
// Progress is counted in stages, not percentages. "Last stage reached" keeps
// an item at the head of the queue, and its remaining stages move to the next
// ordinary session of the same class and subject. Each stage covered is kept
// on its own, so a stage never counts as covered because a later one was.

import { budgetInSessions, queueItems, stageCount, stageNames, type PackItem, type PlanPack } from './pack.ts';
import type { Queue } from './reference.ts';
import { wholeGroup, type SchoolClass, type SessionRecord } from './records.ts';

interface GroupProgress {
  /** The stages covered, numbered from 0. */
  readonly stages: Set<number>;
  spent: number;
}

interface ItemState {
  skipped: boolean;
  retaught: number;
  readonly groups: Map<string, GroupProgress>;
}

/**
 * How far a course has got in its plan. Coverage is kept per group, because
 * an item taught in half-groups is done for the class only when every
 * half-group has had it (PRD §4.7).
 */
export class Progress {
  readonly #whole: string;
  readonly #halves: readonly string[];
  readonly #items = new Map<string, ItemState>();

  constructor(whole: string, halves: readonly string[]) {
    this.#whole = whole;
    this.#halves = halves;
  }

  static of(schoolClass: SchoolClass): Progress {
    return new Progress(
      wholeGroup(schoolClass).id,
      schoolClass.groups.filter((group) => group.kind === 'half').map((group) => group.id),
    );
  }

  clone(): Progress {
    const copy = new Progress(this.#whole, this.#halves);
    for (const [id, state] of this.#items) {
      copy.#items.set(id, {
        skipped: state.skipped,
        retaught: state.retaught,
        groups: new Map(
          [...state.groups].map(([group, progress]) => [
            group,
            { stages: new Set(progress.stages), spent: progress.spent },
          ]),
        ),
      });
    }
    return copy;
  }

  /**
   * Counts one session record. A session spent on two merged items counts
   * half a session for each. Teaching an item again never moves it through
   * the plan, so it is counted on its own, for plan feedback (PRD §4.9).
   */
  apply(record: SessionRecord): void {
    const groupId = record.session.groupId;
    const sharing = record.coverage.filter((coverage) => coverage.op !== 'skipped').length;
    const share = sharing > 0 ? 1 / sharing : 0;
    for (const coverage of record.coverage) {
      const item = this.#item(coverage.item);
      switch (coverage.op) {
        case 'taught': {
          const group = this.#group(item, groupId);
          for (let stage = coverage.from; stage < coverage.to; stage += 1) group.stages.add(stage);
          group.spent += share;
          break;
        }
        case 'skipped':
          item.skipped = true;
          break;
        case 'retaught':
          item.retaught += 1;
          break;
      }
    }
  }

  /**
   * The stages a group has covered, in order: its own and the whole
   * class's, or, for the class, those that every half-group has had.
   */
  coveredStages(itemId: string, groupId: string): number[] {
    const item = this.#items.get(itemId);
    if (item === undefined) return [];
    const stages = new Set(item.groups.get(this.#whole)?.stages);
    if (groupId !== this.#whole) {
      for (const stage of item.groups.get(groupId)?.stages ?? []) stages.add(stage);
    } else if (this.#halves.length > 0) {
      const halves = this.#halves.map((id) => item.groups.get(id)?.stages ?? new Set<number>());
      for (const stage of halves[0] ?? []) if (halves.every((half) => half.has(stage))) stages.add(stage);
    }
    return [...stages].sort((a, b) => a - b);
  }

  /** How many stages a group has covered. */
  covered(itemId: string, groupId: string): number {
    return this.coveredStages(itemId, groupId).length;
  }

  /** The first stage a group has not covered, where its next session starts. */
  firstOpen(itemId: string, groupId: string): number {
    const stages = new Set(this.coveredStages(itemId, groupId));
    let stage = 0;
    while (stages.has(stage)) stage += 1;
    return stage;
  }

  /** Sessions spent teaching an item by a group, counting the whole class's sessions. */
  spent(itemId: string, groupId: string): number {
    const item = this.#items.get(itemId);
    if (item === undefined) return 0;
    const whole = item.groups.get(this.#whole)?.spent ?? 0;
    return groupId === this.#whole ? whole : whole + (item.groups.get(groupId)?.spent ?? 0);
  }

  skipped(itemId: string): boolean {
    return this.#items.get(itemId)?.skipped ?? false;
  }

  retaught(itemId: string): number {
    return this.#items.get(itemId)?.retaught ?? 0;
  }

  /** Skipped, or with every stage covered. */
  isFinished(pack: PlanPack, item: PackItem, groupId: string): boolean {
    return this.skipped(item.id) || this.firstOpen(item.id, groupId) >= stageCount(pack, item);
  }

  #item(id: string): ItemState {
    let item = this.#items.get(id);
    if (item === undefined) {
      item = { skipped: false, retaught: 0, groups: new Map() };
      this.#items.set(id, item);
    }
    return item;
  }

  #group(item: ItemState, groupId: string): GroupProgress {
    let group = item.groups.get(groupId);
    if (group === undefined) {
      group = { stages: new Set(), spent: 0 };
      item.groups.set(groupId, group);
    }
    return group;
  }
}

export interface Proposal {
  readonly queue: Exclude<Queue, 'none'>;
  readonly item: PackItem;
  /** The first stage not yet covered. The session starts at this stage. */
  readonly from: number;
  /**
   * Done as planned, the session covers stages `from` to `to`, not
   * included. Equal to `from` when the item goes on.
   */
  readonly to: number;
  readonly stages: number;
  readonly stageNames: readonly string[];
  /** Which of the item's budgeted sessions this one is, from 1. */
  readonly session: number;
  readonly budget: number;
  /** Carried over from an earlier session: the texts book reads "continued" (PRD §4.7). */
  readonly continued: boolean;
}

export interface ProposalInput {
  readonly queue: Queue;
  readonly groupId: string;
  readonly activity?: string;
  readonly sessionMinutes: number;
}

/**
 * The next unfinished item and its stages. When a slot names an activity,
 * as primary activity slots do, it takes the next item of that activity, and
 * a slot without one takes the next item that has none (PRD §4.7).
 *
 * The stages are spread evenly over the item's budget. Once the budget is
 * used up, the proposal is to finish the item.
 */
export function propose(pack: PlanPack, progress: Progress, input: ProposalInput): Proposal | null {
  if (input.queue === 'none') return null;
  const items = queueItems(pack, input.queue);
  const open = items.filter((item) => !progress.isFinished(pack, item, input.groupId));
  const usesActivity = input.activity !== undefined && items.some((item) => item.activity === input.activity);
  const item = usesActivity
    ? open.find((candidate) => candidate.activity === input.activity)
    : (open.find((candidate) => candidate.activity === undefined) ?? open[0]);
  if (item === undefined) return null;

  const stages = stageCount(pack, item);
  const budget = budgetInSessions(pack, item, input.sessionMinutes);
  const from = progress.firstOpen(item.id, input.groupId);
  const spent = Math.floor(progress.spent(item.id, input.groupId));
  const session = spent + 1;
  const to = session >= budget ? stages : Math.max(from, Math.min(stages, Math.floor((session * stages) / budget)));
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
  };
}
