// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Release checks for week packs (#609, R-4.3-12), with made-up source
// plans: the declared horizon, gaps, each activity's session budget and
// findings traced to the affected items, without changing the source pack.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkWeekPack, parsePlanPack, type PackItem, type PlanPack } from '../src/index.ts';
import { languagePackSource, mathPack } from './fixtures.ts';

const model = [
  { code: 'reading', name: { en: 'Reading' }, sessions: 2 },
  { code: 'writing', name: { en: 'Writing' }, sessions: 1 },
];

function week(number: number): PackItem[] {
  return [
    { id: `r${number}`, kind: 'lesson', title: 'Made-up reading', week: number, activity: 'reading', budget: 2 },
    { id: `w${number}`, kind: 'lesson', title: 'Made-up writing', week: number, activity: 'writing' },
  ];
}

function pack(items = [1, 2, 3].flatMap(week), activities: typeof model | undefined = model): PlanPack {
  const read = parsePlanPack({ ...languagePackSource, items, activities, merges: [] });
  assert.ok(read.ok);
  return read.value;
}

describe('week-pack release checks', () => {
  it('accepts every declared week with exactly its weekly model', () => {
    assert.deepEqual(checkWeekPack(pack(), 3), []);
  });

  it('finds leading and trailing missing weeks, without inventing an item ID', () => {
    assert.deepEqual(checkWeekPack(pack(week(2)), 3), [
      { kind: 'missing-weeks', week: 1, through: 1, items: [] },
      { kind: 'missing-weeks', week: 3, through: 3, items: [] },
    ]);
  });

  it('groups consecutive missing weeks, including a very long empty horizon', () => {
    assert.deepEqual(checkWeekPack(pack([...week(1), ...week(4)]), 4), [
      { kind: 'missing-weeks', week: 2, through: 3, items: [] },
    ]);
    assert.deepEqual(checkWeekPack(pack(week(1)), Number.MAX_SAFE_INTEGER), [
      { kind: 'missing-weeks', week: 2, through: Number.MAX_SAFE_INTEGER, items: [] },
    ]);
  });

  it('names the items outside the declared horizon and still checks their activities', () => {
    const outside = week(3).map((item) => ({ ...item, budget: 1 }));
    assert.deepEqual(checkWeekPack(pack([...week(1), ...week(2), ...outside]), 2), [
      { kind: 'outside-horizon', week: 3, items: ['r3', 'w3'] },
      { kind: 'activity-sessions', week: 3, activity: 'reading', expected: 2, actual: 1, items: ['r3'] },
    ]);
  });

  it('reports an absent activity in a present week as zero sessions', () => {
    assert.deepEqual(checkWeekPack(pack([week(1)[0]!]), 1), [
      { kind: 'activity-sessions', week: 1, activity: 'writing', expected: 1, actual: 0, items: [] },
    ]);
  });

  it('reports both too few and too many sessions with the contributing item IDs', () => {
    const items = week(1).map((item) => ({ ...item, budget: item.activity === 'reading' ? 1 : 2 }));
    assert.deepEqual(checkWeekPack(pack(items), 1), [
      { kind: 'activity-sessions', week: 1, activity: 'reading', expected: 2, actual: 1, items: ['r1'] },
      { kind: 'activity-sessions', week: 1, activity: 'writing', expected: 1, actual: 2, items: ['w1'] },
    ]);
  });

  it('adds all items of an activity using the engine’s rounding and default budgets', () => {
    const [reading, writing] = week(1);
    assert.deepEqual(
      checkWeekPack(pack([{ ...reading!, budget: 1.4 }, { ...reading!, id: 'r1-extra', budget: 1.4 }, writing!]), 1),
      [],
    );
  });

  it('names unclassified items rather than assigning them an activity', () => {
    const extra: PackItem = { id: 'untagged', kind: 'lesson', title: 'Made-up lesson', week: 1 };
    assert.deepEqual(checkWeekPack(pack([...week(1), extra]), 1), [
      { kind: 'missing-activity', week: 1, items: ['untagged'] },
    ]);
  });

  it('reports a missing model while keeping older packs readable', () => {
    const source = { ...languagePackSource, items: week(1), activities: undefined, merges: [] };
    const read = parsePlanPack(source);
    assert.ok(read.ok);
    assert.deepEqual(checkWeekPack(read.value, 1), [{ kind: 'missing-model', week: null, items: ['r1', 'w1'] }]);
  });

  it('keeps unit headings and the TD queue out of the weekly activity count', () => {
    const unit: PackItem = { id: 'u1', kind: 'unit', title: 'Made-up unit' };
    const td: PackItem = { id: 'td1', kind: 'td', title: 'Made-up TD', week: 1, budget: 20 };
    assert.deepEqual(checkWeekPack(pack([unit, ...week(1), td]), 1), []);
    assert.deepEqual(checkWeekPack(pack([unit, td]), 1), [{ kind: 'missing-weeks', week: 1, through: 1, items: [] }]);
  });

  it('checks optional and buffer items when they take sessions in the weekly model', () => {
    const items = week(1).map((item) => ({ ...item, optional: true, buffer: true }));
    assert.deepEqual(checkWeekPack(pack(items), 1), []);
  });

  it('leaves budget and hybrid packs for their own checks', () => {
    assert.deepEqual(checkWeekPack(mathPack, 3), []);
    assert.deepEqual(checkWeekPack({ ...mathPack, anchor: { kind: 'hybrid', unit: 'hours' } }, 3), []);
  });

  it('orders findings by week without sorting or changing the pack', () => {
    const original = pack([...week(3), ...week(1)]);
    const before = JSON.stringify(original);
    assert.deepEqual(checkWeekPack(original, 3), [{ kind: 'missing-weeks', week: 2, through: 2, items: [] }]);
    assert.equal(JSON.stringify(original), before);
    assert.deepEqual(checkWeekPack(original, 3), checkWeekPack(original, 3));
  });

  it('requires a positive, safe, whole number of plan weeks', () => {
    for (const weeks of [0, -1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => checkWeekPack(pack(), weeks), RangeError);
    }
  });
});
