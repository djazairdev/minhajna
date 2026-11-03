// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The totals of an announced day, added up from the schools' shares (#596,
// answer 628), never one share's figures. Each directorate's figure for a
// subject adds the counts of every share of that directorate holding the
// subject, its teachers those of the shares' assignments and its schools the
// shares that hold it, and by plan item what the classes did, with how many
// schools did it; a directorate's figure over every subject adds the counts
// too, its schools its shares and its teachers, at least, each share's largest
// subject, since one teacher may teach several subjects; and the nation's adds
// every directorate's. A directorate asks for its own figures, under the
// directorate floor, of the subjects it holds; the Ministry for every
// directorate's, as its wilaya's, under the wilaya floor, a demo world having
// one directorate in each wilaya, of every subject, with the nation's. As
// anyone with a world's pass may ask for every view, the figures hidden are
// worked out once over all of them together: every directorate's figure under
// the directorate floor, the nation's under its own, and every figure that
// would let a hidden one be worked out by subtraction, across a directorate's
// subjects and over them, and across the directorates and the nation, through
// the core's floors (floors.ts, a copy of the core's); the Ministry's view then
// hides, as well, every directorate's figure under the wilaya floor, which a
// directorate's own view shows anyway. A plan item is hidden within a figure
// shown when fewer schools than the floor's did it, and so is another, the
// fewest schools' first, when one alone of the nation's and the directorates'
// would be hidden. A subject's figure shown gives, when the shares give them,
// how far each grade's classes got, hidden under the floors as well, each
// subject's grades checked against the figures as their check left them, which
// runs again whenever the grades hide a figure (share-reach.ts). A hidden
// figure or item is null. The floors keep one day's answer from showing one
// school's figures; two announced days' answers may still differ by one
// school's, as when its first share comes in, a known limit. The figures are
// added up in maps, so no name a share holds can reach an object's own
// properties.

import { FLOORS, hiddenCells, passesFloor, type FloorCell, type FloorScope, type FloorSum } from './floors.js';
import type { ItemShare, Share, SubjectShare } from './share-read.js';
import { HIDDEN, sumReach, type GradeTotal, type SummedReach } from './share-reach.js';

const COUNTS = ['vacantPosts', 'hoursWithoutTeacher', 'classes', 'cover', 'closed', 'reached', 'runLong'] as const;
type Count = (typeof COUNTS)[number];

/**
 * A figure: what it covers, its counts, and for a subject by plan item what the classes did and, when the shares
 * give them, by grade how far its classes got; null when hidden.
 */
export type Total = { teachers: number; schools: number } & Record<Count, number> & {
    items?: Record<string, ItemShare | null>;
    grades?: Record<string, GradeTotal | null>;
  };

export interface DirectorateTotals {
  readonly id: string;
  /** By subject; null when hidden. */
  readonly subjects: Record<string, Total | null>;
  /** Over every subject; null when hidden. */
  readonly all: Total | null;
}

export interface DayTotals {
  readonly day: string;
  readonly directorates: DirectorateTotals[];
  /** The nation's, for the Ministry only. */
  readonly national?: { readonly subjects: Record<string, Total | null>; readonly all: Total | null };
}

const empty = (): Total => ({
  teachers: 0,
  schools: 0,
  ...(Object.fromEntries(COUNTS.map((count) => [count, 0])) as Record<Count, number>),
});

const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** A figure being added up: its counts and, for a subject, its items with how many schools did each. */
class Adding {
  readonly total = empty();
  readonly items = new Map<string, ItemShare>();
  readonly schoolsOf = new Map<string, number>();

  add(one: SubjectShare | Total, schools: number, teachers = one.teachers): void {
    this.total.teachers += teachers;
    this.total.schools += schools;
    for (const count of COUNTS) this.total[count] += one[count];
  }

  addItem(item: string, one: ItemShare, schools: number): void {
    const held = this.items.get(item) ?? { sessions: 0, merged: 0, skipped: 0, retaught: 0 };
    this.items.set(item, {
      sessions: held.sessions + one.sessions,
      merged: held.merged + one.merged,
      skipped: held.skipped + one.skipped,
      retaught: held.retaught + one.retaught,
    });
    this.schoolsOf.set(item, (this.schoolsOf.get(item) ?? 0) + schools);
  }

  /** The figure, with its items, each null when `hidden` says so, unless `hidden` is null. */
  done(hidden: ((item: string) => boolean) | null): Total {
    if (hidden === null) return { ...this.total };
    const items = [...this.items].sort(([a], [b]) => byName(a, b));
    return { ...this.total, items: Object.fromEntries(items.map(([item, one]) => [item, hidden(item) ? null : one])) };
  }
}

const cell = (id: string, scope: FloorScope, figure: Adding): FloorCell => ({
  id,
  scope,
  teachers: figure.total.teachers,
  schools: figure.total.schools,
});

/** Whether a figure shows under the floor of where it is shown: covering no school at all, or enough. */
const passes = (figure: Total, scope: FloorScope) =>
  (figure.teachers === 0 && figure.schools === 0) || passesFloor({ scope, ...figure });

/**
 * What the floors hide of the figures and the grades: the figures' check, then each subject's grades' against the
 * figures as it left them, the figures' check run again whenever a subject's grades hide one of its figures.
 */
function hiddenWithGrades(
  cells: readonly FloorCell[],
  sums: readonly FloorSum[],
  reach: SummedReach,
  figuresOf: (subject: string) => string[],
): ReadonlySet<string> {
  const byId = new Map(cells.map((one) => [one.id, one]));
  const forced = new Set<string>();
  for (;;) {
    const hidden = hiddenCells(
      cells.map((one) => (forced.has(one.id) ? { ...one, ...HIDDEN } : one)),
      sums,
    );
    const all = new Set(hidden);
    for (const subject of reach.subjects) {
      const figures = figuresOf(subject).map((id) => byId.get(id)!);
      for (const id of reach.hiddenFor(subject, figures, hidden)) all.add(id);
    }
    const newly = [...all].filter((id) => byId.has(id) && !hidden.has(id));
    if (newly.length === 0) return all;
    for (const id of newly) forced.add(id);
  }
}

/** A day's shares added up, with what is hidden in every view, to answer each view. */
export interface SummedShares {
  view(directorate: string | null): DayTotals;
}

/** Adds up a day's shares and works out, once for every view, what is hidden. */
export function sumShares(day: string, shares: readonly Share[]): SummedShares {
  const subjects = [...new Set(shares.flatMap((share) => Object.keys(share.subjects)))].sort(byName);
  const ids = [...new Set(shares.map((share) => share.directorate))].sort(byName);
  const by = new Map(ids.map((id) => [id, new Map(subjects.map((subject) => [subject, new Adding()]))]));
  const over = new Map(ids.map((id) => [id, new Adding()]));
  for (const share of shares) {
    let most = 0;
    for (const [subject, one] of Object.entries(share.subjects)) {
      const figure = by.get(share.directorate)!.get(subject)!;
      figure.add(one, 1);
      for (const [item, done] of Object.entries(one.items)) figure.addItem(item, done, 1);
      over.get(share.directorate)!.add(one, 0, 0);
      most = Math.max(most, one.teachers);
    }
    over.get(share.directorate)!.add(empty(), 1, most);
  }
  const nation = new Map(subjects.map((subject) => [subject, new Adding()]));
  const whole = new Adding();
  for (const id of ids) {
    for (const subject of subjects) {
      const figure = by.get(id)!.get(subject)!;
      nation.get(subject)!.add(figure.total, figure.total.schools);
      for (const [item, done] of figure.items) nation.get(subject)!.addItem(item, done, figure.schoolsOf.get(item)!);
    }
    whole.add(over.get(id)!.total, over.get(id)!.total.schools);
  }
  const figureOf = (id: string, subject: string | null) =>
    id === ''
      ? subject === null
        ? whole
        : nation.get(subject)!
      : subject === null
        ? over.get(id)!
        : by.get(id)!.get(subject)!;
  const cells: FloorCell[] = [];
  const sums: FloorSum[] = [];
  const key = (id: string, subject: string | null) => JSON.stringify([id, subject]);
  for (const id of ['', ...ids]) {
    const scope = id === '' ? 'national' : 'directorate';
    for (const subject of [...subjects, null]) cells.push(cell(key(id, subject), scope, figureOf(id, subject)));
    if (subjects.length > 0) sums.push({ total: key(id, null), parts: subjects.map((subject) => key(id, subject)) });
  }
  for (const subject of [...subjects, null]) {
    if (ids.length > 0) sums.push({ total: key('', subject), parts: ids.map((id) => key(id, subject)) });
  }
  const reach = sumReach(shares, key);
  const hidden = hiddenWithGrades(cells, sums, reach, (subject) => ['', ...ids].map((id) => key(id, subject)));
  const hiddenItems = new Map<string, Set<string>>();
  for (const subject of subjects) {
    const holding = new Map<string, string[]>();
    for (const id of ids) {
      for (const item of by.get(id)!.get(subject)!.items.keys()) holding.set(item, [...(holding.get(item) ?? []), id]);
    }
    for (const [item, holders] of holding) {
      const schools = (id: string) => figureOf(id, subject).schoolsOf.get(item)!;
      const floor = (id: string) => FLOORS[id === '' ? 'national' : 'directorate'].schools;
      const all = ['', ...holders];
      const under = all.filter((id) => hidden.has(key(id, subject)) || schools(id) < floor(id));
      if (under.length === 1) {
        const others = all.filter((id) => id !== under[0]).sort((a, b) => schools(a) - schools(b) || byName(a, b));
        if (others.length > 0) under.push(others[0]!);
      }
      for (const id of under) {
        const cellKey = key(id, subject);
        hiddenItems.set(cellKey, (hiddenItems.get(cellKey) ?? new Set()).add(item));
      }
    }
  }
  const shown = (id: string, subject: string | null, scope: FloorScope) => {
    const under = hiddenItems.get(key(id, subject));
    const figure = figureOf(id, subject).done(subject === null ? null : (item) => under?.has(item) === true);
    const grades = subject === null ? undefined : reach.grades(id, subject, scope, hidden);
    if (hidden.has(key(id, subject)) || !passes(figure, scope)) return null;
    return grades === undefined ? figure : { ...figure, grades };
  };
  const row = (id: string, held: readonly string[], scope: FloorScope) => ({
    id,
    subjects: Object.fromEntries(held.map((subject) => [subject, shown(id, subject, scope)])),
    all: shown(id, null, scope),
  });
  return {
    view(directorate) {
      if (directorate === null) {
        const { subjects: bySubject, all } = row('', subjects, 'national');
        const directorates = ids.map((id) => row(id, subjects, 'wilaya'));
        return { day, directorates, national: { subjects: bySubject, all } };
      }
      if (!by.has(directorate)) return { day, directorates: [{ id: directorate, subjects: {}, all: empty() }] };
      const held = subjects.filter((subject) => by.get(directorate)!.get(subject)!.total.schools > 0);
      return { day, directorates: [row(directorate, held, 'directorate')] };
    },
  };
}

/** One view of a day's totals: a directorate's own, or, for null, the Ministry's. */
export const dayTotals = (day: string, shares: readonly Share[], directorate: string | null): DayTotals =>
  sumShares(day, shares).view(directorate);
