// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Structure changes keep a synthetic source's names and require a second
// weekly count; an anchor change never removes that model by itself.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { packStructureForm, readPackStructureForm, type PlanPack } from '../src/index.ts';
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
    const removed = readPackStructureForm(untagged, withoutActivities);
    assert.ok(removed.ok);
    assert.equal(removed.value.activities, undefined);
    assert.deepEqual(pack.activities![0]!.name, { ar: 'قراءة تجريبية', kab: 'Synthetic name' });
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
