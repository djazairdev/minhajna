// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The observatory's figures for a term (#626, §1.6 and §8.4, answer 678): for
// each pack and release, the nation's figure and each wilaya's, from the
// sendings kept. A figure gives its classes, its teachers, the distinct tokens
// of its sendings, its schools (school-marks.ts), how far its classes got by
// the term's end, as the median and the quartiles, and by item its classes,
// the median of its sessions and the shares of its classes that merged,
// skipped, split or re-taught it, each in a band, never exact. A figure covers
// at least 10 teachers and 3 schools, else it is null; the nation's figure is
// the sum of its wilayas', and an item's of its wilayas' items, so the floors
// (totals/floors.ts) also hide any figure the others would fix by subtraction;
// an item is null whenever its figure is. No figure adds packs or releases
// together, and teachers and schools are counted over a figure's own sendings,
// never added up.

import { hiddenCells, type FloorCell, type FloorSum } from '../totals/floors.js';
import { schoolsIn } from './school-marks.js';
import type { KeptSending } from './sending-read.js';

/** The bands a share is shown in, in percent, as Obs-Report draws them. */
export const BANDS: readonly (readonly [number, number])[] = [
  [0, 5],
  [5, 15],
  [15, 30],
  [30, 50],
  [50, 70],
  [70, 85],
  [85, 95],
  [95, 100],
];

export type Band = readonly [number, number];

export interface ItemFigure {
  readonly classes: number;
  /** The median of the sessions its classes spent on it. */
  readonly sessions: number;
  readonly merged: Band;
  readonly skipped: Band;
  readonly split: Band;
  readonly retaught: Band;
}

export interface Figure {
  readonly classes: number;
  readonly teachers: number;
  readonly schools: number;
  /** How far the classes got by the term's end, in thousandths: the median and the quartiles. */
  readonly reached: { readonly median: number; readonly low: number; readonly high: number };
  readonly items: Readonly<Record<string, ItemFigure | null>>;
}

export interface PackFigures {
  readonly grade: string;
  readonly subject: string;
  readonly pack: string;
  readonly release: string;
  readonly nation: Figure | null;
  readonly wilayas: Readonly<Record<string, Figure | null>>;
}

/** The band a share of `part` in `whole` falls in. */
export function bandOf(part: number, whole: number): Band {
  const percent = whole === 0 ? 0 : (100 * part) / whole;
  return BANDS.find(([, high]) => percent < high) ?? BANDS[BANDS.length - 1]!;
}

/** The value `at` of the way through sorted values, between the two nearest, as a spreadsheet's QUARTILE.INC. */
function quantile(sorted: readonly number[], at: number): number {
  if (sorted.length === 0) return 0;
  const place = (sorted.length - 1) * at;
  const below = Math.floor(place);
  const low = sorted[below]!;
  const high = sorted[Math.min(below + 1, sorted.length - 1)]!;
  return low + (high - low) * (place - below);
}

const sortedOf = (values: readonly number[]): number[] => [...values].sort((one, other) => one - other);

/** The sendings holding an item: with sessions on it, or split. */
const holding = (sendings: readonly KeptSending[], item: string): KeptSending[] =>
  sendings.filter((one) => Object.hasOwn(one.sessions, item) || one.changed.split.includes(item));

const cover = (sendings: readonly KeptSending[]) => ({
  teachers: new Set(sendings.map((one) => one.token)).size,
  schools: schoolsIn(sendings.map((one) => one.mark)),
});

function itemFigure(sendings: readonly KeptSending[], item: string): ItemFigure {
  const spent = sortedOf(sendings.flatMap((one) => (Object.hasOwn(one.sessions, item) ? [one.sessions[item]!] : [])));
  const share = (list: 'merged' | 'skipped' | 'split' | 'retaught') =>
    bandOf(sendings.filter((one) => one.changed[list].includes(item)).length, sendings.length);
  return {
    classes: sendings.length,
    sessions: quantile(spent, 0.5),
    merged: share('merged'),
    skipped: share('skipped'),
    split: share('split'),
    retaught: share('retaught'),
  };
}

function figure(sendings: readonly KeptSending[], items: readonly string[], hidden: (item: string) => boolean): Figure {
  const reached = sortedOf(sendings.map((one) => one.reached));
  return {
    classes: sendings.length,
    ...cover(sendings),
    reached: { median: quantile(reached, 0.5), low: quantile(reached, 0.25), high: quantile(reached, 0.75) },
    items: Object.fromEntries(
      items.map((item) => [item, hidden(item) ? null : itemFigure(holding(sendings, item), item)]),
    ),
  };
}

/** One pack and release's figures, from its sendings for the term. */
function packFigures(sendings: readonly KeptSending[]): PackFigures {
  const { grade, subject, pack, release } = sendings[0]!;
  const wilayas = [...new Set(sendings.map((one) => one.wilaya))].sort();
  const of = (where: string) => sendings.filter((one) => where === '' || one.wilaya === where);
  const items = [...new Set(sendings.flatMap((one) => [...Object.keys(one.sessions), ...one.changed.split]))].sort();
  const cells: FloorCell[] = [];
  const sums: FloorSum[] = [];
  const place = (where: string, item: string) => `${where}\n${item}`;
  for (const item of ['', ...items]) {
    const parts: string[] = [];
    for (const where of ['', ...wilayas]) {
      const held = item === '' ? of(where) : holding(of(where), item);
      if (held.length === 0) continue;
      cells.push({ id: place(where, item), scope: where === '' ? 'national' : 'wilaya', ...cover(held) });
      if (where !== '') parts.push(place(where, item));
    }
    sums.push({ total: place('', item), parts });
  }
  const hidden = hiddenCells(cells, sums);
  const shown = (where: string): Figure | null =>
    hidden.has(place(where, ''))
      ? null
      : figure(
          of(where),
          items.filter((item) => holding(of(where), item).length > 0),
          (item) => hidden.has(place(where, item)),
        );
  return {
    grade,
    subject,
    pack,
    release,
    nation: shown(''),
    wilayas: Object.fromEntries(wilayas.map((where) => [where, shown(where)])),
  };
}

/** A term's figures for each pack and release, in order, from the sendings kept. */
export function termFigures(sendings: readonly KeptSending[], year: string, term: number): PackFigures[] {
  const groups = new Map<string, KeptSending[]>();
  for (const one of sendings) {
    if (one.year !== year || one.term !== term) continue;
    const key = [one.grade, one.subject, one.pack, one.release].join('\n');
    groups.set(key, [...(groups.get(key) ?? []), one]);
  }
  return [...groups.keys()].sort().map((key) => packFigures(groups.get(key)!));
}
