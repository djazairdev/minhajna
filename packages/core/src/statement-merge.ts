// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's merge for the teaching council (#246, R-Merge, answers 489 and
// 492): for one grade and subject of the school's picture, each class's latest
// statement in the school's order, its last resource placed on its pack's unit
// as this app has it. The pack is the statement's own release, or else the
// newest release this app has under its ID, newer than the statement's, that
// keeps the resource's ID. A teacher's own list, a pack this app lacks, one
// it has only in older releases, or a resource none of the releases keeps is
// not placed: the statement's own words stand, with why. Nothing is ranked:
// rows keep the picture's order.

import { compareReleases } from './pack-catalogue.ts';
import { queueItems, type PlanPack } from './pack.ts';
import type { PictureGrade } from './statement-picture.ts';
import type { ProgressStatement, StatementItem } from './statement-read.ts';
import type { Received } from './statement-received.ts';

/** Where a statement's last resource falls in this app's pack. */
export interface MergePlace {
  /** The resource's unit, with its place among the pack's units; null when the resource belongs to none. */
  readonly unit: { readonly title: string; readonly at: number; readonly of: number } | null;
  /** The unit's main items in the plan's order, or the resource alone outside a unit. */
  readonly items: readonly StatementItem[];
  /** The resource's index in `items`. */
  readonly at: number;
  /** The release it was placed on: the statement's own, or a newer one this app has. */
  readonly release: string;
}

/**
 * Why a last resource is not placed: a teacher's own list, a pack this app lacks, only releases older than the
 * statement's, or no release that keeps it.
 */
export type MergeMiss = 'own' | 'noPack' | 'older' | 'noItem';

/** One class of the merge: its latest statement for the subject, and where it falls. */
export interface MergeRow {
  /** The school its rows are grouped under in the picture, or null. */
  readonly school: string | null;
  readonly section: string;
  readonly one: Received;
  /** Null when there is no resource yet, or it cannot be placed. */
  readonly place: MergePlace | null;
  /** Why the resource is not placed; null when it is, or when there is none yet. */
  readonly miss: MergeMiss | null;
}

export interface Merge {
  readonly rows: readonly MergeRow[];
  /** The keys that signed the rows' statements. */
  readonly teachers: number;
}

const named = (item: { id: string; title: string }): StatementItem => ({ id: item.id, title: item.title });

/** The statement's last resource on its pack's unit, as this app has it, why it is not placed, or null for none. */
export function placeResource(packs: readonly PlanPack[], statement: ProgressStatement): MergePlace | MergeMiss | null {
  const { pack, lastResource } = statement;
  if (lastResource === null) return null;
  if (pack.release === 'own') return 'own';
  const same = packs.filter((one) => one.id === pack.id && one.status !== 'own');
  if (same.length === 0) return 'noPack';
  const newer = same
    .filter((one) => compareReleases(one.release, pack.release) > 0)
    .sort((a, b) => compareReleases(b.release, a.release));
  const tried = [...same.filter((one) => one.release === pack.release), ...newer];
  if (tried.length === 0) return 'older';
  for (const candidate of tried) {
    const item = candidate.items.find((one) => one.id === lastResource.id);
    if (item === undefined || item.kind === 'unit' || item.kind === 'td') continue;
    const units = candidate.items.filter((one) => one.kind === 'unit');
    const unitAt = units.findIndex((one) => one.id === item.unit);
    const items = unitAt === -1 ? [item] : queueItems(candidate, 'main').filter((one) => one.unit === item.unit);
    return {
      unit: unitAt === -1 ? null : { title: units[unitAt]!.title, at: unitAt + 1, of: units.length },
      items: items.map(named),
      at: items.indexOf(item),
      release: candidate.release,
    };
  }
  return 'noItem';
}

/** The merge of one grade's part of the picture for one subject, in the picture's order. */
export function statementMerge(part: PictureGrade, subject: string, packs: readonly PlanPack[]): Merge {
  const rows = part.groups.flatMap((group) =>
    group.rows.flatMap((row) => {
      const one = row.cells.get(subject);
      if (one === undefined) return [];
      const found = placeResource(packs, one.statement);
      const miss = typeof found === 'string' ? found : null;
      return [
        { school: group.school, section: row.section, one, place: typeof found === 'string' ? null : found, miss },
      ];
    }),
  );
  return { rows, teachers: new Set(rows.map((row) => row.one.spki)).size };
}
