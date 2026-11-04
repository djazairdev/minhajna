// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What Obs-Report's cards say of a figure (#627, answer 680): by plan item, in
// the pack's order when the app holds the pack, the server's otherwise, its
// title, or its ID without the pack, the sessions the plan gives it where the
// pack counts in sessions, and the median, marked when above the plan as the
// page writes both; the item most often merged, skipped, split and re-taught,
// by its band, then its classes, the first in order on a tie, with how many
// others share its band, so a band all items share is no finding, and none when
// every item is hidden; how many classes the items shown cover; and a band as
// words take it, never a percentage of a class.

import type { PackItem, PlanPack } from '@minhajna/core';
import { roundFigure } from '../text/figures';
import type { Band, Figure, ItemFigure } from './figures-read';

/** The lists a class changes an item by, in the order the card says them. */
export const CHANGES = ['split', 'merged', 'skipped', 'retaught'] as const;

export type Change = (typeof CHANGES)[number];

/** A plan item's row. */
export interface ReportRow {
  readonly id: string;
  readonly title: string;
  /** The sessions the plan gives it, null when the pack is not held or does not count in sessions. */
  readonly plan: number | null;
  /** Its figure, null when the server hides it. */
  readonly item: ItemFigure | null;
  /** Whether its median is above the plan. */
  readonly above: boolean;
}

function planOf(pack: PlanPack, item: PackItem | undefined): number | null {
  if (item === undefined) return null;
  if (pack.anchor.kind === 'weeks') return item.budget ?? 1;
  return pack.anchor.unit === 'sessions' ? (item.budget ?? null) : null;
}

/** The figure's items as rows, in the pack's order when it is held. */
export function reportRows(figure: Figure, pack: PlanPack | undefined): readonly ReportRow[] {
  const held = new Map(pack?.items.map((item, at) => [item.id, { item, at }]));
  const place = (id: string) => held.get(id)?.at ?? Infinity;
  const inOrder = figure.items
    .map((entry, at) => ({ entry, at, place: place(entry[0]) }))
    .sort((one, other) => (one.place === other.place ? one.at - other.at : one.place - other.place));
  return inOrder.map(({ entry: [id, item] }) => {
    const planned = held.get(id)?.item;
    const plan = pack === undefined ? null : planOf(pack, planned);
    const median = item?.sessions ?? null;
    const above = plan !== null && median !== null && roundFigure(median) > roundFigure(plan);
    return { id, title: planned?.title ?? id, plan, item, above };
  });
}

/** The item most often changed by the list, its band and how many others share it, or null when no item is shown. */
export function mostChanged(rows: readonly ReportRow[], change: Change) {
  let best: { readonly row: ReportRow; readonly band: Band; readonly classes: number } | null = null;
  for (const row of rows) {
    if (row.item === null) continue;
    const band = row.item[change];
    const classes = row.item.classes;
    const ahead =
      best === null ||
      band[0] > best.band[0] ||
      (band[0] === best.band[0] && (band[1] > best.band[1] || (band[1] === best.band[1] && classes > best.classes)));
    if (ahead) best = { row, band, classes };
  }
  if (best === null) return null;
  const [low, high] = best.band;
  const same = rows.filter((row) => row.item !== null && row.item[change][0] === low && row.item[change][1] === high);
  return { row: best.row, band: best.band, others: same.length - 1 };
}

/** The fewest and the most classes an item shown covers, or null when none is shown. */
export function classesRange(rows: readonly ReportRow[]) {
  const classes = rows.flatMap((row) => (row.item === null ? [] : [row.item.classes]));
  return classes.length === 0 ? null : { low: Math.min(...classes), high: Math.max(...classes) };
}

/** How the catalogue words a band, and the figures it takes. */
export function bandWords(band: Band) {
  const [low, high] = band;
  if (low === 0 && high < 100) return { key: 'under', low, high } as const;
  if (high === 100 && low > 0) return { key: 'over', low, high } as const;
  return { key: 'between', low, high } as const;
}

/** Thousandths of a plan as a percentage. */
export const percentOf = (thousandths: number) => thousandths / 10;
