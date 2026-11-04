// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Source editing for the curator's form (#613). Every operation makes a
// new, fully read pack; no reference object, teacher pin or history changes.
// An existing item's ID stays fixed. Removing or moving an item refuses
// broken unit, stage, merge, activity or migration references rather than
// silently removing them. Publication authority belongs to the lifecycle.

import { readPackItemForm } from './pack-item-form.ts';
import { parsePlanPack, type PackActivity, type PlanPack, type StageTemplate, type TimeAnchor } from './pack.ts';
import type { ParseResult } from './read.ts';

const invalid = (path: string): ParseResult<PlanPack> => ({ ok: false, problems: [{ path, problem: 'invalid' }] });

/** Adds or replaces a form's item; a new item goes before `before`, or at the end. */
export function editPackItem(
  pack: PlanPack,
  id: string | null,
  form: unknown,
  before: string | null = null,
): ParseResult<PlanPack> {
  if (id !== null && !pack.items.some((item) => item.id === id)) return invalid('id');
  if (before !== null && !pack.items.some((item) => item.id === before)) return invalid('before');
  const read = readPackItemForm(pack, form, id);
  if (!read.ok) return read;
  const items = id === null ? [...pack.items] : pack.items.map((one) => (one.id === id ? read.value : one));
  if (id === null)
    items.splice(before === null ? items.length : items.findIndex((one) => one.id === before), 0, read.value);
  return parsePlanPack({ ...pack, items });
}

/** Takes out one item only when the remaining pack still reads. */
export function removePackItem(pack: PlanPack, id: string): ParseResult<PlanPack> {
  if (!pack.items.some((item) => item.id === id)) return invalid('id');
  return parsePlanPack({ ...pack, items: pack.items.filter((item) => item.id !== id) });
}

/** Reorders an item without changing its meaning or hiding broken references. */
export function movePackItem(pack: PlanPack, id: string, before: string | null): ParseResult<PlanPack> {
  const item = pack.items.find((one) => one.id === id);
  if (item === undefined || (before !== null && !pack.items.some((one) => one.id === before))) return invalid('id');
  if (id === before) return parsePlanPack(pack);
  const items = pack.items.filter((one) => one.id !== id);
  items.splice(before === null ? items.length : items.findIndex((one) => one.id === before), 0, item);
  return parsePlanPack({ ...pack, items });
}

/** Changes an anchor or templates; removing the weekly model needs an explicit null. */
export function editPackStructure(
  pack: PlanPack,
  change: {
    readonly anchor: TimeAnchor;
    readonly stageTemplates: readonly StageTemplate[];
    readonly activities: readonly PackActivity[] | null;
  },
): ParseResult<PlanPack> {
  if (
    change.activities === null &&
    pack.activities !== undefined &&
    pack.items.some((item) => item.activity !== undefined)
  )
    return { ok: false, problems: [{ path: 'activities', problem: 'unknown-reference' }] };
  return parsePlanPack({
    ...pack,
    anchor: change.anchor,
    stageTemplates: change.stageTemplates,
    activities: change.activities ?? undefined,
  });
}
