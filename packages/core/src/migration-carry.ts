// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Carrying a class's changes and exam-window answers, and each layer's, to
// the release it is on (#322, answer 487, R-4.2-17), one release at a time,
// with nothing recorded rewritten. A renamed item keeps them all, and so do
// the parts of a split the class or a layer made of it. On a split item a
// skip, a leave-out or a postponement goes to every part, a move moves the
// parts together, and an item placed before it goes before the first part,
// so one placed after it comes after the last part. On merged items, a skip,
// a leave-out or a postponement of every one of them goes to the merged
// item, something placed before any of them goes before it, and a join of
// two of them is already done. Anything else on a split or merged item, or
// on the parts of the class's own split of one, is unclear: it is left out
// here, and the teacher answers it before the move (R-4.2-18). On a removed
// item a change is left out, or carried without it, and something placed
// before it goes before the next item still there; the screen says so. A
// change carried to several parts keeps its recorded ID for the first and
// takes «~<release>~2», «~<release>~3» for the others, so `recordedId` finds
// the change to take back, and an undo follows it to each.

import type { PlanPack } from './pack.ts';
import type { PlanDecision } from './plan-decisions.ts';
import {
  newIds,
  oldIds,
  PART_ID,
  releaseChain,
  type Migration,
  type MigrationEntry,
  type MigrationStep,
} from './pack-migration.ts';
import { packKey } from './reference.ts';
import type { State } from './state-type.ts';

type Decisions = ReadonlyMap<string, PlanDecision>;

type Where =
  | { readonly kind: 'same'; readonly ids: readonly string[] }
  | {
      readonly kind: 'rename' | 'split' | 'merge' | 'remove' | 'part';
      readonly ids: readonly string[];
      readonly entry: MigrationEntry;
    };

/** A change the teacher answers before the move: the change, the release and the entry that made it unclear. */
export interface Unclear {
  readonly decision: PlanDecision;
  readonly release: string;
  readonly entry: MigrationEntry;
}

export interface Carried<T extends PlanDecision> {
  readonly decisions: readonly T[];
  readonly unclear: readonly Unclear[];
  /** Changes on a removed item, left out, or carried without it. */
  readonly removed: readonly T[];
}

/** The recorded change a carried one comes from: its ID up to the first «~», which recorded IDs never hold. */
export function recordedId(id: string): string {
  return id.split('~')[0]!;
}

const entryOf = (step: MigrationStep, id: string): MigrationEntry | undefined =>
  step.entries.find((entry) => oldIds(entry).includes(id));

function where(step: MigrationStep, id: string): Where {
  const entry = entryOf(step, id);
  if (entry !== undefined) return { kind: entry.kind, ids: newIds(entry), entry };
  const part = PART_ID.exec(id);
  const base = part === null ? undefined : entryOf(step, part[1]!);
  if (part === null || base === undefined) return { kind: 'same', ids: [id] };
  if (base.kind === 'rename') return { kind: 'rename', ids: [`${base.to}~${part[2]}~${part[3]}`], entry: base };
  return { kind: base.kind === 'remove' ? 'remove' : 'part', ids: [], entry: base };
}

/** Where something placed before `id` goes: its first part, its merged item, or the next item still there. */
function place(step: MigrationStep, id: string | null): string | null {
  if (id === null) return null;
  const found = where(step, id);
  const part = PART_ID.exec(id);
  if (part !== null && (found.kind === 'part' || found.kind === 'remove')) return place(step, part[1]!);
  if (found.kind !== 'remove') return found.ids[0] ?? null;
  const items = step.before.items;
  const index = items.findIndex((item) => item.id === id);
  const queue = (kind: string) => (kind === 'td' ? 'td' : 'main');
  const own = items[index];
  for (const item of items.slice(index + 1)) {
    if (item.kind === 'unit' || own === undefined || queue(item.kind) !== queue(own.kind)) continue;
    const next = where(step, item.id);
    if (next.kind !== 'remove') return next.ids[0] ?? null;
  }
  return null;
}

type Outcome =
  | { readonly carried: readonly PlanDecision[]; readonly partly?: true }
  | { readonly unclear: MigrationEntry }
  | 'removed';

/** One change through one release: what it becomes, or why it is not carried. */
function carryOne(decision: PlanDecision, step: MigrationStep, live: readonly PlanDecision[]): Outcome {
  const nth = (index: number) => (index === 0 ? decision.id : `${decision.id}~${step.after.release}~${index + 1}`);
  const one = (change: PlanDecision): Outcome => ({ carried: [change] });
  switch (decision.kind) {
    case 'add':
      return one({ ...decision, before: place(step, decision.before) });
    case 'undo':
      return one(decision);
    case 'move':
    case 'budget':
    case 'split': {
      const found = where(step, decision.item);
      if (found.kind === 'remove') return 'removed';
      const at = (item: string, index = 0): PlanDecision =>
        decision.kind === 'move'
          ? { ...decision, id: nth(index), item, before: place(step, decision.before) }
          : { ...decision, item };
      if (found.kind === 'same' || found.kind === 'rename') return one(at(found.ids[0]!));
      if (found.kind !== 'split' || decision.kind !== 'move') return { unclear: found.entry };
      return { carried: found.ids.map(at) };
    }
    case 'skip':
    case 'leave-out': {
      const found = where(step, decision.item);
      if (found.kind === 'remove') return 'removed';
      if (found.kind === 'part') return { unclear: found.entry };
      if (found.kind !== 'merge')
        return { carried: found.ids.map((item, index) => ({ ...decision, id: nth(index), item })) };
      const by = (id: string) => live.find((other) => other.kind === decision.kind && other.item === id);
      const sources = oldIds(found.entry).map(by);
      if (sources.some((other) => other === undefined)) return { unclear: found.entry };
      return { carried: sources[0] === decision ? [{ ...decision, item: found.ids[0]! }] : [] };
    }
    case 'join':
    case 'merge': {
      const found = decision.items.map((id) => where(step, id));
      if (found.some((other) => other.kind === 'remove')) return 'removed';
      const [first, second] = found;
      if (first?.kind === 'merge' && second?.kind === 'merge' && first.entry === second.entry) return { carried: [] };
      const odd = found.find((other) => other.kind === 'merge' || other.kind === 'split' || other.kind === 'part');
      if (odd !== undefined && odd.kind !== 'same') return { unclear: odd.entry };
      return one({ ...decision, items: [first!.ids[0]!, second!.ids[0]!] as const });
    }
    case 'postpone': {
      const found = decision.items.map((id) => where(step, id));
      for (const other of found) {
        if (other.kind === 'part') return { unclear: other.entry };
        if (other.kind === 'merge' && !oldIds(other.entry).every((id) => decision.items.includes(id))) {
          return { unclear: other.entry };
        }
      }
      const items = [...new Set(found.flatMap((other) => other.ids))];
      if (items.length === 0) return 'removed';
      const partly = found.some((other) => other.kind === 'remove');
      return { carried: [{ ...decision, items }], ...(partly && { partly: true as const }) };
    }
  }
}

/**
 * A list of one class's changes, or of a layer's, carried through every
 * step of the migration. Undos are carried after the changes they take
 * back, whatever order the list has.
 */
export function carryDecisions<T extends PlanDecision>(list: readonly T[], migration: Migration): Carried<T> {
  let current: readonly PlanDecision[] = list;
  const unclear: Unclear[] = [];
  const removed: PlanDecision[] = [];
  for (const step of migration) {
    const undone = new Set(current.flatMap((one) => (one.kind === 'undo' ? [one.change] : [])));
    const live = current.filter((one) => one.kind !== 'undo' && !undone.has(one.id));
    const into = new Map<string, readonly string[]>();
    const next: PlanDecision[] = [];
    for (const decision of current) {
      if (decision.kind === 'undo') continue;
      const outcome = carryOne(decision, step, live);
      const counted = !undone.has(decision.id);
      if (outcome === 'removed' || 'partly' in outcome) {
        if (counted) removed.push(decision);
      } else if ('unclear' in outcome && counted) {
        unclear.push({ decision, release: step.after.release, entry: outcome.unclear });
      }
      const carried = outcome !== 'removed' && 'carried' in outcome ? outcome.carried : [];
      next.push(...carried);
      into.set(
        decision.id,
        carried.map((one) => one.id),
      );
    }
    for (const undo of current) {
      if (undo.kind !== 'undo') continue;
      const targets = into.get(undo.change) ?? [undo.change];
      targets.forEach((change, index) => {
        const id = index === 0 ? undo.id : `${undo.id}~${step.after.release}~${index + 1}`;
        next.push({ ...undo, id, change });
      });
    }
    current = next;
  }
  return { decisions: current as readonly T[], unclear, removed: removed as T[] };
}

const migrations = new WeakMap<PlanPack, { readonly releases: readonly PlanPack[]; readonly steps: Migration }>();

/**
 * The steps from the oldest release on the phone to the course's own, which
 * every reading follows; kept while the phone has the same releases.
 */
export function courseMigration(
  context: { readonly state: Pick<State, 'courses'>; readonly ref: { readonly packs: ReadonlyMap<string, PlanPack> } },
  courseId: string,
): Migration {
  const pin = context.state.courses.get(courseId)?.pack;
  const pack = pin == null ? undefined : context.ref.packs.get(packKey(pin.id, pin.release));
  if (pack === undefined) return [];
  const releases = [...context.ref.packs.values()].filter((one) => one.id === pack.id);
  const known = migrations.get(pack);
  if (known?.releases.length === releases.length && known.releases.every((one, index) => one === releases[index])) {
    return known.steps;
  }
  const chain = releaseChain(releases, pack);
  const steps = chain.ok ? chain.steps : [];
  migrations.set(pack, { releases, steps });
  return steps;
}

const views = new WeakMap<Decisions, WeakMap<Migration, Map<string, Decisions>>>();

/** All decisions, with the course's own carried to its release; the same map when nothing is carried. */
export function carriedView(decisions: Decisions, courseId: string, migration: Migration): Decisions {
  if (migration.length === 0) return decisions;
  const byMigration = views.get(decisions) ?? new WeakMap<Migration, Map<string, Decisions>>();
  views.set(decisions, byMigration);
  const byCourse = byMigration.get(migration) ?? new Map<string, Decisions>();
  byMigration.set(migration, byCourse);
  const known = byCourse.get(courseId);
  if (known !== undefined) return known;
  const own = [...decisions.values()].filter((one) => one.courseId === courseId);
  const view = new Map([...decisions].filter(([, one]) => one.courseId !== courseId));
  for (const one of carryDecisions(own, migration).decisions) view.set(one.id, one);
  byCourse.set(courseId, view);
  return view;
}
