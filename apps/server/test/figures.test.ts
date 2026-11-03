// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The observatory's figures (#626, answer 678): shares in bands, never exact;
// for each pack and release of a term, the nation's figure and each wilaya's,
// with classes, teachers, schools, the median and quartiles of how far classes
// got, and by item its classes, the median of its sessions and its shares in
// bands; a figure under 10 teachers or 3 schools hidden, and another with it
// when the nation's would reveal it by subtraction; an item hidden under the
// floors, with its figure, and by subtraction; other terms and years left out,
// and packs and releases never added together. Every sending here is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bandOf, termFigures, type Figure } from '../src/insights/figures.js';
import type { KeptSending } from '../src/insights/sending-read.js';
import { keptOf, madeUpSending } from './insights-kit.js';

let made = 0;

/** Sendings of `teachers` teachers spread over `schools` schools in a wilaya, each with `change`. */
function classes(wilaya: string, teachers: number, schools: number, change: Partial<KeptSending> = {}): KeptSending[] {
  return Array.from({ length: teachers }, (_, at) => {
    made += 1;
    return { ...keptOf(madeUpSending(made, made), `${'0'.repeat(16)}.${wilaya}${at % schools}`), wilaya, ...change };
  });
}

const shown = (figure: Figure | null | undefined): Figure => {
  assert.ok(figure);
  return figure;
};

describe('the observatory’s figures', () => {
  it('bands every share, near 0% and 100% too', () => {
    assert.deepEqual(bandOf(0, 20), [0, 5]);
    assert.deepEqual(bandOf(1, 20), [5, 15]);
    assert.deepEqual(bandOf(3, 20), [15, 30]);
    assert.deepEqual(bandOf(10, 20), [50, 70]);
    assert.deepEqual(bandOf(19, 20), [95, 100]);
    assert.deepEqual(bandOf(20, 20), [95, 100]);
    assert.deepEqual(bandOf(0, 0), [0, 5]);
  });

  it('gives the nation’s and each wilaya’s figure, with medians, quartiles and banded shares', () => {
    const sendings = [
      ...classes('16', 6, 3, { reached: 200 }),
      ...classes('16', 6, 3, { reached: 400 }),
      ...classes('31', 12, 4, { reached: 300 }),
    ];
    const [figures] = termFigures(sendings, '2027-2028', 1);
    assert.ok(figures);
    assert.deepEqual(
      [figures.grade, figures.subject, figures.pack, figures.release],
      ['4am', 'arabic', 'dz.cem.4am.arabic.made-up', '2027.1'],
    );
    const nation = shown(figures.nation);
    assert.deepEqual([nation.classes, nation.teachers, nation.schools], [24, 24, 7]);
    assert.deepEqual(nation.reached, { median: 300, low: 275, high: 325 });
    assert.deepEqual(shown(figures.wilayas['16']).reached, { median: 300, low: 200, high: 400 });
    assert.deepEqual(nation.items['s1-w2'], {
      classes: 24,
      sessions: 6,
      merged: [0, 5],
      skipped: [0, 5],
      split: [0, 5],
      retaught: [95, 100],
    });
    assert.deepEqual(nation.items['s1-w4'], {
      ...nation.items['s1-w2'],
      sessions: 0,
      split: [95, 100],
      retaught: [0, 5],
    });
    assert.equal(shown(figures.wilayas['31']).schools, 4);
  });

  it('hides a figure under the floors, and another the nation’s would reveal by subtraction', () => {
    const two = termFigures([...classes('16', 12, 3), ...classes('31', 9, 3)], '2027-2028', 1)[0]!;
    assert.equal(two.wilayas['31'], null);
    assert.equal(two.wilayas['16'], null);
    assert.equal(shown(two.nation).teachers, 21);
    const three = termFigures(
      [...classes('16', 12, 3), ...classes('31', 12, 2), ...classes('48', 14, 3)],
      '2027-2028',
      1,
    );
    const figures = three[0]!;
    assert.equal(figures.wilayas['31'], null);
    assert.equal(figures.wilayas['16'], null);
    assert.equal(shown(figures.wilayas['48']).teachers, 14);
    assert.equal(termFigures(classes('16', 9, 3), '2027-2028', 1)[0]!.nation, null);
  });

  it('hides an item under the floors and by subtraction, and every item of a hidden figure', () => {
    const rare = { sessions: { 's1-w1': 5, 's1-w9': 2 } };
    const sendings = [
      ...classes('16', 12, 3),
      ...classes('31', 12, 3),
      ...classes('16', 2, 1, { ...rare, changed: { merged: [], skipped: [], split: [], retaught: [] } }),
    ];
    const figures = termFigures(sendings, '2027-2028', 1)[0]!;
    assert.equal(shown(figures.nation).items['s1-w9'], null);
    assert.equal(shown(figures.wilayas['16']).items['s1-w9'], null);
    assert.equal(shown(figures.wilayas['16']).items['s1-w1']?.classes, 14);
    assert.equal(Object.hasOwn(shown(figures.wilayas['31']).items, 's1-w9'), false);
  });

  it('leaves other terms and years out, and never adds packs or releases together', () => {
    const sendings = [
      ...classes('16', 12, 3),
      ...classes('16', 12, 3, { release: '2027.2' }),
      ...classes('16', 12, 3, { term: 2 }),
      ...classes('16', 12, 3, { year: '2028-2029' }),
    ];
    const figures = termFigures(sendings, '2027-2028', 1);
    assert.deepEqual(
      figures.map((one) => [one.release, shown(one.nation).classes]),
      [
        ['2027.1', 12],
        ['2027.2', 12],
      ],
    );
    assert.deepEqual(termFigures(sendings, '2026-2027', 1), []);
  });
});
