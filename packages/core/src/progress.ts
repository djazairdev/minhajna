// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a class has covered of its plan, and what a proposal is; propose.ts
// makes the proposals (PRD §4.7).
//
// Progress is counted in stages, not percentages. "Last stage reached" keeps
// an item at the head of the queue, and its remaining stages move to the next
// ordinary session of the same class and subject. Each stage covered is kept
// on its own, so a stage never counts as covered because a later one was.
//
// An item the teacher decided to leave out counts as skipped (#221). A class
// that continues an old class's history takes its progress as a whole
// (#231).

import { stageCount, type PackItem, type PlanPack } from './pack.ts';
import type { Migration } from './pack-migration.ts';
import { migratedItems, type GroupProgress, type ItemState } from './progress-migration.ts';
import type { Queue } from './reference.ts';
import { wholeGroup, type Coverage, type SchoolClass, type SessionRecord } from './records.ts';

/**
 * How far a course has got in its plan. Coverage is kept per group, because
 * an item taught in half-groups is done for the class only when every
 * half-group has had it (PRD §4.7).
 */
export class Progress {
  readonly #whole: string;
  readonly #halves: readonly string[];
  readonly #items = new Map<string, ItemState>();
  readonly #migration: Migration;
  #view: Map<string, ItemState> | null = null;

  constructor(whole: string, halves: readonly string[], migration: Migration = []) {
    this.#whole = whole;
    this.#halves = halves;
    this.#migration = migration;
  }

  /** A class's progress; with a migration, read on the release it is on (#322, progress-migration.ts). */
  static of(schoolClass: SchoolClass, migration: Migration = []): Progress {
    return new Progress(
      wholeGroup(schoolClass).id,
      schoolClass.groups.filter((group) => group.kind === 'half').map((group) => group.id),
      migration,
    );
  }

  clone(): Progress {
    const copy = new Progress(this.#whole, this.#halves, this.#migration);
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
    return this.#stagesOf(this.#state(itemId), groupId);
  }

  #stagesOf(item: ItemState | undefined, groupId: string): number[] {
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
    return this.#spentOf(this.#state(itemId), groupId);
  }

  #spentOf(item: ItemState | undefined, groupId: string): number {
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
    return this.#state(itemId)?.skipped ?? false;
  }

  retaught(itemId: string): number {
    return this.#state(itemId)?.retaught ?? 0;
  }

  /** Skipped, or with every stage covered. */
  isFinished(pack: PlanPack, item: PackItem, groupId: string): boolean {
    return this.skipped(item.id) || this.firstOpen(item.id, groupId) >= stageCount(pack, item);
  }

  /**
   * Takes the progress of a class whose history this class continues as its
   * own whole-class progress: what that class had as a whole, its halves
   * together included (#231), under the IDs its sessions recorded, which
   * this class then reads on its own release (#322).
   */
  inherit(other: Progress): void {
    for (const [id, theirs] of other.#items) {
      const item = this.#item(id);
      const group = this.#group(item, this.#whole);
      for (const stage of other.#stagesOf(theirs, other.#whole)) group.stages.add(stage);
      group.spent += other.#spentOf(theirs, other.#whole);
      item.skipped ||= theirs.skipped;
      item.retaught += theirs.retaught;
    }
  }

  /** An item's progress as read on the class's release, the IDs it was recorded under carried to it. */
  #state(id: string): ItemState | undefined {
    if (this.#migration.length === 0) return this.#items.get(id);
    this.#view ??= migratedItems(
      this.#items,
      this.#migration,
      (state, group) => this.#stagesOf(state, group).length,
      this.#whole,
    );
    return this.#view.get(id);
  }

  #item(id: string): ItemState {
    this.#view = null;
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

/** What a session covers when it goes as proposed: the item's stages, and the merged item's. */
export function proposedCoverage(proposal: Proposal): Coverage[] {
  return [
    { op: 'taught', item: proposal.item.id, from: proposal.from, to: proposal.to },
    ...(proposal.with === undefined
      ? []
      : [{ op: 'taught' as const, item: proposal.with.item.id, from: proposal.with.from, to: proposal.with.to }]),
  ];
}
