// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The observatory's figures for a term (#626, §1.6 and §8.4, answer 678): for
// each pack and release, the nation's figure and each wilaya's, from the
// sendings kept. A figure gives its classes, its teachers, the distinct tokens
// of its sendings, its schools (school-marks.ts), how far its classes got by
// the term's end, as the median and the quartiles, and by item its classes, the
// median of the sessions its classes spent on it, null when none spent any, and
// the shares of its classes that merged, skipped, split or re-taught it, each
// in a band, never exact: for a small figure, neighbouring bands are merged
// until each holds two counts at least, so no band pins one count. A figure
// covers at least 10 teachers and 3 schools, else it is null; the nation's
// figure is the sum of its wilayas', and an item's of its wilayas' items, so
// the floors (totals/floors.ts) also hide any figure the others would fix by
// subtraction; an item is null whenever its figure is. The floors know only
// those sums, not that an item's cell holds at most its figure's classes, so a
// hidden cell may still be bounded to a range, as floors.ts accepts. As no two
// items' sums share a cell, each item's are hidden alone, and an item whose
// nation's cell is under its floor goes no further, every wilaya's cell of it
// being smaller still. Every figure lists the same items, those the nation's
// figure shows, an item a wilaya hides or does not hold being null alike, so a
// figure never tells which items a hidden few hold. No figure adds packs or
// releases together, and teachers and schools are counted over a figure's own
// sendings, never added up. Each sending is indexed once by wilaya and item, so
// the work grows with the sendings and their items, not with their product.

import { hiddenCells, passesFloor, quantile, type FloorCell } from '../totals/floors.js';
import { MAX_SENDINGS } from './insight-store.js';
import { schoolsIn } from './school-marks.js';
import type { KeptSending } from './sending-read.js';

/** The bands a share is shown in, in percent, each from its low end up to under its high end, the last up to 100. */
export const BANDS: readonly Band[] = [
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
  /** The median of the sessions its classes spent on it, or null when none spent any. */
  readonly sessions: number | null;
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

const bandsByWhole = new Map<number, readonly Band[]>();

/** The bands for shares of `whole`, neighbours merged until each holds two of its counts at least. */
export function bandsFor(whole: number): readonly Band[] {
  const known = bandsByWhole.get(whole);
  if (known !== undefined) return known;
  const bands = mergedBands(whole);
  if (bandsByWhole.size < MAX_SENDINGS) bandsByWhole.set(whole, bands);
  return bands;
}

function mergedBands(whole: number): Band[] {
  if (whole < 2) return [[0, 100]];
  const percents = Array.from({ length: whole + 1 }, (_, count) => (100 * count) / whole);
  const held = ([low, high]: Band) =>
    percents.filter((percent) => percent >= low && (percent < high || high === 100)).length;
  const bands: Band[] = [...BANDS];
  for (let at = bands.findIndex((band) => held(band) < 2); at >= 0; at = bands.findIndex((band) => held(band) < 2)) {
    const into = at === bands.length - 1 ? at - 1 : at + 1;
    const [first, second] = [bands[Math.min(at, into)]!, bands[Math.max(at, into)]!];
    bands.splice(Math.min(at, into), 2, [first[0], second[1]]);
  }
  return bands;
}

/** The band a share of `part` in `whole` falls in. */
export function bandOf(part: number, whole: number): Band {
  const bands = bandsFor(whole);
  const percent = whole === 0 ? 0 : (100 * part) / whole;
  return bands.find(([, high]) => percent < high) ?? bands[bands.length - 1]!;
}

const sortedOf = (values: readonly number[]): number[] => [...values].sort((one, other) => one - other);

/** The items a sending holds: with sessions on them, or split. */
const itemsOf = (sending: KeptSending): Set<string> =>
  new Set([...Object.keys(sending.sessions), ...sending.changed.split]);

/** The sendings of one place, the nation or a wilaya, and those holding each item. */
interface Place {
  readonly sendings: readonly KeptSending[];
  readonly items: ReadonlyMap<string, readonly KeptSending[]>;
}

function placeOf(sendings: readonly KeptSending[]): Place {
  const items = new Map<string, KeptSending[]>();
  for (const sending of sendings) {
    for (const item of itemsOf(sending)) {
      const holding = items.get(item);
      if (holding === undefined) items.set(item, [sending]);
      else holding.push(sending);
    }
  }
  return { sendings, items };
}

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
    sessions: spent.length === 0 ? null : quantile(spent, 0.5),
    merged: share('merged'),
    skipped: share('skipped'),
    split: share('split'),
    retaught: share('retaught'),
  };
}

function figure(place: Place, items: readonly string[], hidden: (item: string) => boolean): Figure {
  const reached = sortedOf(place.sendings.map((one) => one.reached));
  return {
    classes: place.sendings.length,
    ...cover(place.sendings),
    reached: { median: quantile(reached, 0.5), low: quantile(reached, 0.25), high: quantile(reached, 0.75) },
    items: Object.fromEntries(
      items.map((item) => {
        const holding = place.items.get(item);
        return [item, holding === undefined || hidden(item) ? null : itemFigure(holding, item)];
      }),
    ),
  };
}

/** One pack and release's figures, from its sendings for the term. */
function packFigures(sendings: readonly KeptSending[]): PackFigures {
  const { grade, subject, pack, release } = sendings[0]!;
  const byWilaya = new Map<string, KeptSending[]>();
  for (const one of sendings) {
    const held = byWilaya.get(one.wilaya);
    if (held === undefined) byWilaya.set(one.wilaya, [one]);
    else held.push(one);
  }
  const wilayas = [...byWilaya.keys()].sort();
  const places = new Map<string, Place>([['', placeOf(sendings)]]);
  for (const where of wilayas) places.set(where, placeOf(byWilaya.get(where)!));
  const nation = places.get('')!;
  const hidden = new Set<string>();
  const cell = (where: string, item: string) => `${where}\n${item}`;
  const listed: string[] = [];
  for (const item of ['', ...[...nation.items.keys()].sort()]) {
    const heldIn = (place: Place) => (item === '' ? place.sendings : place.items.get(item));
    const total: FloorCell = { id: cell('', item), scope: 'national', ...cover(heldIn(nation)!) };
    if (item !== '' && !passesFloor(total)) continue;
    const parts = wilayas.flatMap((where): FloorCell[] => {
      const held = heldIn(places.get(where)!);
      return held === undefined ? [] : [{ id: cell(where, item), scope: 'wilaya', ...cover(held) }];
    });
    const sum = { total: total.id, parts: parts.map((one) => one.id) };
    for (const id of hiddenCells([total, ...parts], [sum])) hidden.add(id);
    if (item !== '' && !hidden.has(total.id)) listed.push(item);
  }
  const shown = (where: string): Figure | null =>
    hidden.has(cell(where, '')) ? null : figure(places.get(where)!, listed, (item) => hidden.has(cell(where, item)));
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
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [one]);
    else group.push(one);
  }
  return [...groups.keys()].sort().map((key) => packFigures(groups.get(key)!));
}
