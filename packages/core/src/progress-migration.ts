// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's progress read on the release it is on (#322, answer 487, R-4.2-13):
// the progress kept under the IDs the sessions recorded, carried one release at
// a time through the migration entries, so the sessions themselves never
// change. A renamed item keeps all of it. Every part of a split item is
// finished when the old item was, and skipped when it was; an old item started
// but not finished leaves the class at the first part's start, which takes its
// sessions spent. A merged item is finished when every old item was, skipped
// when every one was, and started otherwise, with their sessions spent
// together. A removed item's progress is left out. The parts of the class's own
// split follow their item's rename; when the item is split or merged, the split
// is asked again (migration-carry.ts) and the parts' progress goes back on the
// item first, each part's stages in their place in it, as the split cut them
// (plan-layer.ts), and a part left out counting as covered; an item of one
// stage or none is finished once both parts are. Each group, the whole class
// and each half-group, is judged on its own.

import { stageCount, stageNames, type PlanPack } from './pack.ts';
import { oldIds, PART_ID, type Migration, type MigrationEntry, type MigrationStep } from './pack-migration.ts';

export interface GroupProgress {
  /** The stages covered, numbered from 0. */
  readonly stages: Set<number>;
  spent: number;
}

export interface ItemState {
  skipped: boolean;
  retaught: number;
  readonly groups: Map<string, GroupProgress>;
}

/** How many stages a group has covered of an item, as the class counts it (Progress). */
export type Covered = (state: ItemState, groupId: string) => number;

function joined(into: ItemState | undefined, from: ItemState): ItemState {
  const groups = new Map<string, GroupProgress>();
  for (const [id, group] of [...(into?.groups ?? []), ...from.groups]) {
    const known = groups.get(id);
    groups.set(id, {
      stages: new Set([...(known?.stages ?? []), ...group.stages]),
      spent: (known?.spent ?? 0) + group.spent,
    });
  }
  return {
    skipped: (into?.skipped ?? false) || from.skipped,
    retaught: (into?.retaught ?? 0) + from.retaught,
    groups,
  };
}

const all = (count: number, from = 0): Set<number> =>
  new Set(Array.from({ length: Math.max(0, count - from) }, (_, index) => from + index));

function stagesIn(pack: PlanPack, id: string): number {
  const item = pack.items.find((one) => one.id === id);
  return item === undefined ? 1 : stageCount(pack, item);
}

/** The items with the progress of the class's own parts of an item split or merged in the step put back on it. */
function folded(
  items: ReadonlyMap<string, ItemState>,
  step: MigrationStep,
  covered: Covered,
  whole: string,
): Map<string, ItemState> {
  const next = new Map<string, ItemState>();
  const pairs = new Map<string, (ItemState | undefined)[]>();
  for (const [id, state] of items) {
    const part = PART_ID.exec(id);
    const base = part === null ? undefined : step.entries.find((one) => oldIds(one).includes(part[1]!));
    if (part === null || base === undefined || base.kind === 'rename' || base.kind === 'remove') {
      next.set(id, joined(next.get(id), state));
      continue;
    }
    const item = step.before.items.find((one) => one.id === part[1]);
    const count = item === undefined ? 0 : stageNames(step.before, item).length;
    if (count <= 1) {
      const pair = pairs.get(part[1]!) ?? [undefined, undefined];
      const index = part[3] === '1' ? 0 : 1;
      pair[index] = joined(pair[index], state);
      pairs.set(part[1]!, pair);
      continue;
    }
    const cut = Math.ceil(count / 2);
    const [from, to] = part[3] === '1' ? [0, cut] : [cut, count];
    const groups = new Map<string, GroupProgress>();
    for (const [group, progress] of state.groups) {
      const stages = [...progress.stages].map((stage) => stage + from).filter((stage) => stage < to);
      groups.set(group, { stages: new Set(stages), spent: progress.spent });
    }
    if (state.skipped) {
      const known = groups.get(whole);
      groups.set(whole, { stages: new Set([...(known?.stages ?? []), ...all(to, from)]), spent: known?.spent ?? 0 });
    }
    next.set(part[1]!, joined(next.get(part[1]!), { skipped: false, retaught: state.retaught, groups }));
  }
  for (const [id, pair] of pairs) {
    const groups = new Map<string, GroupProgress>();
    for (const group of new Set([whole, ...pair.flatMap((state) => [...(state?.groups.keys() ?? [])])])) {
      const finished = pair.every((state) => state !== undefined && (state.skipped || covered(state, group) >= 1));
      const spent = pair.reduce((sum, state) => sum + (state?.groups.get(group)?.spent ?? 0), 0);
      groups.set(group, { stages: finished ? new Set([0]) : new Set(), spent });
    }
    const retaught = pair.reduce((sum, state) => sum + (state?.retaught ?? 0), 0);
    next.set(id, joined(next.get(id), { skipped: false, retaught, groups }));
  }
  return next;
}

/** The progress of each item, under the IDs of the migration's last release. */
export function migratedItems(
  items: ReadonlyMap<string, ItemState>,
  migration: Migration,
  covered: Covered,
  whole: string,
): Map<string, ItemState> {
  let current = new Map(items);
  for (const step of migration) {
    current = folded(current, step, covered, whole);
    const next = new Map<string, ItemState>();
    const add = (id: string, state: ItemState) => next.set(id, joined(next.get(id), state));
    const done = (state: ItemState | undefined, group: string, id: string) =>
      state !== undefined && (state.skipped || covered(state, group) >= stagesIn(step.before, id));
    const groupsOf = (states: readonly (ItemState | undefined)[]) =>
      new Set([whole, ...states.flatMap((state) => [...(state?.groups.keys() ?? [])])]);
    const merged = (entry: Extract<MigrationEntry, { kind: 'merge' }>) => {
      const sources = entry.from.map((id) => current.get(id));
      const groups = new Map<string, GroupProgress>();
      for (const group of groupsOf(sources)) {
        const finished = entry.from.every((id, index) => done(sources[index], group, id));
        const spent = sources.reduce((sum, state) => sum + (state?.groups.get(group)?.spent ?? 0), 0);
        groups.set(group, { stages: finished ? all(stagesIn(step.after, entry.to)) : new Set(), spent });
      }
      const skipped = sources.every((state) => state?.skipped === true);
      return { skipped, retaught: sources.reduce((sum, state) => sum + (state?.retaught ?? 0), 0), groups };
    };
    const entryOf = (id: string) => step.entries.find((one) => oldIds(one).includes(id));
    for (const [id, state] of current) {
      const entry = entryOf(id);
      const part = entry === undefined ? PART_ID.exec(id) : null;
      const base = part === null ? undefined : entryOf(part[1]!);
      if (part !== null && base !== undefined) {
        if (base.kind === 'rename') add(`${base.to}~${part[2]}~${part[3]}`, state);
      } else if (entry === undefined) add(id, state);
      else if (entry.kind === 'rename') add(entry.to, state);
      else if (entry.kind === 'split') {
        entry.to.forEach((part, index) => {
          const groups = new Map<string, GroupProgress>();
          for (const group of groupsOf([state])) {
            const stages = done(state, group, id) ? all(stagesIn(step.after, part)) : new Set<number>();
            groups.set(group, { stages, spent: index === 0 ? (state.groups.get(group)?.spent ?? 0) : 0 });
          }
          add(part, { skipped: state.skipped, retaught: index === 0 ? state.retaught : 0, groups });
        });
      }
    }
    for (const entry of step.entries) {
      if (entry.kind === 'merge' && entry.from.some((id) => current.has(id))) add(entry.to, merged(entry));
    }
    current = next;
  }
  return current;
}
