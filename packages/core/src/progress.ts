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
//
// An item the teacher decided to leave out counts as skipped, and two items
// the teacher decided to merge are proposed together, in the first one's
// session, each to its last stage (#221).
//
// In a week pack, the class's plan week is the week of its first item not
// finished, and a session takes its items from that week only, so the week
// is finished before the next begins (#230, answer 375).

import { budgetInSessions, queueItems, stageCount, stageNames, type PackItem, type PlanPack } from './pack.ts';
import type { Queue } from './reference.ts';
import { wholeGroup, type Coverage, type SchoolClass, type SessionRecord } from './records.ts';

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
    if (groupId !== this.#whole) return whole + (item.groups.get(groupId)?.spent ?? 0);
    const common =
      this.#halves.length === 0 ? 0 : Math.min(...this.#halves.map((id) => item.groups.get(id)?.spent ?? 0));
    return whole + common;
  }

  /** Counts an item the teacher decided to leave out as skipped. */
  leaveOut(itemId: string): void {
    this.#item(itemId).skipped = true;
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
  /** The item merged into this session by the teacher's decision, taught to its last stage. */
  readonly with?: { readonly item: PackItem; readonly from: number; readonly to: number };
  /** In a week pack, the plan week, and for an activity of the weekly model which of its sessions this is. */
  readonly planWeek?: PlanWeekPlace;
}

/** «الأسبوع 3», and «قراءة، الحصة 1 من 3»: the week's sessions of the activity, counted in budgeted sessions. */
export interface PlanWeekPlace {
  readonly week: number;
  readonly activity?: { readonly code: string; readonly session: number; readonly of: number };
}

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

/** What a session covers when it goes as proposed: the item's stages, and the merged item's. */
export function proposedCoverage(proposal: Proposal): Coverage[] {
  return [
    { op: 'taught', item: proposal.item.id, from: proposal.from, to: proposal.to },
    ...(proposal.with === undefined
      ? []
      : [{ op: 'taught' as const, item: proposal.with.item.id, from: proposal.with.from, to: proposal.with.to }]),
  ];
}
