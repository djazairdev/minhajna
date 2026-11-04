// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How a class compares with its peers (#623, §1.6, §8.4, R-1.6-07, R-4.9-03,
// R-8.4-02 to R-8.4-04, answer 700), worked out on the device from a term's
// published figures, as Insights-compare draws it, so nothing about the class
// is sent to make it. Each item of the plan the class or the figure speaks of,
// in the plan's order, gives the sessions the plan gives it, the median and the
// class's own, the median marked when it runs over the plan. The plan's
// sessions are the item's budget, scaled when the plan's budget covers under
// half the year's lessons, as a seeded course stretches it (planScale). The
// items most changed come as bands, never a share, and how far the classes got
// as places in the plan: the class's, the median's and the middle half's. An
// item a figure hides has no median and no change; an item neither speaks of is
// left out.

import type { InsightsSending } from './insights.ts';
import type { PackItem } from './pack.ts';
import { PLAN_SHARE } from './seeded-plan.ts';

/** A share's band in percent, from its low end up to under its high end. */
export type CompareBand = readonly [number, number];

export const COMPARE_LISTS = ['merged', 'skipped', 'split', 'retaught'] as const;
export type CompareList = (typeof COMPARE_LISTS)[number];

/** A published item: the median of its sessions when shown, and the bands of its lists. */
export type CompareItem = Readonly<Record<CompareList, CompareBand>> & { readonly sessions: number | null };

/** A published figure, for the nation or a wilaya, as far as a comparison reads it. */
export interface CompareFigure {
  /** How far the classes got by the term's end, in thousandths. */
  readonly reached: { readonly low: number; readonly median: number; readonly high: number };
  readonly items: readonly (readonly [string, CompareItem | null])[];
}

export interface CompareRow {
  readonly item: string;
  readonly title: string;
  readonly planned: number;
  readonly median: number | null;
  readonly mine: number | null;
  /** Whether the median runs over what the plan gives. */
  readonly over: boolean;
}

export interface CompareChange {
  readonly list: CompareList;
  readonly item: string;
  readonly title: string;
  readonly band: CompareBand;
}

export interface InsightsComparison {
  readonly rows: readonly CompareRow[];
  /** The changes most classes made, the most first. */
  readonly changes: readonly CompareChange[];
  /** The plan's items where the class, the median and the middle half's ends stood at its end; null, not begun. */
  readonly place: {
    readonly mine: string | null;
    readonly median: string | null;
    readonly low: string | null;
    readonly high: string | null;
  } | null;
}

/** The most changes a comparison names. */
const MOST_CHANGES = 3;

/** The budget a plan's item takes, as a seeded course moves through it. */
const budgetOf = (item: PackItem): number => Math.max(1, item.budget ?? 1);

/**
 * What each unit of a plan's budget takes in sessions: 1, unless the budget covers under half the year's lessons, as
 * an example pack's does, when a seeded course stretches it over them.
 */
export function planScale(items: readonly PackItem[], lessons: number): number {
  const total = items.reduce((sum, item) => sum + budgetOf(item), 0);
  return total === 0 || total * 2 >= lessons ? 1 : (lessons * PLAN_SHARE) / total;
}

/** The plan's item at so many thousandths of its budget, the last at its end; null at the start, none reached yet. */
function itemAt(items: readonly PackItem[], thousandths: number): PackItem | null {
  if (thousandths <= 0) return null;
  const total = items.reduce((sum, item) => sum + budgetOf(item), 0);
  const reached = (Math.min(thousandths, 1000) * total) / 1000;
  let end = 0;
  return items.find((item) => (end += budgetOf(item)) > reached) ?? items.at(-1) ?? null;
}

/** The class's comparison with a published figure of its pack. */
export function insightsCompare(
  sending: InsightsSending,
  items: readonly PackItem[],
  figure: CompareFigure,
  scale = 1,
): InsightsComparison {
  const published = new Map(figure.items);
  const rows: CompareRow[] = [];
  const changes: CompareChange[] = [];
  for (const item of items) {
    const shown = published.get(item.id) ?? null;
    const median = shown?.sessions ?? null;
    const mine = Object.hasOwn(sending.sessions, item.id) ? sending.sessions[item.id]! : null;
    if (mine !== null || median !== null) {
      const planned = Math.round(budgetOf(item) * scale);
      rows.push({ item: item.id, title: item.title, planned, median, mine, over: median !== null && median > planned });
    }
    if (shown === null) continue;
    for (const list of COMPARE_LISTS) {
      if (shown[list][0] > 0) changes.push({ list, item: item.id, title: item.title, band: shown[list] });
    }
  }
  changes.sort((a, b) => b.band[0] - a.band[0] || b.band[1] - a.band[1]);
  const at = (thousandths: number) => itemAt(items, thousandths)?.title ?? null;
  const { low, median, high } = figure.reached;
  return {
    rows,
    changes: changes.slice(0, MOST_CHANGES),
    place: items.length === 0 ? null : { mine: at(sending.reached), median: at(median), low: at(low), high: at(high) },
  };
}
