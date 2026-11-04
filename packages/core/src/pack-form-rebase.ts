// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Moving an open form onto a newer revision of its draft, when another curator
// saved first (#613, answer 751). What this curator changed stays. What they
// left takes the newer value, so saving doesn't undo the other's work. Lists
// merge entry by entry, by ID or code, and field by field. Two curators who
// change the same field leave this one's. A second entry goes when its first
// entry changes under it, and any word that budgets were rechecked goes too,
// as the newer items weren't seen.

import { ITEM_NUMBERS, packItemForm, type PackItemForm } from './pack-item-form.ts';
import { packStructureForm, type PackStructureForm } from './pack-structure-form.ts';
import type { PackItem, PlanPack } from './pack.ts';
import type { LocalizedText } from './reference.ts';

const same = (one: unknown, other: unknown) => JSON.stringify(one) === JSON.stringify(other);

/** Each field of `form` the curator left as it was in `was` takes its value in `now`. */
export function rebaseForm<T extends object>(form: T, was: T, now: T): T {
  const next = { ...form };
  for (const key of Object.keys(form) as (keyof T)[]) if (same(form[key], was[key])) next[key] = now[key];
  return next;
}

/**
 * A list moved onto a newer revision, in this curator's order. An entry in both
 * revisions merges field by field. One they added stays, and so does one they
 * changed that the newer list dropped; one they removed stays out. An entry
 * only the newer list added comes last. Each row of a repeated ID follows these
 * rules alone, and any repeat left reaches the reader, which refuses it.
 */
function rebaseList<T>(
  mine: readonly T[],
  was: readonly T[],
  now: readonly T[],
  key: (one: T) => string,
  bare: (one: T) => unknown,
  merge: (kept: T, before: T, newer: T) => T,
): T[] {
  const find = (list: readonly T[], one: T) => list.find((other) => key(other) === key(one));
  const merged: T[] = [];
  for (const kept of mine) {
    const before = find(was, kept);
    const newer = find(now, kept);
    if (before !== undefined && newer !== undefined) merged.push(merge(kept, before, newer));
    else if (before === undefined || !same(bare(kept), bare(before))) merged.push(kept);
  }
  for (const newer of now) if (find(was, newer) === undefined && find(mine, newer) === undefined) merged.push(newer);
  return merged;
}

/** An activity's name, each language following the same rule as a field. */
function rebaseName(kept: LocalizedText, before: LocalizedText, newer: LocalizedText): LocalizedText {
  const merged: Record<string, string> = {};
  for (const language of new Set([...Object.keys(kept), ...Object.keys(newer)])) {
    const word = kept[language] === before[language] ? newer[language] : kept[language];
    if (word !== undefined) merged[language] = word;
  }
  return merged;
}

/** The unit a pack's budgets are in, or null when it keeps to weeks. */
export function budgetUnitOf(pack: PlanPack): 'hours' | 'sessions' | null {
  return pack.anchor.kind === 'weeks' ? null : pack.anchor.unit;
}

/** An item's form moved from one revision of the item to a newer one. */
export function rebasePackItemForm(form: PackItemForm, was: PackItem, now: PackItem): PackItemForm {
  const next = rebaseForm({ ...form, retyped: packItemForm(was).retyped }, packItemForm(was), packItemForm(now));
  const retyped = { ...form.retyped };
  for (const key of ITEM_NUMBERS) if (next[key] !== form[key]) retyped[key] = '';
  return { ...next, retyped };
}

/** A structure form moved from one revision of the pack to a newer one. */
export function rebasePackStructureForm(form: PackStructureForm, was: PlanPack, now: PlanPack): PackStructureForm {
  const from = packStructureForm(was);
  const to = packStructureForm(now);
  const templates = rebaseList(
    form.templates,
    from.templates,
    to.templates,
    (one) => one.id.trim(),
    ({ id, stages }) => ({ id: id.trim(), stages }),
    (kept, before, newer) => rebaseForm(kept, before, newer),
  );
  const activities = rebaseList(
    form.activities,
    from.activities,
    to.activities,
    (one) => one.code.trim(),
    ({ code, name, sessions }) => ({ code: code.trim(), name: Object.entries(name).sort(), sessions }),
    (kept, before, newer) => {
      const sessions = kept.sessions === before.sessions ? newer.sessions : kept.sessions;
      return {
        code: kept.code,
        name: rebaseName(kept.name, before.name, newer.name),
        sessions,
        retyped: sessions === kept.sessions ? kept.retyped : '',
      };
    },
  );
  return { ...rebaseForm(form, from, to), templates, activities, budgetsRechecked: false };
}
