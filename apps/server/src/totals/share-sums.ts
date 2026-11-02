// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The totals of an announced day, added up from the schools' shares (#596,
// answer 628), never one share's figures. Each directorate's figure for a
// subject adds the counts of every share of that directorate holding the
// subject, its teachers those of the shares' assignments and its schools the
// shares that hold it; a directorate's figure over every subject adds them up
// too, its items left out, its schools its shares; and the nation's adds every
// directorate's. A directorate asks for its own figures, under the directorate
// floor; the Ministry for every directorate's, as its wilaya's, under the
// wilaya floor, a demo world having one directorate in each wilaya, with the
// nation's. As anyone with a world's pass may ask for every view, the figures
// hidden are worked out once over all of them together: every directorate's
// figure under the directorate floor, the nation's under its own, and every
// figure that would let a hidden one be worked out by subtraction, across a
// directorate's subjects and over them, and across the directorates and the
// nation, through the core's floors (floors.ts, a copy of the core's); the
// Ministry's view then hides, as well, every directorate's figure under the
// wilaya floor, which a directorate's own view shows anyway. A hidden figure is
// null. The figures are added up in maps, so no name a share holds can reach
// an object's own properties.

import { hiddenCells, passesFloor, type FloorCell, type FloorScope, type FloorSum } from './floors.js';
import type { ItemShare, Share, SubjectShare } from './share-read.js';

const COUNTS = ['vacantPosts', 'hoursWithoutTeacher', 'classes', 'cover', 'closed', 'reached', 'runLong'] as const;
type Count = (typeof COUNTS)[number];

/** A figure: what it covers, its counts, and by plan item what the classes did, for a subject. */
export type Total = { teachers: number; schools: number } & Record<Count, number> & {
    items?: Record<string, ItemShare>;
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

function addItems(to: Map<string, ItemShare>, items: Readonly<Record<string, ItemShare>>): void {
  for (const [item, one] of Object.entries(items)) {
    const held = to.get(item) ?? { sessions: 0, merged: 0, skipped: 0, retaught: 0 };
    to.set(item, {
      sessions: held.sessions + one.sessions,
      merged: held.merged + one.merged,
      skipped: held.skipped + one.skipped,
      retaught: held.retaught + one.retaught,
    });
  }
}

/** A figure being added up: its counts and, for a subject, its items. */
class Adding {
  readonly total = empty();
  readonly items = new Map<string, ItemShare>();

  add(one: SubjectShare | Total, schools: number): void {
    this.total.teachers += one.teachers;
    this.total.schools += schools;
    for (const count of COUNTS) this.total[count] += one[count];
  }

  done(items: boolean): Total {
    const sorted = [...this.items].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return items ? { ...this.total, items: Object.fromEntries(sorted) } : { ...this.total };
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

/** The day's totals: one directorate's under its floor, or every directorate's and the nation's for the Ministry. */
export function dayTotals(day: string, shares: readonly Share[], directorate: string | null): DayTotals {
  const subjects = [...new Set(shares.flatMap((share) => Object.keys(share.subjects)))].sort();
  const ids = [...new Set(shares.map((share) => share.directorate))].sort();
  const by = new Map(ids.map((id) => [id, new Map(subjects.map((subject) => [subject, new Adding()]))]));
  const over = new Map(ids.map((id) => [id, new Adding()]));
  for (const share of shares) {
    for (const [subject, one] of Object.entries(share.subjects)) {
      const figure = by.get(share.directorate)!.get(subject)!;
      figure.add(one, 1);
      addItems(figure.items, one.items);
      over.get(share.directorate)!.add(one, 0);
    }
    over.get(share.directorate)!.total.schools += 1;
  }
  const nation = new Map(subjects.map((subject) => [subject, new Adding()]));
  const whole = new Adding();
  for (const id of ids) {
    for (const subject of subjects) {
      const figure = by.get(id)!.get(subject)!;
      nation.get(subject)!.add(figure.total, figure.total.schools);
      addItems(nation.get(subject)!.items, Object.fromEntries(figure.items));
    }
    whole.add(over.get(id)!.total, over.get(id)!.total.schools);
  }
  const cells: FloorCell[] = [];
  const sums: FloorSum[] = [];
  const key = (id: string, subject: string | null) => JSON.stringify([id, subject]);
  for (const id of ids) {
    for (const subject of subjects) cells.push(cell(key(id, subject), 'directorate', by.get(id)!.get(subject)!));
    cells.push(cell(key(id, null), 'directorate', over.get(id)!));
    if (subjects.length > 0) sums.push({ total: key(id, null), parts: subjects.map((subject) => key(id, subject)) });
  }
  for (const subject of subjects) cells.push(cell(key('', subject), 'national', nation.get(subject)!));
  cells.push(cell(key('', null), 'national', whole));
  for (const subject of subjects) sums.push({ total: key('', subject), parts: ids.map((id) => key(id, subject)) });
  if (ids.length > 0) sums.push({ total: key('', null), parts: ids.map((id) => key(id, null)) });
  if (subjects.length > 0) sums.push({ total: key('', null), parts: subjects.map((subject) => key('', subject)) });
  const hidden = hiddenCells(cells, sums);
  const scope: FloorScope = directorate === null ? 'wilaya' : 'directorate';
  const shown = (id: string, subject: string | null, adding: Adding) => {
    const figure = adding.done(subject !== null);
    return hidden.has(key(id, subject)) || !passes(figure, id === '' ? 'national' : scope) ? null : figure;
  };
  const row = (id: string, held: readonly string[]) => ({
    id,
    subjects: Object.fromEntries(held.map((subject) => [subject, shown(id, subject, by.get(id)!.get(subject)!)])),
    all: shown(id, null, over.get(id)!),
  });
  if (directorate !== null) {
    if (!by.has(directorate)) return { day, directorates: [{ id: directorate, subjects: {}, all: empty() }] };
    const held = subjects.filter((subject) => by.get(directorate)!.get(subject)!.total.schools > 0);
    return { day, directorates: [row(directorate, held)] };
  }
  const national = {
    subjects: Object.fromEntries(subjects.map((subject) => [subject, shown('', subject, nation.get(subject)!)])),
    all: shown('', null, whole),
  };
  return { day, directorates: ids.map((id) => row(id, subjects)), national };
}
