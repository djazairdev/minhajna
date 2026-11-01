// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Exchange's map of what the school exchanges (#592, answer 620), laid out as
// the design draws it, the interoperability system a box where the design draws
// a band: the teachers' devices, with the school's teacher count, and beside
// them the private notes, with no line from them; under the devices the
// school's space, an inspector with a grant on one side and the directorate and
// the Ministry on the other; under it the national interoperability system,
// then the sector's system, then the parents' space. Every line goes into or
// out of the school's space through the boxes the design names: the signed
// weeks from the devices and the lists and timetable back, the grant's classes
// to an inspector, the totals' shares to the directorate, the marks, and the
// absences when the school chooses, through the interoperability system to the
// sector's system, the lists and assignments back the same way, and what the
// state publishes in the parents' space. A line on a condition, the grant or
// the school's choice, is dashed and labelled with it; absences not sent stay
// on the map, faint and struck through. Left to right, the boxes and the lines
// between the same two boxes are mirrored. The lines between the school and
// outside are counted, absences only when sent. The same boxes and lines are
// written out in two groups, which a screen reader reads and the phone shows
// alone, each with its facts for the panel of the one chosen in labelled rows
// and a note; the marks' last row is the stand-in's latest receipt, or that
// none is received yet.

import type { TFunction } from 'i18next';
import type { MapLink, MapNode, MapSpec } from '../drawing/drawing-kit';

export const BOXES = ['devices', 'notes', 'inspector', 'space', 'directorate', 'interop', 'sector', 'parents'] as const;
export const LINES = ['weeks', 'lists', 'grant', 'totals', 'marks', 'absences', 'roster', 'publish'] as const;
export type ExchangeId = (typeof BOXES)[number] | (typeof LINES)[number];

/** A box or a line as the page writes it out, with what the panel says of it. */
export interface ExchangeItem {
  readonly id: ExchangeId;
  readonly label: string;
  /** A box's line under its name. */
  readonly sub?: string;
  readonly rows: readonly { readonly label: string; readonly value: string }[];
  readonly note: string;
}

/** The map, and its boxes and lines written out. */
export interface ExchangeMap {
  readonly spec: MapSpec;
  /** How many lines pass between the school and outside. */
  readonly crossing: number;
  readonly boxes: readonly ExchangeItem[];
  readonly lines: readonly ExchangeItem[];
}

/** What the map is drawn from: the school's teacher count, the absences choice and the stand-in's last receipt. */
export interface ExchangeFacts {
  readonly teachers: number;
  readonly absences: boolean;
  /** The last marks received, written out, or null when none is. */
  readonly received: { readonly term: string; readonly class: string; readonly day: string } | null;
}

const WIDTH = 708;
const BOX = 170;
/** Where the design sets each box, right to left. */
const PLACES: Readonly<Record<(typeof BOXES)[number], readonly [number, number]>> = {
  notes: [31, 24],
  devices: [269, 24],
  inspector: [13, 170],
  space: [269, 170],
  directorate: [525, 170],
  interop: [269, 320],
  sector: [269, 470],
  parents: [269, 620],
};
/** Each item's labelled rows in the catalogue. */
const ROWS: Readonly<Record<ExchangeId | 'absencesOff', readonly ('a' | 'b' | 'c')[]>> = {
  devices: ['a', 'b', 'c'],
  notes: ['a', 'b'],
  inspector: ['a', 'b', 'c'],
  space: ['a', 'b', 'c'],
  directorate: ['a', 'b'],
  interop: ['a', 'b'],
  sector: ['a', 'b', 'c'],
  parents: ['a', 'b'],
  weeks: ['a', 'b', 'c'],
  lists: ['a', 'b'],
  grant: ['a', 'b'],
  totals: ['a', 'b', 'c'],
  marks: ['a', 'b', 'c'],
  absences: ['a', 'b', 'c'],
  absencesOff: ['a', 'b'],
  roster: ['a', 'b'],
  publish: ['a', 'b'],
};
/** The lines between the school and outside, absences aside. */
const CROSSING: readonly (typeof LINES)[number][] = ['grant', 'totals', 'marks', 'roster'];
/** The rows worded otherwise while absences are not sent. */
const OFF = new Set(['interop.b', 'sector.b', 'sector.c', 'parents.b', 'publish.b']);

/** The catalogue's words by keys made up from the ids, which the typed keys cannot follow. */
type Words = (key: string, options?: Readonly<Record<string, unknown>>) => string;

/** D-Exchange's map, in the screen's words and direction. */
export function exchangeMap(t: TFunction, facts: ExchangeFacts, rightToLeft: boolean): ExchangeMap {
  const word = t as unknown as Words;
  const on = facts.absences;
  const value = (id: ExchangeId | 'absencesOff', row: string) => {
    const key = `demo.exchange.facts.${id}.${row}`;
    if (id === 'marks' && row === 'c')
      return facts.received === null ? word(`${key}.vOff`) : word(`${key}.v`, facts.received);
    return word(`${key}.${!on && OFF.has(`${id}.${row}`) ? 'vOff' : 'v'}`);
  };
  const item = (id: ExchangeId, label: string, sub?: string): ExchangeItem => {
    const source = id === 'absences' && !on ? 'absencesOff' : id;
    const rows = ROWS[source].map((row) => ({
      label: word(`demo.exchange.facts.${source}.${row}.k`),
      value: value(source, row),
    }));
    return { id, label, ...(sub === undefined ? {} : { sub }), rows, note: word(`demo.exchange.facts.${source}.note`) };
  };
  const teachers = t('demo.exchange.teachers', { count: facts.teachers });
  const boxes = BOXES.map((id) =>
    item(id, t(`demo.exchange.box.${id}`), t(`demo.exchange.sub.${id}`, id === 'devices' ? { teachers } : {})),
  );
  const line = (id: (typeof LINES)[number]) =>
    id === 'publish' && !on ? t('demo.exchange.line.publishOff') : t(`demo.exchange.line.${id}`);
  const written = (id: (typeof LINES)[number]) =>
    id === 'grant'
      ? t('demo.exchange.onGrant', { line: line(id) })
      : id === 'absences'
        ? t(on ? 'demo.exchange.onChoice' : 'demo.exchange.notSent', { line: line(id) })
        : line(id);
  const lines = LINES.map((id) => item(id, written(id)));
  const nodes: MapNode[] = BOXES.map((id) => {
    const [x, y] = PLACES[id];
    return { id, label: t(`demo.exchange.box.${id}`), x: rightToLeft ? x : WIDTH - BOX - x, y };
  });
  const absences = (from: string, to: string): MapLink =>
    on
      ? { from, to, label: written('absences'), conditional: true }
      : { from, to, label: line('absences'), conditional: true, idle: true };
  const lanes = (from: string, to: string): MapLink[] => {
    const trio = [
      { from, to, label: line('marks') },
      absences(from, to),
      { from: to, to: from, label: line('roster') },
    ];
    return rightToLeft ? trio : trio.reverse();
  };
  const pair: MapLink[] = [
    { from: 'devices', to: 'space', label: line('weeks') },
    { from: 'space', to: 'devices', label: line('lists') },
  ];
  const links: MapLink[] = [
    ...(rightToLeft ? pair : pair.reverse()),
    { from: 'space', to: 'inspector', label: written('grant'), conditional: true },
    { from: 'space', to: 'directorate', label: line('totals') },
    ...lanes('space', 'interop'),
    ...lanes('interop', 'sector'),
    { from: 'sector', to: 'parents', label: line('publish') },
  ];
  return {
    spec: { label: t('demo.exchange.map'), nodes, links },
    crossing: CROSSING.length + (on ? 1 : 0),
    boxes,
    lines,
  };
}
