// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The floors under the totals above the school (#595, PRD §7.9 and §5.10,
// answers 539, 545, 549 and 584): a directorate's figure covers at least 5
// teachers and 3 schools, a wilaya's or the nation's at least 10 teachers and 3
// schools, and a figure under its floor is hidden; a figure that covers no
// school at all is known to be empty and stays shown. So is hidden any figure
// that would let a hidden one be worked out exactly by subtraction. Each sum, a
// total and its parts, is an equation, and the hidden figures are its unknowns;
// while any one of them is fixed by some combination of the sums, worked out
// with exact integers, a shown figure of a sum that holds one is hidden too:
// the smallest, by the fewest teachers, then the fewest schools, then the first
// ID, whose hiding leaves fewer worked out, or the smallest if none does, so
// the same figures always hide the same cells. Only sums that share a hidden
// figure are solved together, one group at a time, so a large table stays
// quick. This keeps every hidden figure from being worked out exactly, across a
// table's rows and columns, a directorate within its wilaya within the nation,
// and sums that share figures, so one call must take every sum of every table
// shown together. It does not keep a hidden figure from being narrowed to a
// range by the others, since no figure is below zero, and that range can shrink
// to a single value, zero especially, as when two hidden figures add up to a
// shown zero: a known limit, as the figures' values never enter here. A range
// over the wilayas, all of them and the middle half, shows only when at least 8
// wilayas pass the wilaya floor, and covers only those; otherwise only the
// national figure shows. A range never names or orders a wilaya, and is only
// for a measure never shown wilaya by wilaya, where a wilaya hidden to protect
// another could set its lowest or highest value.

/** Where a figure is shown: a directorate's own, or a wilaya's or the nation's. */
export type FloorScope = 'directorate' | 'wilaya' | 'national';

/** The least a figure must cover, by where it is shown. */
export const FLOORS: Readonly<Record<FloorScope, { readonly teachers: number; readonly schools: number }>> = {
  directorate: { teachers: 5, schools: 3 },
  wilaya: { teachers: 10, schools: 3 },
  national: { teachers: 10, schools: 3 },
};

/** How many wilayas must pass the wilaya floor before a range over them shows (answer 549). */
export const RANGE_WILAYAS = 8;

/** A figure, by what it covers. */
export interface FloorCell {
  readonly id: string;
  readonly scope: FloorScope;
  readonly teachers: number;
  readonly schools: number;
}

/** A total and the parts it adds up, by their IDs. */
export interface FloorSum {
  readonly total: string;
  readonly parts: readonly string[];
}

/** Whether a figure covers the teachers and schools its scope asks for. */
export function passesFloor(cell: Omit<FloorCell, 'id'>): boolean {
  const floor = FLOORS[cell.scope];
  return cell.teachers >= floor.teachers && cell.schools >= floor.schools;
}

/** Which comes first to be hidden: the fewest teachers, then the fewest schools, then the first ID. */
function smaller(one: FloorCell, other: FloorCell): number {
  return one.teachers - other.teachers || one.schools - other.schools || (one.id < other.id ? -1 : 1);
}

/** The greatest common divisor of two integers, at least 0. */
function divisorOf(one: bigint, other: bigint): bigint {
  const [high, low] = [one < 0n ? -one : one, other < 0n ? -other : other];
  return low === 0n ? high : divisorOf(low, high % low);
}

/** Divides a row by the greatest common divisor of its entries, so the integers stay small. */
function shortened(row: bigint[]): void {
  const divisor = row.reduce(divisorOf, 0n);
  if (divisor > 1n) for (const [index, entry] of row.entries()) row[index] = entry / divisor;
}

/** Brings the rows to reduced echelon form, each pivot's column zero in every other row, with integers only. */
function reduce(rows: bigint[][], width: number): void {
  let top = 0;
  for (let column = 0; column < width && top < rows.length; column += 1) {
    const found = rows.findIndex((row, index) => index >= top && row[column] !== 0n);
    if (found < 0) continue;
    [rows[top], rows[found]] = [rows[found]!, rows[top]!];
    const pivot = rows[top]!;
    for (const [index, row] of rows.entries()) {
      const factor = row[column]!;
      if (index === top || factor === 0n) continue;
      for (let at = 0; at < width; at += 1) row[at] = row[at]! * pivot[column]! - pivot[at]! * factor;
      shortened(row);
    }
    top += 1;
  }
}

type Sums = readonly (readonly FloorCell[])[];

/** The sums that hold a hidden figure, in groups that share no hidden figure, so each group is solved alone. */
function groups(sums: Sums, hidden: ReadonlySet<string>): Sums[] {
  const parent = sums.map((_, index) => index);
  const root = (index: number): number => (parent[index] === index ? index : (parent[index] = root(parent[index]!)));
  const first = new Map<string, number>();
  for (const [index, sum] of sums.entries())
    for (const cell of sum) {
      if (!hidden.has(cell.id)) continue;
      const other = first.get(cell.id);
      if (other === undefined) first.set(cell.id, index);
      else parent[root(index)] = root(other);
    }
  const byRoot = new Map<number, (readonly FloorCell[])[]>();
  for (const [index, sum] of sums.entries())
    if (sum.some((cell) => hidden.has(cell.id))) byRoot.set(root(index), [...(byRoot.get(root(index)) ?? []), sum]);
  return [...byRoot.values()];
}

/** The hidden figures of one group of sums that some combination of them works out exactly. */
function solved(sums: Sums, hidden: ReadonlySet<string>): string[] {
  const columns = [...new Set(sums.flat().map((cell) => cell.id))].filter((id) => hidden.has(id));
  const at = new Map(columns.map((id, index) => [id, index]));
  const rows = sums.map((sum) => {
    const row = columns.map(() => 0n);
    for (const [place, cell] of sum.entries()) {
      const index = at.get(cell.id);
      if (index !== undefined) row[index] = place === 0 ? 1n : -1n;
    }
    return row;
  });
  reduce(rows, columns.length);
  const alone = rows.filter((row) => row.filter((entry) => entry !== 0n).length === 1);
  return alone.map((row) => columns[row.findIndex((entry) => entry !== 0n)]!);
}

/** How many more hidden figures the sums work out once `id` is hidden too, among sums that hold all it can join. */
function changeAfter(local: Sums, hidden: ReadonlySet<string>, id: string): number {
  const more = new Set([...hidden, id]);
  const count = (set: ReadonlySet<string>) =>
    groups(local, set).reduce((total, group) => total + solved(group, set).length, 0);
  return count(more) - count(hidden);
}

/** Each sum's figures, its total first. Throws on two figures with one ID, or a sum with no parts or a bad name. */
function membersOf(cells: readonly FloorCell[], sums: readonly FloorSum[]): Sums {
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  if (byId.size !== cells.length) throw new RangeError('Two figures share an ID');
  return sums.map((sum) => {
    const ids = [sum.total, ...sum.parts];
    if (sum.parts.length === 0) throw new RangeError('A sum has no parts');
    if (new Set(ids).size !== ids.length) throw new RangeError('A sum names a figure twice');
    return ids.map((id) => {
      const cell = byId.get(id);
      if (cell === undefined) throw new RangeError(`A sum names a figure it was not given: ${id}`);
      return cell;
    });
  });
}

/**
 * The IDs of the figures to hide: each under its floor, unless it covers no school at all, and then, while a hidden
 * one can be worked out exactly from the sums, the smallest shown figure of a sum holding one whose hiding leaves fewer
 * worked out, or the smallest if none does, or, when those sums show none, of any sum of its group; a group whose
 * sums show nothing more is left as it is, since what its sums then fix follows from their shape alone, never from a
 * figure's value. Every sum of every table shown together goes in one call. Throws when two
 * figures share an ID, or a sum has no parts, names a figure twice or names one it was not given.
 */
export function hiddenCells(cells: readonly FloorCell[], sums: readonly FloorSum[]): ReadonlySet<string> {
  const members = membersOf(cells, sums);
  const empty = (cell: FloorCell) => cell.teachers === 0 && cell.schools === 0;
  const hidden = new Set(cells.filter((cell) => !empty(cell) && !passesFloor(cell)).map((cell) => cell.id));
  const indexOf = new Map(members.map((sum, index) => [sum, index]));
  const keyOf = (group: Sums) => group.map((sum) => indexOf.get(sum)).join();
  const sumsOf = new Map<string, (readonly FloorCell[])[]>();
  for (const sum of members) for (const cell of sum) sumsOf.set(cell.id, [...(sumsOf.get(cell.id) ?? []), sum]);
  const known = new Map<string, string[]>();
  const givenIn = (group: Sums) => {
    const inside = [...new Set(group.flat().map((cell) => cell.id))].filter((id) => hidden.has(id));
    const key = `${keyOf(group)}|${inside.join()}`;
    const found = known.get(key) ?? solved(group, hidden);
    known.set(key, found);
    return found;
  };
  const settled = new Set<string>();
  for (;;) {
    const all = groups(members, hidden);
    const open = all
      .filter((group) => !settled.has(keyOf(group)))
      .map((group) => ({ group, given: givenIn(group) }))
      .find((one) => one.given.length > 0);
    if (open === undefined) return hidden;
    const groupOf = new Map(all.flatMap((group) => group.map((sum) => [sum, group] as const)));
    const local = (cell: FloorCell) => [
      ...new Set([...open.group, ...(sumsOf.get(cell.id) ?? []).flatMap((sum) => groupOf.get(sum) ?? [sum])]),
    ];
    const shown = (among: Sums) => [...new Set(among.flat().filter((cell) => !hidden.has(cell.id)))];
    const holding = shown(open.group.filter((sum) => sum.some((cell) => open.given.includes(cell.id))));
    const candidates = (holding.length > 0 ? holding : shown(open.group)).sort(smaller);
    const next = candidates.find((cell) => changeAfter(local(cell), hidden, cell.id) < 0) ?? candidates[0];
    if (next === undefined) settled.add(keyOf(open.group));
    else hidden.add(next.id);
  }
}

/** A wilaya's figure, with what it covers. */
export interface WilayaFigure {
  readonly value: number;
  readonly teachers: number;
  readonly schools: number;
}

/** A range over the wilayas: the lowest and highest, and the middle half between the quartiles. */
export interface WilayaRange {
  readonly wilayas: number;
  readonly all: readonly [number, number];
  readonly middle: readonly [number, number];
}

/** The value `at` of the way through sorted values, between the two nearest, as a spreadsheet's QUARTILE.INC. */
function quantile(sorted: readonly number[], at: number): number {
  const place = (sorted.length - 1) * at;
  const below = Math.floor(place);
  const low = sorted[below]!;
  const high = sorted[Math.min(below + 1, sorted.length - 1)]!;
  return low + (high - low) * (place - below);
}

/** The range over the wilayas that pass the wilaya floor, or null when fewer than 8 do. */
export function wilayaRange(figures: readonly WilayaFigure[]): WilayaRange | null {
  const values = figures
    .filter((figure) => passesFloor({ scope: 'wilaya', teachers: figure.teachers, schools: figure.schools }))
    .map((figure) => figure.value);
  if (values.some((value) => !Number.isFinite(value))) throw new RangeError('A wilaya figure is not a number');
  if (values.length < RANGE_WILAYAS) return null;
  values.sort((one, other) => one - other);
  return {
    wilayas: values.length,
    all: [values[0]!, values[values.length - 1]!],
    middle: [quantile(values, 0.25), quantile(values, 0.75)],
  };
}
