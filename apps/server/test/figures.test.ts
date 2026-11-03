// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The observatory's figures (#626, answer 678): for each pack and release of a
// term, in order, the nation's figure and each shown wilaya's, with classes,
// teachers, schools, the median and quartiles of how far classes got, and by
// item its classes, the median of the sessions logged on it, only when the
// classes that logged any cover the floor, and its shares in bands; a figure
// under 10 teachers or 3 schools hidden, and another with it when the nation's
// would reveal it by subtraction, a hidden wilaya left out; an item hidden
// under the floors and by subtraction within figures shown, two wilayas under
// the floor kept in an item's sum; every figure listing the same items, at most
// 512, those of the most classes, null where hidden or not held; other terms
// and years left out, and grades, subjects, packs and releases never added
// together. Every sending here is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { termFigures, type Figure } from '../src/insights/figures.js';
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
    assert.deepEqual(Object.keys(figures.wilayas), ['16', '31']);
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
      sessions: null,
      split: [95, 100],
      retaught: [0, 5],
    });
    assert.equal(shown(figures.wilayas['31']).schools, 4);
  });

  it('hides a figure under the floors, and another the nation’s would reveal by subtraction', () => {
    const two = termFigures([...classes('16', 12, 3), ...classes('31', 9, 3)], '2027-2028', 1)[0]!;
    assert.deepEqual(two.wilayas, {});
    assert.equal(shown(two.nation).teachers, 21);
    const three = termFigures(
      [...classes('16', 12, 3), ...classes('31', 12, 2), ...classes('48', 14, 3)],
      '2027-2028',
      1,
    );
    const figures = three[0]!;
    assert.deepEqual(Object.keys(figures.wilayas), ['48']);
    assert.equal(shown(figures.wilayas['48']).teachers, 14);
    assert.equal(termFigures(classes('16', 9, 3), '2027-2028', 1)[0]!.nation, null);
  });

  it('hides an item under the floors and by subtraction, and every item of a hidden figure', () => {
    const rare = {
      sessions: { 's1-w1': 5, 's1-w9': 2 },
      changed: { merged: [], skipped: [], split: [], retaught: [] },
    };
    const sendings = [...classes('16', 12, 3), ...classes('31', 12, 3), ...classes('16', 2, 1, rare)];
    const figures = termFigures(sendings, '2027-2028', 1)[0]!;
    for (const figure of [figures.nation, figures.wilayas['16'], figures.wilayas['31']]) {
      assert.deepEqual(Object.keys(shown(figure).items), ['s1-w1', 's1-w2', 's1-w3', 's1-w4']);
    }
    assert.equal(shown(figures.wilayas['16']).items['s1-w1']?.classes, 14);
    const most = termFigures(
      [...classes('16', 12, 3), ...classes('31', 12, 3), ...classes('48', 12, 3, rare)],
      '2027-2028',
      1,
    )[0]!;
    assert.equal(shown(most.nation).items['s1-w9']?.classes, 12);
    assert.equal(shown(most.wilayas['16']).items['s1-w9'], null);
    assert.equal(shown(most.wilayas['48']).items['s1-w9']?.classes, 12);
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

  it('hides an item within shown figures, under the floor and by subtraction', () => {
    const none = { merged: [], skipped: [], split: [], retaught: [] };
    const both = { sessions: { 's1-w1': 5, 's1-w8': 3 }, changed: none };
    const plain = { sessions: { 's1-w1': 5 }, changed: none };
    const figures = termFigures(
      [
        ...classes('16', 12, 3, both),
        ...classes('31', 4, 2, both),
        ...classes('31', 8, 3, plain),
        ...classes('48', 12, 3, both),
      ],
      '2027-2028',
      1,
    )[0]!;
    assert.deepEqual(Object.keys(figures.wilayas), ['16', '31', '48']);
    assert.equal(shown(figures.nation).items['s1-w8']?.classes, 28);
    assert.equal(shown(figures.wilayas['31']).items['s1-w8'], null);
    assert.equal(shown(figures.wilayas['16']).items['s1-w8'], null);
    assert.equal(shown(figures.wilayas['48']).items['s1-w8']?.classes, 12);
    assert.equal(shown(figures.wilayas['31']).items['s1-w1']?.classes, 12);
  });

  it('keeps two wilayas under the floor in an item’s sum, so a hidden one is never worked out', () => {
    const none = { merged: [], skipped: [], split: [], retaught: [] };
    const both = { sessions: { 's1-w1': 5, 's1-w8': 3 }, changed: none };
    const plain = { sessions: { 's1-w1': 5 }, changed: none };
    const one = termFigures(
      [
        ...classes('10', 9, 3, both),
        ...classes('20', 11, 3, plain),
        ...classes('30', 12, 3, both),
        ...classes('40', 13, 3, both),
      ],
      '2027-2028',
      1,
    )[0]!;
    assert.deepEqual(Object.keys(one.wilayas), ['30', '40']);
    assert.equal(shown(one.nation).items['s1-w8']?.classes, 34);
    assert.equal(shown(one.wilayas['30']).items['s1-w8'], null);
    assert.equal(shown(one.wilayas['40']).items['s1-w8']?.classes, 13);
    const three = termFigures(
      [
        ...classes('10', 5, 3, both),
        ...classes('11', 5, 3, both),
        ...classes('12', 5, 3, both),
        ...classes('30', 12, 3, both),
        ...classes('40', 12, 3, both),
      ],
      '2027-2028',
      1,
    )[0]!;
    assert.deepEqual(Object.keys(three.wilayas), ['30', '40']);
    assert.equal(shown(three.wilayas['30']).items['s1-w8']?.classes, 12);
    assert.equal(shown(three.wilayas['40']).items['s1-w8']?.classes, 12);
  });

  it('gives a median of sessions only when the classes that logged them cover the floor', () => {
    const none = { merged: [], skipped: [], split: [], retaught: [] };
    const figures = termFigures(
      [
        ...classes('16', 11, 3, { sessions: { 's1-w1': 4 }, changed: { ...none, split: ['s1-w9'] } }),
        ...classes('16', 1, 1, { sessions: { 's1-w1': 6, 's1-w9': 37 }, changed: none }),
      ],
      '2027-2028',
      1,
    )[0]!;
    const nation = shown(figures.nation);
    assert.equal(nation.items['s1-w9']?.classes, 12);
    assert.equal(nation.items['s1-w9']?.sessions, null);
    assert.deepEqual(nation.items['s1-w9']?.split, [85, 100]);
    const even = termFigures(
      [...classes('16', 6, 3, { sessions: { 's1-w1': 4 } }), ...classes('16', 6, 3, { sessions: { 's1-w1': 6 } })],
      '2027-2028',
      1,
    )[0]!;
    assert.equal(shown(even.nation).items['s1-w1']?.sessions, 5);
  });

  it('lists at most 512 items, those of the most classes, then by name', () => {
    const none = { merged: [], skipped: [], split: [], retaught: [] };
    const named = (from: number, to: number, prefix = 'i') =>
      Object.fromEntries(
        Array.from({ length: to - from }, (_, at) => [`${prefix}${String(from + at).padStart(3, '0')}`, 1]),
      );
    const items = Object.keys(
      shown(
        termFigures(
          [
            ...classes('16', 10, 3, { sessions: { ...named(0, 100, 'z'), ...named(0, 200) }, changed: none }),
            ...classes('16', 10, 3, { sessions: named(200, 600), changed: none }),
            ...classes('16', 10, 3, { sessions: named(0, 100, 'z'), changed: none }),
          ],
          '2027-2028',
          1,
        )[0]!.nation,
      ).items,
    );
    assert.equal(items.length, 512);
    assert.deepEqual([items[0], items[411], items[412], items[511]], ['i000', 'i411', 'z000', 'z099']);
  });

  it('gives each grade, subject and pack its own figures, in order', () => {
    const figures = termFigures(
      [
        ...classes('16', 12, 3, { subject: 'maths' }),
        ...classes('16', 12, 3, { grade: '1am' }),
        ...classes('16', 12, 3, { pack: 'dz.cem.4am.arabic.other' }),
        ...classes('16', 12, 3),
      ],
      '2027-2028',
      1,
    );
    assert.deepEqual(
      figures.map((one) => [one.grade, one.subject, one.pack, shown(one.nation).classes]),
      [
        ['1am', 'arabic', 'dz.cem.4am.arabic.made-up', 12],
        ['4am', 'arabic', 'dz.cem.4am.arabic.made-up', 12],
        ['4am', 'arabic', 'dz.cem.4am.arabic.other', 12],
        ['4am', 'maths', 'dz.cem.4am.arabic.made-up', 12],
      ],
    );
  });
});
