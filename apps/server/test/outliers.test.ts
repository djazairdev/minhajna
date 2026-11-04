// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Setting aside what no real class would send (#628, answer 679): a token
// naming two wilayas in a term, or past 24 courses over its packs, set aside
// with all its sendings, one at 24 kept, and its sendings in another term
// apart; within a pack of 20 sendings at least once those are set aside, a
// total over the upper far fence set aside, none under it, the fence itself
// kept, a pack of fewer drawing none; the fence seven medians up when classes
// spent much the same, keeping those that logged the whole term among many that
// began late, one session up when they spent none, and a flood of inflated
// sendings set aside whole; and the figures counting no sending set aside
// toward any figure or floor, giving the number set aside beside a nation's
// figure shown only. Every sending here is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { termFigures } from '../src/insights/figures.js';
import { floodedTokens, withinFences } from '../src/insights/outliers.js';
import type { KeptSending } from '../src/insights/sending-read.js';
import { keptOf, madeUpSending } from './insights-kit.js';

let made = 0;

/** A made-up class of its own token, in a wilaya and school, with its sessions on one item. */
function sending(wilaya: string, school: number, sessions: number, change: Partial<KeptSending> = {}): KeptSending {
  made += 1;
  const kept = keptOf(madeUpSending(made, made), `${'0'.repeat(16)}.${wilaya}${school}`);
  const changed = { merged: [], skipped: [], split: [], retaught: [] };
  return { ...kept, wilaya, sessions: { 's1-w1': sessions }, changed, ...change };
}

const spread = (count: number, from: number) =>
  Array.from({ length: count }, (_, at) => sending('16', at % 3, from + at));

describe('setting aside what no real class would send', () => {
  it('sets aside a token naming two wilayas or past 24 courses, and keeps one at 24', () => {
    const token = (teacher: number) => teacher.toString(16).padStart(32, 'e');
    const two = [sending('16', 1, 5, { token: token(900) }), sending('31', 1, 5, { token: token(900) })];
    const many = Array.from({ length: 25 }, () => sending('16', 1, 5, { token: token(901) }));
    const most = Array.from({ length: 24 }, () => sending('16', 1, 5, { token: token(902) }));
    const packs = [
      ...Array.from({ length: 13 }, () => sending('16', 1, 5, { token: token(903) })),
      ...Array.from({ length: 12 }, () => sending('16', 1, 5, { token: token(903), pack: 'dz.cem.4am.arabic.other' })),
    ];
    assert.deepEqual([...floodedTokens([...two, ...many, ...most, ...packs])].sort(), [
      token(900),
      token(901),
      token(903),
    ]);
    const terms = Array.from({ length: 26 }, (_, at) =>
      sending('16', 1, 5, { token: token(904), term: at % 2 === 0 ? 1 : 2 }),
    );
    const [both] = termFigures([...terms, ...spread(12, 40)], '2027-2028', 1);
    assert.equal(both?.nation?.classes, 25);
  });

  it('sets aside a total past the far fences in a pack of 20 sendings at least, and draws none in fewer', () => {
    const honest = spread(19, 40);
    const inflated = sending('16', 1, 5000);
    assert.deepEqual(withinFences([...honest, inflated]), honest);
    assert.equal(withinFences([...honest.slice(1), inflated]).length, 19);
    const far = [sending('16', 1, 0), sending('16', 1, 300), sending('16', 1, 400)];
    assert.deepEqual(
      withinFences([...honest, ...far]).map((one) => one.sessions['s1-w1']),
      [...honest.map((one) => one.sessions['s1-w1']), 0, 300],
    );
    const same = Array.from({ length: 24 }, () => sending('16', 1, 10));
    const [low, at, past] = [sending('16', 1, 0), sending('16', 1, 70), sending('16', 1, 71)];
    assert.deepEqual(withinFences([...same, low, at, past]), [...same, low, at]);
    const none = Array.from({ length: 20 }, () => sending('16', 1, 0));
    const [one, two] = [sending('16', 1, 3), sending('16', 1, 4)];
    assert.deepEqual(withinFences([...none, one, two]), [...none, one]);
    for (const [began, logged] of [
      [40, 10],
      [46, 4],
    ] as const) {
      const late = Array.from({ length: began }, () => sending('16', 1, 11));
      const whole = Array.from({ length: logged }, () => sending('16', 1, 60));
      assert.equal(withinFences([...late, ...whole]).length, 50);
    }
    const flood = Array.from({ length: 9 }, () => sending('16', 1, 5000));
    const thirty = spread(30, 60);
    assert.deepEqual(withinFences([...thirty, ...flood]), thirty);
  });

  it('counts no sending set aside toward a figure or its floor, and gives the number beside a nation shown', () => {
    const honest = spread(24, 40);
    const [figures] = termFigures([...honest, sending('16', 1, 5000)], '2027-2028', 1);
    assert.equal(figures?.nation?.classes, 24);
    assert.equal(figures?.setAside, 1);
    const nine = Array.from({ length: 9 }, (_, at) => sending('16', at % 3, 40));
    const token = 'f'.repeat(32);
    const flooded = [sending('16', 1, 40, { token }), sending('31', 1, 40, { token })];
    const [hidden] = termFigures([...nine, ...flooded], '2027-2028', 1);
    assert.equal(hidden?.nation, null);
    assert.equal(hidden?.setAside, null);
    const [counted] = termFigures([...spread(24, 40), ...flooded], '2027-2028', 1);
    assert.deepEqual([counted?.nation?.classes, counted?.setAside], [24, 2]);
    const fenced = termFigures([...spread(18, 40), sending('16', 1, 5000), ...flooded], '2027-2028', 1)[0];
    assert.deepEqual([fenced?.nation?.classes, fenced?.setAside], [19, 2]);
    const [none] = termFigures(flooded, '2027-2028', 1);
    assert.deepEqual(
      [none?.pack, none?.nation, none?.wilayas, none?.setAside],
      ['dz.cem.4am.arabic.made-up', null, {}, null],
    );
  });
});
