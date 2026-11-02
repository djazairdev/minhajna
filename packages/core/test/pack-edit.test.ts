// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The curator changes copies of synthetic sources, never a teacher's
// records. A whole-pack read protects relationships after every operation.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  editPackItem,
  editPackStructure,
  movePackItem,
  packItemForm,
  removePackItem,
  type PackItem,
  type PlanPack,
} from '../src/index.ts';
import { mathPack } from './fixtures.ts';

const pack: PlanPack = {
  ...mathPack,
  items: [
    { id: 'unit', kind: 'unit', title: 'Synthetic unit', sourcePage: 1 },
    { id: 'first', kind: 'lesson', title: 'First', unit: 'unit', budget: 1, sourcePage: 2 },
    { id: 'second', kind: 'lesson', title: 'Second', unit: 'unit', budget: 2, sourcePage: 3 },
  ],
  merges: [],
};
const formOf = (item: PackItem) => {
  const form = packItemForm(item);
  return { ...form, retyped: { term: form.term, week: form.week, budget: form.budget, sourcePage: form.sourcePage } };
};

describe('editing source packs', () => {
  it('adds and changes an item without mutating the reference pack', () => {
    const before = JSON.stringify(pack);
    const changed = editPackItem(pack, 'first', { ...formOf(pack.items[1]!), title: 'Corrected title' });
    assert.ok(changed.ok);
    assert.equal(changed.value.items[1]!.title, 'Corrected title');
    const added = editPackItem(
      pack,
      null,
      formOf({ id: 'new', kind: 'lesson', title: 'New', budget: 1, sourcePage: 3 }),
      'second',
    );
    assert.ok(added.ok);
    assert.deepEqual(
      added.value.items.map((item) => item.id),
      ['unit', 'first', 'new', 'second'],
    );
    assert.equal(JSON.stringify(pack), before);
  });

  it('does not guess missing identities or positions', () => {
    assert.equal(editPackItem(pack, 'missing', formOf(pack.items[1]!)).ok, false);
    assert.equal(editPackItem(pack, null, formOf(pack.items[1]!), 'missing').ok, false);
    assert.equal(movePackItem(pack, 'missing', null).ok, false);
    assert.equal(removePackItem(pack, 'missing').ok, false);
  });

  it('refuses moving a unit behind its children and removing referenced items', () => {
    assert.equal(movePackItem(pack, 'unit', null).ok, false);
    assert.equal(removePackItem(pack, 'unit').ok, false);
    assert.equal(removePackItem({ ...pack, merges: [['first', 'second']] }, 'first').ok, false);
    const moved = movePackItem(pack, 'second', 'first');
    assert.ok(moved.ok);
    assert.deepEqual(
      moved.value.items.map((item) => item.id),
      ['unit', 'second', 'first'],
    );
    const removed = removePackItem(pack, 'second');
    assert.ok(removed.ok);
    assert.equal(removed.value.items.length, 2);
  });

  it('validates anchors and templates against every item and preserves the pack’s other fields', () => {
    const change = { anchor: { kind: 'weeks' as const }, stageTemplates: pack.stageTemplates, activities: null };
    assert.equal(editPackStructure(pack, change).ok, false);
    const weeks = { ...pack, items: pack.items.map((item) => ({ ...item, week: 1 })) };
    const changed = editPackStructure(weeks, change);
    assert.ok(changed.ok);
    assert.equal(changed.value.anchor.kind, 'weeks');
    assert.deepEqual(changed.value.provenance, pack.provenance);
    const staged = {
      ...pack,
      stageTemplates: [{ id: 'standard', stages: ['Start'] }],
      items: pack.items.map((item) => ({ ...item, stages: 'standard' })),
    };
    assert.equal(editPackStructure(staged, { anchor: pack.anchor, stageTemplates: [], activities: null }).ok, false);
    const templates = editPackStructure(pack, {
      anchor: pack.anchor,
      stageTemplates: [{ id: 'new', stages: ['Present', 'Practise'] }],
      activities: null,
    });
    assert.ok(templates.ok);
    assert.equal(templates.value.stageTemplates[0]!.id, 'new');
  });
});
