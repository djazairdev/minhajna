// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Release checks for week packs (#609, R-4.3-12), with made-up source
// plans: the declared horizon, gaps, each activity's session budget and
// findings traced to the affected items, without changing the source pack.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { checkWeekPack, parsePlanPack, type PackActivity, type PackItem, type PlanPack } from '../src/index.ts';
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

function pack(items = [1, 2, 3].flatMap(week), activities: readonly PackActivity[] | undefined = model): PlanPack {
  const read = parsePlanPack({ ...languagePackSource, items, activities, merges: [] });
  assert.ok(read.ok);
  return read.value;
}

function findings(source: PlanPack, weeks: number) {
  const result = checkWeekPack(source, weeks);
  assert.ok(result.status === 'checked');
  return result.findings;
}

describe('week-pack release checks', () => {
  it('accepts every declared week with exactly its weekly model', () => {
    assert.deepEqual(findings(pack(), 3), []);
  });

  it('finds leading and trailing missing weeks, without inventing an item ID', () => {
    assert.deepEqual(findings(pack(week(2)), 3), [
      { kind: 'missing-weeks', week: 1, through: 1, items: [] },
      { kind: 'missing-weeks', week: 3, through: 3, items: [] },
    ]);
  });

  it('groups consecutive missing weeks, including a very long empty horizon', () => {
    assert.deepEqual(findings(pack([...week(1), ...week(4)]), 4), [
      { kind: 'missing-weeks', week: 2, through: 3, items: [] },
    ]);
    assert.deepEqual(findings(pack(week(1)), Number.MAX_SAFE_INTEGER), [
      { kind: 'missing-weeks', week: 2, through: Number.MAX_SAFE_INTEGER, items: [] },
    ]);
  });

  it('names the items outside the declared horizon and still checks their activities', () => {
    const outside = week(3).map((item) => ({ ...item, budget: 1 }));
    assert.deepEqual(findings(pack([...week(1), ...week(2), ...outside]), 2), [
      { kind: 'outside-horizon', week: 3, items: ['r3', 'w3'] },
      { kind: 'activity-sessions', week: 3, activity: 'reading', expected: 2, actual: 1, items: ['r3'] },
    ]);
  });

  it('reports an absent activity in a present week as zero sessions', () => {
    assert.deepEqual(findings(pack([week(1)[0]!]), 1), [
      { kind: 'activity-sessions', week: 1, activity: 'writing', expected: 1, actual: 0, items: [] },
    ]);
  });

  it('reports both too few and too many sessions with the contributing item IDs', () => {
    const items = week(1).map((item) => ({ ...item, budget: item.activity === 'reading' ? 1 : 2 }));
    assert.deepEqual(findings(pack(items), 1), [
      { kind: 'activity-sessions', week: 1, activity: 'reading', expected: 2, actual: 1, items: ['r1'] },
      { kind: 'activity-sessions', week: 1, activity: 'writing', expected: 1, actual: 2, items: ['w1'] },
    ]);
  });

  it('adds all items of an activity using the engine’s rounding and default budgets', () => {
    const [reading, writing] = week(1);
    assert.deepEqual(
      findings(pack([{ ...reading!, budget: 1.4 }, { ...reading!, id: 'r1-extra', budget: 1.4 }, writing!]), 1),
      [],
    );
  });

  it('allows unclassified items for untyped slots', () => {
    const extra: PackItem = { id: 'untagged', kind: 'lesson', title: 'Made-up lesson', week: 1 };
    assert.deepEqual(findings(pack([...week(1), extra]), 1), []);
  });

  it('checks the horizon when there is no weekly model', () => {
    const source = { ...languagePackSource, items: week(1), activities: undefined, merges: [] };
    const read = parsePlanPack(source);
    assert.ok(read.ok);
    assert.deepEqual(findings(read.value, 1), []);
    assert.deepEqual(findings(read.value, 2), [{ kind: 'missing-weeks', week: 2, through: 2, items: [] }]);
  });

  it('keeps unit headings and the TD queue out of the weekly activity count', () => {
    const unit: PackItem = { id: 'u1', kind: 'unit', title: 'Made-up unit' };
    const td: PackItem = { id: 'td1', kind: 'td', title: 'Made-up TD', week: 1, budget: 20 };
    assert.deepEqual(findings(pack([unit, ...week(1), td]), 1), []);
    assert.deepEqual(findings(pack([unit, td]), 1), [{ kind: 'missing-weeks', week: 1, through: 1, items: [] }]);
  });

  it('counts assessment and buffer weeks toward the horizon without applying the ordinary model', () => {
    const remediation: PackItem = { id: 'remediation', kind: 'assessment-remediation', title: 'Made up', week: 1 };
    const buffer: PackItem = { id: 'buffer', kind: 'lesson', title: 'Made up', week: 2, buffer: true };
    assert.deepEqual(findings(pack([remediation, buffer]), 2), []);
  });

  it('exempts a week of diagnostic or term assessment items alone', () => {
    const diagnostic: PackItem = { id: 'diagnostic', kind: 'diagnostic', title: 'Made up', week: 1 };
    const term: PackItem = { id: 'term', kind: 'term-assessment', title: 'Made up', week: 2 };
    assert.deepEqual(findings(pack([diagnostic, term]), 2), []);
  });

  it('lists a reserved week past the horizon', () => {
    const term: PackItem = { id: 'term', kind: 'term-assessment', title: 'Made up', week: 2 };
    assert.deepEqual(findings(pack([...week(1), term]), 1), [{ kind: 'outside-horizon', week: 2, items: ['term'] }]);
  });

  it('lets a tagged buffer fill a slot of a regular week', () => {
    const reading: PackItem = { id: 'r1', kind: 'lesson', title: 'Made up', week: 1, activity: 'reading' };
    const spare: PackItem = { ...reading, id: 'b1', buffer: true };
    const writing = week(1)[1]!;
    assert.deepEqual(findings(pack([reading, spare, writing]), 1), []);
  });

  it('lets a tagged buffer sit spare beside a full activity', () => {
    const spare: PackItem = { id: 'b1', kind: 'lesson', title: 'Made up', week: 1, activity: 'reading', buffer: true };
    assert.deepEqual(findings(pack([...week(1), spare]), 1), []);
  });

  it('reports too many on the planned items alone, beside a spare buffer', () => {
    const reading: PackItem = { id: 'r1', kind: 'lesson', title: 'Made up', week: 1, activity: 'reading', budget: 3 };
    const spare: PackItem = { ...reading, id: 'b1', budget: 1, buffer: true };
    assert.deepEqual(findings(pack([reading, spare, week(1)[1]!]), 1), [
      { kind: 'activity-sessions', week: 1, activity: 'reading', expected: 2, actual: 3, items: ['r1'] },
    ]);
  });

  it('clears a half-week keyed with its items as buffers filling its slots, and only then', () => {
    const lesson: PackItem = { id: 'r1', kind: 'lesson', title: 'Made up', week: 1, activity: 'reading' };
    const integration: PackItem = { ...lesson, id: 'i1', kind: 'integration', buffer: true };
    const writing = week(1)[1]!;
    const remedy: PackItem = { ...writing, id: 'rem', kind: 'assessment-remediation', buffer: true };
    assert.deepEqual(findings(pack([lesson, integration, remedy]), 1), []);
    const untagged: PackItem = { id: 'i2', kind: 'integration', title: 'Made up', week: 1 };
    assert.deepEqual(findings(pack([untagged]), 1), [
      { kind: 'activity-sessions', week: 1, activity: 'reading', expected: 2, actual: 0, items: [] },
      { kind: 'activity-sessions', week: 1, activity: 'writing', expected: 1, actual: 0, items: [] },
    ]);
  });

  it('names the buffers a short activity counted', () => {
    const reading: PackItem = { id: 'r1', kind: 'lesson', title: 'Made up', week: 1, activity: 'reading' };
    const spare: PackItem = { ...reading, id: 'b1', buffer: true };
    const heavy: PackActivity = { code: 'reading', name: { en: 'Reading' }, sessions: 3 };
    assert.deepEqual(findings(pack([reading, spare, week(1)[1]!], [heavy, model[1]!]), 1), [
      { kind: 'activity-sessions', week: 1, activity: 'reading', expected: 3, actual: 2, items: ['r1', 'b1'] },
    ]);
  });

  it('counts tagged assessments in a regular week as the engine schedules them', () => {
    const term: PackItem = { id: 't1', kind: 'term-assessment', title: 'Made up', week: 1, activity: 'writing' };
    const diagnostic: PackItem = { id: 'd1', kind: 'diagnostic', title: 'Made up', week: 1, activity: 'reading' };
    const lesson: PackItem = { ...diagnostic, id: 'r1', kind: 'lesson' };
    assert.deepEqual(findings(pack([diagnostic, lesson, term]), 1), []);
    assert.deepEqual(findings(pack([...week(1), term]), 1), [
      { kind: 'activity-sessions', week: 1, activity: 'writing', expected: 1, actual: 2, items: ['w1', 't1'] },
    ]);
  });

  it('checks a regular week beside an untagged remediation', () => {
    const remediation: PackItem = { id: 'rem', kind: 'assessment-remediation', title: 'Made up', week: 1 };
    assert.deepEqual(findings(pack([...week(1), remediation]), 1), []);
    assert.deepEqual(findings(pack([week(1)[0]!, remediation]), 1), [
      { kind: 'activity-sessions', week: 1, activity: 'writing', expected: 1, actual: 0, items: [] },
    ]);
  });

  it('checks the repository example with untyped lessons and an assessment week', () => {
    const file = new URL('../../../data/dz/packs/dz.primary.5ap.arabic.example@2026.1.json', import.meta.url);
    const read = parsePlanPack(JSON.parse(readFileSync(file, 'utf8')));
    assert.ok(read.ok);
    assert.deepEqual(findings(read.value, 4), []);
  });

  it('reports an invalid in-memory week without masking the surrounding gap', () => {
    const original = pack([...week(1), ...week(3)]);
    const missing: PackItem = { id: 'no-week', kind: 'lesson', title: 'Made up' };
    assert.deepEqual(findings({ ...original, items: [missing, ...original.items] }, 3), [
      { kind: 'invalid-week', week: null, items: ['no-week'] },
      { kind: 'missing-weeks', week: 2, through: 2, items: [] },
    ]);
  });

  it('leaves budget and hybrid packs for their own checks', () => {
    assert.deepEqual(checkWeekPack(mathPack, 3), { status: 'not-applicable' });
    assert.deepEqual(checkWeekPack({ ...mathPack, anchor: { kind: 'hybrid', unit: 'hours' } }, 3), {
      status: 'not-applicable',
    });
  });

  it('orders findings by week without sorting or changing the pack', () => {
    const original = pack([...week(3), ...week(1)]);
    const before = JSON.stringify(original);
    assert.deepEqual(findings(original, 3), [{ kind: 'missing-weeks', week: 2, through: 2, items: [] }]);
    assert.equal(JSON.stringify(original), before);
    assert.deepEqual(findings(original, 3), findings(original, 3));
  });

  it('requires a positive, safe, whole number of plan weeks', () => {
    for (const weeks of [0, -1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => findings(pack(), weeks), RangeError);
    }
  });
});
