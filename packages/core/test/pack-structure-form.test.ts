// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Structure changes keep a synthetic source's names and require a second
// weekly count; an anchor change never removes that model by itself. A new
// budget unit over items with budgets needs the curator's word they were
// rechecked, as those numbers are kept.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { budgetUnitChanged, packStructureForm, readPackStructureForm, type PlanPack } from '../src/index.ts';
import { mathPack } from './fixtures.ts';

const pack: PlanPack = {
  ...mathPack,
  anchor: { kind: 'weeks' },
  stageTemplates: [{ id: 'step', stages: ['Start', 'Practise'] }],
  activities: [{ code: 'reading', name: { ar: 'قراءة تجريبية', kab: 'Synthetic name' }, sessions: 2 }],
  items: [
    {
      id: 'lesson',
      kind: 'lesson',
      title: 'Synthetic lesson',
      week: 1,
      sourcePage: 1,
      stages: 'step',
      activity: 'reading',
      budget: 1,
    },
  ],
  merges: [],
};

describe('the pack structure form', () => {
  it('keeps source values and other languages, but leaves the second count empty', () => {
    const form = packStructureForm(pack);
    assert.equal(form.activities[0]!.retyped, '');
    assert.equal(readPackStructureForm(pack, form).ok, false);
    const checked = { ...form, activities: form.activities.map((one) => ({ ...one, retyped: '٢' })) };
    const read = readPackStructureForm(pack, checked);
    assert.ok(read.ok);
    assert.deepEqual(read.value.activities, pack.activities);
    assert.equal(read.value.stageTemplates[0]!.stages.length, 2);
    assert.notEqual(form.activities[0]!.name, pack.activities![0]!.name);
  });

  it('refuses changed counts until they are independently retyped', () => {
    const form = packStructureForm(pack);
    for (const retyped of ['', '3', '2.5', '0'])
      assert.equal(
        readPackStructureForm(pack, { ...form, activities: [{ ...form.activities[0], retyped }] }).ok,
        false,
      );
  });

  it('does not silently drop a weekly model or a referenced template', () => {
    const form = packStructureForm(pack);
    const checked = { ...form, activities: form.activities.map((one) => ({ ...one, retyped: '2' })) };
    assert.equal(readPackStructureForm(pack, { ...checked, kind: 'budgets' }).ok, false);
    assert.equal(readPackStructureForm(pack, { ...checked, templates: [] }).ok, false);
    assert.equal(
      readPackStructureForm(pack, { ...checked, activities: [{ ...checked.activities[0], code: 'other' }] }).ok,
      false,
    );
    const withoutActivities = { ...checked, kind: 'budgets' as const, activities: [] };
    assert.equal(readPackStructureForm(pack, withoutActivities).ok, false);
    const untagged = {
      ...pack,
      items: pack.items.map((item) => {
        const copy = { ...item };
        delete copy.activity;
        return copy;
      }),
    };
    const removed = readPackStructureForm(untagged, { ...withoutActivities, budgetsRechecked: true });
    assert.ok(removed.ok);
    assert.equal(removed.value.activities, undefined);
    assert.deepEqual(pack.activities![0]!.name, { ar: 'قراءة تجريبية', kab: 'Synthetic name' });
  });

  it('needs the budgets rechecked when their unit changes, and only then', () => {
    const items = pack.items.map((item) => {
      const copy = { ...item };
      delete copy.activity;
      return copy;
    });
    const budgets: PlanPack = { ...pack, items, anchor: { kind: 'budgets', unit: 'hours' } };
    delete (budgets as { activities?: unknown }).activities;
    const form = packStructureForm(budgets);
    assert.equal(form.budgetsRechecked, false);
    assert.equal(readPackStructureForm(budgets, form).ok, true);
    assert.equal(budgetUnitChanged(budgets, form), false);
    const flipped = { ...form, unit: 'sessions' as const };
    assert.equal(budgetUnitChanged(budgets, flipped), true);
    const refused = readPackStructureForm(budgets, flipped);
    assert.deepEqual(refused.ok ? [] : refused.problems, [{ path: 'budgetsRechecked', problem: 'required' }]);
    const read = readPackStructureForm(budgets, { ...flipped, budgetsRechecked: true });
    assert.ok(read.ok);
    assert.deepEqual(read.value.anchor, { kind: 'budgets', unit: 'sessions' });
    assert.equal(read.value.items[0]!.budget, 1);
    assert.equal(budgetUnitChanged(budgets, { ...form, kind: 'weeks' }), false);
    const none = budgets.items.map((item) => {
      const copy = { ...item, week: 1 };
      delete copy.budget;
      return copy;
    });
    assert.equal(budgetUnitChanged({ ...budgets, items: none }, flipped), false);
    assert.equal(budgetUnitChanged({ ...budgets, anchor: { kind: 'weeks' } }, flipped), true);
  });

  it('reports malformed structures rather than guessing a default', () => {
    for (const raw of [
      null,
      {},
      { ...packStructureForm(pack), kind: 'unknown' },
      { ...packStructureForm(pack), unit: null },
      { ...packStructureForm(pack), activities: null },
      { ...packStructureForm(pack), templates: ['invalid'] },
    ])
      assert.equal(readPackStructureForm(pack, raw).ok, false);
  });
});
