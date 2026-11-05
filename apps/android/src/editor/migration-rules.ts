// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// E-Migrate's rules (#615, answers 487 and 769): which release a draft's
// entries start from, the earlier items no entry accounts for, the new ones no
// entry names, and an entry added or taken away, kept only when the pack still
// reads and the step still fits. An item a release keeps needs no entry. A new
// item with no entry is allowed, as a plan can gain a lesson. The map sets the
// two releases side by side, the kept items hidden when only changes are asked
// for; right to left, the earlier release stands on the right, as the design
// draws it.

import {
  compareReleases,
  misfits,
  newIds,
  oldIds,
  parsePlanPack,
  type MigrationEntry,
  type PackItem,
  type PlanPack,
} from '@minhajna/core';
import type { MapLink, MapNode, MapSpec } from '../drawing/drawing-kit';

export interface MigrationView {
  readonly previous: PlanPack;
  readonly entries: readonly MigrationEntry[];
  /** Earlier items the draft lacks and no entry names: each needs one. */
  readonly open: readonly PackItem[];
  /** The draft's items the earlier release lacks and no entry names. */
  readonly added: readonly PackItem[];
  /** The IDs that keep the entries from fitting the earlier release. */
  readonly misfits: readonly string[];
}

/** The release a draft's entries start from: the one it names, or the latest before it; null for a first release. */
export function previousRelease(pack: PlanPack, history: readonly PlanPack[]): PlanPack | null {
  const earlier = history
    .filter((one) => one.id === pack.id && compareReleases(one.release, pack.release) < 0)
    .sort((a, b) => compareReleases(b.release, a.release));
  return earlier.find((one) => one.release === pack.migration?.from) ?? earlier[0] ?? null;
}

export function migrationView(pack: PlanPack, previous: PlanPack): MigrationView {
  const entries = pack.migration?.from === previous.release ? pack.migration.entries : [];
  const before = new Set(previous.items.map((item) => item.id));
  const after = new Set(pack.items.map((item) => item.id));
  const from = new Set(entries.flatMap(oldIds));
  const to = new Set(entries.flatMap(newIds));
  return {
    previous,
    entries,
    open: previous.items.filter((item) => !after.has(item.id) && !from.has(item.id)),
    added: pack.items.filter((item) => !before.has(item.id) && !to.has(item.id)),
    misfits: misfits({ entries, before: previous, after: pack }),
  };
}

/** The pack with these entries from that release, or null when it no longer reads or they no longer fit. */
function withEntries(pack: PlanPack, previous: PlanPack, entries: readonly MigrationEntry[]): PlanPack | null {
  const read = parsePlanPack({ ...pack, migration: { from: previous.release, entries } });
  if (!read.ok) return null;
  const view = migrationView(read.value, previous);
  return view.misfits.every((id) => view.open.some((item) => item.id === id)) ? read.value : null;
}

export function addEntry(pack: PlanPack, previous: PlanPack, entry: MigrationEntry): PlanPack | null {
  return withEntries(pack, previous, [...migrationView(pack, previous).entries, entry]);
}

/** The pack without that entry, whatever the others say, so a misfit can always be taken away. */
export function removeEntry(pack: PlanPack, previous: PlanPack, index: number): PlanPack | null {
  const entries = migrationView(pack, previous).entries.filter((_, at) => at !== index);
  const read = parsePlanPack({ ...pack, migration: { from: previous.release, entries } });
  return read.ok ? read.value : null;
}

export type EntryKind = MigrationEntry['kind'];

/** The entry that picking these IDs makes; null until the kind has what it needs. */
export function entryOf(kind: EntryKind, from: readonly string[], to: readonly string[]): MigrationEntry | null {
  const [one] = from;
  const [only] = to;
  if (one === undefined) return null;
  if (kind === 'remove') return from.length === 1 && to.length === 0 ? { kind, item: one } : null;
  if (kind === 'rename')
    return from.length === 1 && only !== undefined && to.length === 1 ? { kind, from: one, to: only } : null;
  if (kind === 'split') return from.length === 1 && to.length >= 2 ? { kind, from: one, to } : null;
  return from.length >= 2 && only !== undefined && to.length === 1 ? { kind, from, to: only } : null;
}

const WIDTH = 708;
const BOX = 170;
const ROW = 58;

/** The two releases side by side, each entry's lines between them. */
export function migrationMap(
  label: string,
  kinds: Readonly<Record<EntryKind, string>>,
  pack: PlanPack,
  view: MigrationView,
  rightToLeft: boolean,
  onlyChanges: boolean,
): MapSpec {
  const after = new Set(pack.items.map((item) => item.id));
  const changed = (item: PackItem, other: readonly PackItem[]) => {
    const same = other.find((one) => one.id === item.id);
    return same === undefined || same.title !== item.title || same.sourcePage !== item.sourcePage;
  };
  const left = view.previous.items.filter((item) => !onlyChanges || changed(item, pack.items));
  const right = pack.items.filter((item) => !onlyChanges || changed(item, view.previous.items));
  const [oldX, newX] = rightToLeft ? [WIDTH - BOX, 0] : [0, WIDTH - BOX];
  const node =
    (side: string, x: number) =>
    (item: PackItem, index: number): MapNode => ({
      id: `${side}:${item.id}`,
      label: `${item.id} · ${item.title}`,
      x,
      y: index * ROW,
    });
  const nodes = [...left.map(node('old', oldX)), ...right.map(node('new', newX))];
  const has = new Set(nodes.map((one) => one.id));
  const links: MapLink[] = [
    ...left.filter((item) => after.has(item.id)).map((item) => ({ from: `old:${item.id}`, to: `new:${item.id}` })),
    ...view.entries.flatMap((entry) =>
      oldIds(entry).flatMap((from) =>
        newIds(entry).map((to) => ({ from: `old:${from}`, to: `new:${to}`, label: kinds[entry.kind] })),
      ),
    ),
  ].filter((link) => has.has(link.from) && has.has(link.to));
  return { label, nodes, links };
}
