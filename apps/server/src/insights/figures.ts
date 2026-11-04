// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The observatory's figures for a term (#626, §1.6 and §8.4, answer 678): for
// each pack and release, the nation's figure and each wilaya's, from the
// sendings kept but those outliers.ts sets aside (#628, answer 679), which
// count toward no figure, floor or median, the number set aside given beside
// the nation's figure when shown. A figure gives its classes, its teachers, the
// distinct tokens of its sendings, its schools (school-marks.ts), how far its
// classes got by the term's end, as the median and the quartiles, and by item
// its classes, the median of the sessions spent on it by those of its classes
// that logged sessions on it, a zero being none logged, shown only when they
// too cover the floor, and the shares of its classes that merged, skipped,
// split or re-taught it, each in a band (bands.ts). A figure covers at least 10
// teachers and 3 schools, else it is hidden; the nation's figure is the sum of
// its wilayas', and an item's of its wilayas' items, so the floors
// (totals/floors.ts) also hide any figure the others would fix by subtraction;
// an item is hidden whenever its figure is. The floors know only those sums,
// not that an item's cell holds at most its figure's classes, so a hidden cell
// may still be bounded to a range, as floors.ts accepts. As no two items' sums
// share a cell, each item's are hidden alone, among the wilayas holding it, and
// an item whose nation's cell is under its floor goes no further, every
// wilaya's being smaller still. Of the wilayas whose own figure is under its
// floor, and so its items too, two stand in an item's sum for them all: with
// two hidden parts a sum fixes none, so the rest change nothing, and their
// figures are hidden anyway. At most MOST_SENDING_ITEMS items are listed, those
// of the most classes, one the nation's figure hides by subtraction taking no
// other's place, and every figure lists the same ones, an item a wilaya hides
// or does not hold being null alike, so no figure tells which items a hidden
// few hold; a hidden wilaya is left out, as one with no sending is. No figure
// adds packs or releases together, and teachers and schools are counted over a
// figure's own sendings, never added up. Each sending is read once, its items
// with the lists each is in as flags, and indexed by wilaya and item, so the
// work grows with the sendings and their items. The median and quartiles are
// worked out as quantile.ts works them out.

import { hiddenCells, passesFloor, type FloorCell, type FloorScope } from '../totals/floors.js';
import { bandOf, type Band } from './bands.js';
import { floodedTokens, withinFences } from './outliers.js';
import { quantile, sortedOf } from './quantile.js';
import { schoolsIn } from './school-marks.js';
import { MOST_SENDING_ITEMS, type KeptSending } from './sending-read.js';

export interface ItemFigure {
  readonly classes: number;
  /** The median of the sessions above 0 on it, null when its classes that logged any fall under the floor. */
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
  /** How far the classes got by the term's end, in thousandths: the median and the quartiles, maybe fractional. */
  readonly reached: { readonly median: number; readonly low: number; readonly high: number };
  readonly items: Readonly<Record<string, ItemFigure | null>>;
}

export interface PackFigures {
  readonly grade: string;
  readonly subject: string;
  readonly pack: string;
  readonly release: string;
  readonly nation: Figure | null;
  /** The wilayas whose figures are shown; one hidden is left out. */
  readonly wilayas: Readonly<Record<string, Figure>>;
  /** How many of the pack's classes outliers.ts set aside, given only beside a nation's figure shown. */
  readonly setAside: number | null;
}

type List = 'merged' | 'skipped' | 'split' | 'retaught';
const LISTS: readonly List[] = ['merged', 'skipped', 'split', 'retaught'];

/** The bit of an item's flags that says sessions above 0 were logged on it; each list's is next, in LISTS' order. */
const LOGGED = 1;
const bitOf = (list: List) => 2 << LISTS.indexOf(list);

/** A sending as the figures read it: each item it holds, with sessions, maybe 0, or split, and that item's flags. */
interface Read {
  readonly sending: KeptSending;
  readonly items: ReadonlyMap<string, number>;
}

function readOf(sending: KeptSending): Read {
  const items = new Map<string, number>(
    Object.entries(sending.sessions).map(([item, sessions]) => [item, sessions > 0 ? LOGGED : 0]),
  );
  for (const list of LISTS)
    for (const item of sending.changed[list]) items.set(item, (items.get(item) ?? 0) | bitOf(list));
  return { sending, items };
}

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

interface Cover {
  readonly teachers: number;
  readonly schools: number;
}

const cover = (reads: readonly Read[]): Cover => ({
  teachers: new Set(reads.map((one) => one.sending.token)).size,
  schools: schoolsIn(reads.map((one) => one.sending.mark)),
});

const scopeOf = (where: string): FloorScope => (where === '' ? 'national' : 'wilaya');

/** An item's figure from the classes holding it, whose cover `held` is, counting each list in one pass. */
function itemFigure(reads: readonly Read[], item: string, scope: FloorScope, held: Cover): ItemFigure {
  const logged: Read[] = [];
  const counts = [0, 0, 0, 0, 0];
  for (const one of reads) {
    const flags = one.items.get(item)!;
    if ((flags & LOGGED) !== 0) logged.push(one);
    for (let bit = 1; bit < 5; bit += 1) counts[bit]! += (flags >> bit) & 1;
  }
  const spent = sortedOf(logged.map((one) => one.sending.sessions[item]!));
  const share = (list: List) => bandOf(counts[LISTS.indexOf(list) + 1]!, reads.length);
  const loggedCover = logged.length === reads.length ? held : cover(logged);
  return {
    classes: reads.length,
    sessions: passesFloor({ scope, ...loggedCover }) ? quantile(spent, 0.5) : null,
    merged: share('merged'),
    skipped: share('skipped'),
    split: share('split'),
    retaught: share('retaught'),
  };
}

/** One pack and release's figures, from its sendings for the term, all but the count set aside. */
function packFigures(sendings: readonly KeptSending[]): Omit<PackFigures, 'setAside'> {
  const { grade, subject, pack, release } = sendings[0]!;
  const reads = sendings.map(readOf);
  const places = new Map<string, Read[]>([['', reads]]);
  const holders = new Map<string, Map<string, Read[]>>();
  for (const one of reads) {
    pushTo(places, one.sending.wilaya, one);
    for (const item of one.items.keys()) {
      const byPlace = holders.get(item) ?? new Map<string, Read[]>();
      holders.set(item, byPlace);
      pushTo(byPlace, '', one);
      pushTo(byPlace, one.sending.wilaya, one);
    }
  }
  const cell = (where: string, item: string) => `${where}\n${item}`;
  const covers = new Map<string, Cover>();
  const coverAt = (where: string, item: string, held: readonly Read[]): Cover => {
    const id = cell(where, item);
    const known = covers.get(id) ?? cover(held);
    covers.set(id, known);
    return known;
  };
  const hidden = new Set<string>();
  const under = (where: string) => !passesFloor({ scope: 'wilaya', ...coverAt(where, '', places.get(where)!) });
  const hide = (item: string, byPlace: ReadonlyMap<string, readonly Read[]>) => {
    let spare = 2;
    const parts = [...byPlace].filter(([where]) => item === '' || where === '' || !under(where) || spare-- > 0);
    const cells = parts.map(([where, held]): FloorCell => ({
      id: cell(where, item),
      scope: scopeOf(where),
      ...coverAt(where, item, held),
    }));
    const sum = { total: cell('', item), parts: cells.filter((one) => one.scope === 'wilaya').map((one) => one.id) };
    for (const id of hiddenCells(cells, [sum])) hidden.add(id);
  };
  hide('', places);
  const nationClasses = (item: string) => holders.get(item)!.get('')!.length;
  const listed = [...holders.keys()]
    .filter((item) => passesFloor({ scope: 'national', ...coverAt('', item, holders.get(item)!.get('')!) }))
    .sort((one, other) => nationClasses(other) - nationClasses(one) || (one < other ? -1 : 1))
    .slice(0, MOST_SENDING_ITEMS)
    .filter((item) => {
      hide(item, holders.get(item)!);
      return !hidden.has(cell('', item));
    })
    .sort();
  const figure = (where: string): Figure => {
    const held = places.get(where)!;
    const reached = sortedOf(held.map((one) => one.sending.reached));
    const itemOf = (item: string) => {
      const holding = holders.get(item)!.get(where);
      if (holding === undefined || hidden.has(cell(where, item))) return null;
      return itemFigure(holding, item, scopeOf(where), coverAt(where, item, holding));
    };
    return {
      classes: held.length,
      ...coverAt(where, '', held),
      reached: { median: quantile(reached, 0.5), low: quantile(reached, 0.25), high: quantile(reached, 0.75) },
      items: Object.fromEntries(listed.map((item) => [item, itemOf(item)])),
    };
  };
  const wilayas = [...places.keys()].filter((where) => where !== '' && !hidden.has(cell(where, ''))).sort();
  return {
    grade,
    subject,
    pack,
    release,
    nation: hidden.has(cell('', '')) ? null : figure(''),
    wilayas: Object.fromEntries(wilayas.map((where) => [where, figure(where)])),
  };
}

/**
 * A term's figures for each pack and release, in order, from the sendings kept, those outliers.ts sets aside left out
 * and counted, the count given only beside a nation's figure shown.
 */
export function termFigures(sendings: readonly KeptSending[], year: string, term: number): PackFigures[] {
  const ofTerm = sendings.filter((one) => one.year === year && one.term === term);
  const flooded = floodedTokens(ofTerm);
  const groups = new Map<string, KeptSending[]>();
  for (const one of ofTerm) pushTo(groups, [one.grade, one.subject, one.pack, one.release].join('\n'), one);
  return [...groups.keys()].sort().map((key) => {
    const group = groups.get(key)!;
    const kept = withinFences(group.filter((one) => !flooded.has(one.token)));
    if (kept.length === 0) {
      const { grade, subject, pack, release } = group[0]!;
      return { grade, subject, pack, release, nation: null, wilayas: {}, setAside: null };
    }
    const figures = packFigures(kept);
    return { ...figures, setAside: figures.nation === null ? null : group.length - kept.length };
  });
}
