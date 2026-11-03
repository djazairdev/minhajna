// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where a school exam's cut stands, from its room's records (#601, answers 33
// and 632, exam-room.ts): each setter's cut signed by the signing deadline with
// the highest version counts, the lower text breaking a tie, so an older cut
// put again never wins, an item or none for no cut; the cut is settled when
// every setter the chart names has signed an item, the earliest of them in the
// pack's order applying, so no class is examined on what it did not reach; a
// setter's no cut, or the deadline passing unsettled, leaves the decision to
// the director, whose first decision once it falls to them is final. The cut
// proposed is the earliest item the setters' cuts name, with the setter whose
// cut has named it the longest and the day they first did; each setter's cut
// that counts is given with its day. A cut's day is its setter's own word, so a
// cut signed past the deadline but dated on it counts until the director
// decides, a known limit that the director's final decision bounds. A cut is
// optional: with no record the paper is set as today.

import { compareDays, type Day } from './day.ts';
import type { ExamChart } from './exam-chart.ts';
import type { ExamCut, RoomRecords } from './exam-room.ts';

/** Where the cut stands. */
export interface CutState {
  /** Each setter's latest cut by the deadline, by assignment: an item, or null for no cut. */
  readonly signed: ReadonlyMap<string, string | null>;
  /** Each setter's latest cut's day, by assignment, as its setter dated it. */
  readonly days: ReadonlyMap<string, Day>;
  /** The earliest item proposed, with the setter who first signed it and the day they first did, or null. */
  readonly proposed: { readonly item: string; readonly by: string; readonly day: Day } | null;
  /** The cut that applies, or null for no cut, with who settled it; null while unsettled. */
  readonly settled: { readonly item: string | null; readonly by: 'setters' | 'director' } | null;
  /** Whether the decision has fallen to the director. */
  readonly director: boolean;
}

/** A setter's cut that counts, the highest version, the lower text breaking a tie, and since when it names it. */
type Held = {
  readonly item: string | null;
  readonly version: number;
  readonly text: string;
  readonly day: Day;
  readonly since: number;
  readonly first: Day;
};

/** Where the cut stands on `today`, from the room's records. */
export function cutState(records: RoomRecords, today: Day): CutState | null {
  const { chart } = records;
  if (chart === null) return null;
  const chartOf = chart.value;
  const setterOf = new Map(chartOf.setters.map((one) => [one.key, one.assignment]));
  const held = new Map<string, Held>();
  const signed = () => new Map([...held].map(([setter, one]) => [setter, one.item]));
  const due = (day: Day) => compareDays(day, chartOf.signBy) > 0 || [...held.values()].some((one) => one.item === null);
  for (const [at, { kind, record }] of records.cuts.entries()) {
    const cut: ExamCut = record.value;
    if (kind === 'decision') {
      if (due(cut.day) && settledBy(chartOf, signed()) === undefined) {
        const settled = { item: cut.item, by: 'director' } as const;
        return { ...standing(chartOf, held), settled, director: true };
      }
      continue;
    }
    const setter = setterOf.get(record.certificate.publicKey);
    if (setter === undefined || compareDays(cut.day, chartOf.signBy) > 0) continue;
    const before = held.get(setter);
    const newer =
      cut.version > (before?.version ?? -1) || (cut.version === before?.version && record.text < before.text);
    if (!newer) continue;
    const kept = before !== undefined && before.item === cut.item;
    const [since, first] = kept ? [before.since, before.first] : [at, cut.day];
    held.set(setter, { item: cut.item, version: cut.version, text: record.text, day: cut.day, since, first });
  }
  const settled = settledBy(chartOf, signed());
  return {
    ...standing(chartOf, held),
    settled: settled === undefined ? null : { item: settled, by: 'setters' },
    director: settled === undefined && due(today),
  };
}

/** The earliest item every setter's cut covers once each has signed one, or undefined. */
function settledBy(chart: ExamChart, signed: ReadonlyMap<string, string | null>): string | undefined {
  const cuts = chart.setters.map((one) => signed.get(one.assignment));
  if (cuts.length === 0 || cuts.some((one) => one === undefined || one === null)) return undefined;
  return earliest(chart, cuts as string[]);
}

function earliest(chart: ExamChart, items: readonly string[]): string | undefined {
  const order = new Map(chart.items.map((item, at) => [item, at]));
  return [...items].sort((a, b) => order.get(a)! - order.get(b)!)[0];
}

/** The setters' cuts and days, and the earliest item proposed, by whoever has named it the longest, and since when. */
function standing(chart: ExamChart, held: ReadonlyMap<string, Held>) {
  const signed = new Map([...held].map(([setter, one]) => [setter, one.item]));
  const days = new Map([...held].map(([setter, one]) => [setter, one.day]));
  const item = earliest(
    chart,
    [...signed.values()].filter((one): one is string => one !== null),
  );
  if (item === undefined) return { signed, days, proposed: null };
  const [by, { first }] = [...held]
    .filter(([, one]) => one.item === item)
    .sort(([, a], [, b]) => a.since - b.since)[0]!;
  return { signed, days, proposed: { item, by, day: first } };
}
