// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A hybrid pack's week targets in the budget-pack check (#610, answer 390),
// read as the plan reads them, using made-up plans only: the checkpoints, the
// buffers set aside at them, and the targets no period can check.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkBudgetPack,
  type BudgetPackPeriod,
  type BudgetPackScope,
  type PackItem,
  type PlanPack,
} from '../src/index.ts';
import { ref, scope, source } from './budget-pack-fixtures.ts';
import { d } from './fixtures.ts';

function checked(pack: PlanPack, horizon: BudgetPackScope = scope) {
  const result = checkBudgetPack(pack, ref, horizon);
  assert.equal(result.status, 'checked');
  if (result.status !== 'checked') throw new Error('Expected a checked source');
  return result;
}

describe('a hybrid pack in the budget-pack check', () => {
  const hybrid = (items: readonly PackItem[]) => ({
    ...source(items),
    anchor: { kind: 'hybrid', unit: 'hours' } as const,
    items,
  });
  const lesson = (id: string, fields: Partial<PackItem> = {}): PackItem => ({
    id,
    kind: 'lesson',
    title: 'Made up',
    budget: 1,
    ...fields,
  });
  const atWeeks = (periods: readonly BudgetPackPeriod[]) =>
    periods.flatMap((period) => (period.week === undefined ? [] : [[period.week, period.main.needs]]));

  it('counts the items up to each week target, and none past the last', () => {
    const items = [lesson('a', { week: 1 }), lesson('b'), lesson('c', { week: 2 }), lesson('d')];
    const result = checked(hybrid(items));
    assert.deepEqual(atWeeks(result.periods), [
      [1, 1],
      [2, 3],
    ]);
    assert.equal(result.periods.at(-1)?.main.needs, 4);
    assert.deepEqual(result.skippedTargets, []);
    const disordered = [lesson('a', { week: 2 }), lesson('b', { week: 1 })];
    assert.deepEqual(atWeeks(checked(hybrid(disordered)).periods), [
      [1, 2],
      [2, 1],
    ]);
  });

  it('sets a buffer aside at a checkpoint, as the plan does, and counts it over the term and the whole', () => {
    const items = [
      lesson('first', { term: 1 }),
      lesson('spare', { budget: 2, buffer: true, term: 1 }),
      lesson('target', { week: 1, term: 1 }),
    ];
    const result = checked(hybrid(items));
    assert.deepEqual(atWeeks(result.periods), [[1, 2]]);
    assert.deepEqual(
      result.findings.filter((finding) => finding.week !== undefined),
      [],
    );
    assert.equal(result.periods.find((period) => period.term === 1)?.main.needs, 4);
    assert.equal(result.periods.at(-1)?.main.needs, 4);
  });

  it('takes a buffer marked with a week as its target, as the plan does', () => {
    const items = [lesson('a'), lesson('remedy', { week: 2, buffer: true })];
    assert.deepEqual(atWeeks(checked(hybrid(items)).periods), [[2, 1]]);
  });

  it('takes no week target from the TD queue, a unit heading or a budgets pack', () => {
    const td: PackItem = { id: 't', kind: 'td', title: 'Made up', budget: 50, week: 1 };
    const unit: PackItem = { id: 'u', kind: 'unit', title: 'Made up', week: 40 };
    const result = checked(hybrid([unit, lesson('a'), td]));
    assert.deepEqual(atWeeks(result.periods), []);
    assert.deepEqual(result.skippedTargets, []);
    assert.deepEqual(atWeeks(checked(source([lesson('a', { week: 1 })])).periods), []);
    const both = checked(hybrid([lesson('a', { week: 1 }), td]));
    assert.equal(both.periods[0]?.td.needs, 0);
    assert.deepEqual(
      both.findings.filter((finding) => finding.week !== undefined),
      [],
    );
  });

  it('lists a week target the calendar or the horizon cannot check, with its last item', () => {
    const items = [lesson('a', { week: 40 }), lesson('b', { week: 30 }), lesson('c', { week: 40 })];
    const result = checked(hybrid(items));
    assert.deepEqual(result.skippedTargets, [
      { week: 30, item: 'b' },
      { week: 40, item: 'c' },
    ]);
    assert.deepEqual(atWeeks(result.periods), []);
    const two = hybrid([lesson('a', { week: 1 }), lesson('b', { week: 2 })]);
    assert.deepEqual(checked(two, { ...scope, to: d('2026-09-24') }).skippedTargets, [{ week: 2, item: 'b' }]);
    assert.deepEqual(checked(two, { ...scope, from: d('2026-09-27') }).skippedTargets, [{ week: 1, item: 'a' }]);
  });
});
