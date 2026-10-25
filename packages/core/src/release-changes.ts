// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What changed from a class's release to a newer one (#322, answer 487 (8),
// Pack-release «ما تغيّر»), followed through every release between: a
// textbook page, a title, an item split into several or several merged into
// one, an item added and one removed, each kind apart and in the plan's
// order. A renamed item is the same item under its new name, shown as a
// title change, or not at all when its title stays. A page or title change
// that keeps its ID shows the same way. An item several old ones reach is a
// merge, even when one of them was also split.

import type { PackItem, PlanPack } from './pack.ts';
import { followId, type Migration } from './pack-migration.ts';

export type ReleaseChange =
  | { readonly kind: 'page'; readonly item: PackItem; readonly from?: string; readonly to?: string }
  | { readonly kind: 'title'; readonly from: PackItem; readonly to: PackItem }
  | { readonly kind: 'split'; readonly from: PackItem; readonly to: readonly PackItem[] }
  | { readonly kind: 'merge'; readonly from: readonly PackItem[]; readonly to: PackItem }
  | { readonly kind: 'added'; readonly item: PackItem }
  | { readonly kind: 'removed'; readonly item: PackItem };

const ORDER: readonly ReleaseChange['kind'][] = ['page', 'title', 'split', 'merge', 'added', 'removed'];

/** The changes from release `from` to release `to`, through the migration's steps between them. */
export function releaseChanges(from: PlanPack, to: PlanPack, steps: Migration): ReleaseChange[] {
  const byId = new Map(to.items.map((item) => [item.id, item]));
  const reached = new Set<string>();
  const sources = new Map<string, PackItem[]>();
  const changes: ReleaseChange[] = [];
  const carried = from.items.map((old) => {
    const now = followId(steps, old.id).flatMap((id) => byId.get(id) ?? []);
    for (const item of now) {
      reached.add(item.id);
      sources.set(item.id, [...(sources.get(item.id) ?? []), old]);
    }
    return { old, now };
  });
  for (const { old, now } of carried) {
    const [one] = now;
    if (one === undefined) changes.push({ kind: 'removed', item: old });
    else if (now.length > 1) changes.push({ kind: 'split', from: old, to: now });
    else if (sources.get(one.id)!.length === 1) {
      if (old.title !== one.title) changes.push({ kind: 'title', from: old, to: one });
      if (old.pages !== one.pages) {
        changes.push({
          kind: 'page',
          item: one,
          ...(old.pages !== undefined && { from: old.pages }),
          ...(one.pages !== undefined && { to: one.pages }),
        });
      }
    }
  }
  for (const item of to.items) {
    const olds = sources.get(item.id) ?? [];
    if (olds.length > 1) changes.push({ kind: 'merge', from: olds, to: item });
  }
  for (const item of to.items) if (!reached.has(item.id)) changes.push({ kind: 'added', item });
  return changes
    .map((change, index) => ({ change, index }))
    .sort((a, b) => ORDER.indexOf(a.change.kind) - ORDER.indexOf(b.change.kind) || a.index - b.index)
    .map((one) => one.change);
}
