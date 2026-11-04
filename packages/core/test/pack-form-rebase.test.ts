// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// An open form moved onto a newer revision keeps what this curator changed,
// takes what the other changed, and never carries a second entry or a word
// about budgets over a value it wasn't given for. Every source is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  budgetUnitOf,
  packItemForm,
  packStructureForm,
  rebaseForm,
  rebasePackItemForm,
  rebasePackStructureForm,
  type PackItem,
  type PlanPack,
} from '../src/index.ts';
import { mathPack } from './fixtures.ts';

const item: PackItem = { id: 'lesson', kind: 'lesson', title: 'Made-up title', budget: 2, sourcePage: 3 };

describe('moving a form onto a newer revision', () => {
  it('keeps changed fields and takes untouched ones', () => {
    const was = { issuer: 'Old issuer', edition: 'Old edition' };
    const now = { issuer: 'Their issuer', edition: 'Their edition' };
    assert.deepEqual(rebaseForm({ ...was, issuer: 'My issuer' }, was, now), {
      issuer: 'My issuer',
      edition: 'Their edition',
    });
  });

  it('takes the other curator’s item fields, and clears only the second entries they changed', () => {
    const form = {
      ...packItemForm(item),
      title: 'My title',
      retyped: { term: '', week: '', budget: '2', sourcePage: '3' },
    };
    const next = rebasePackItemForm(form, item, { ...item, title: 'Their title', budget: 5 });
    assert.equal(next.title, 'My title');
    assert.equal(next.budget, '5');
    assert.equal(next.retyped.budget, '');
    assert.equal(next.sourcePage, '3');
    assert.equal(next.retyped.sourcePage, '3');
  });

  it('keeps a number this curator changed, with its second entry, over the other’s', () => {
    const form = { ...packItemForm(item), budget: '4', retyped: { term: '', week: '', budget: '4', sourcePage: '' } };
    const next = rebasePackItemForm(form, item, { ...item, budget: 5 });
    assert.equal(next.budget, '4');
    assert.equal(next.retyped.budget, '4');
  });

  const pack: PlanPack = {
    ...mathPack,
    anchor: { kind: 'budgets', unit: 'hours' },
    stageTemplates: [],
    activities: [{ code: 'reading', name: { ar: 'قراءة تجريبية' }, sessions: 2 }],
    items: [item],
    merges: [],
  };

  it('takes the other’s unit and templates, and drops the rechecked word', () => {
    const form = { ...packStructureForm(pack), budgetsRechecked: true };
    const newer: PlanPack = {
      ...pack,
      anchor: { kind: 'budgets', unit: 'sessions' },
      stageTemplates: [{ id: 'theirs', stages: ['Made-up stage'] }],
    };
    const next = rebasePackStructureForm(form, pack, newer);
    assert.equal(next.unit, 'sessions');
    assert.deepEqual(next.templates, [{ id: 'theirs', stages: 'Made-up stage' }]);
    assert.equal(next.budgetsRechecked, false);
    const mine = rebasePackStructureForm({ ...packStructureForm(pack), unit: 'sessions' }, pack, {
      ...pack,
      stageTemplates: newer.stageTemplates,
    });
    assert.equal(mine.unit, 'sessions');
  });

  it('counts only a second entry as no change to the activities, and keeps it where its count stands', () => {
    const start = packStructureForm(pack);
    const form = { ...start, activities: [{ ...start.activities[0]!, retyped: '2' }] };
    const added = { code: 'writing', name: { ar: 'كتابة تجريبية' }, sessions: 1 };
    const next = rebasePackStructureForm(form, pack, { ...pack, activities: [...pack.activities!, added] });
    assert.deepEqual(
      next.activities.map((one) => [one.code, one.retyped]),
      [
        ['reading', '2'],
        ['writing', ''],
      ],
    );
    const counted = rebasePackStructureForm(form, pack, {
      ...pack,
      activities: [{ ...pack.activities![0]!, sessions: 3 }],
    });
    assert.equal(counted.activities[0]!.retyped, '');
    const changed = { ...start, activities: [{ ...start.activities[0]!, sessions: '9', retyped: '9' }] };
    assert.deepEqual(
      rebasePackStructureForm(changed, pack, { ...pack, activities: [added] }).activities.map((one) => [
        one.code,
        one.sessions,
      ]),
      [
        ['reading', '9'],
        ['writing', '1'],
      ],
    );
  });

  it('merges lists entry by entry: both curators’ changes stay, and a removal holds', () => {
    const base: PlanPack = {
      ...pack,
      stageTemplates: [
        { id: 'kept', stages: ['Made-up kept'] },
        { id: 'mine', stages: ['Made-up mine'] },
        { id: 'gone', stages: ['Made-up gone'] },
        { id: 'dropped', stages: ['Made-up dropped'] },
      ],
    };
    const start = packStructureForm(base);
    const form = {
      ...start,
      templates: [
        { id: 'kept', stages: 'Made-up kept' },
        { id: 'mine', stages: 'My made-up stage' },
        { id: 'gone', stages: 'Made-up gone' },
        { id: 'added', stages: 'My made-up addition' },
      ],
    };
    const newer: PlanPack = {
      ...base,
      stageTemplates: [
        { id: 'kept', stages: ['Their made-up stage'] },
        { id: 'mine', stages: ['Their other stage'] },
        { id: 'dropped', stages: ['Made-up dropped'] },
        { id: 'theirs', stages: ['Their addition'] },
      ],
    };
    assert.deepEqual(rebasePackStructureForm(form, base, newer).templates, [
      { id: 'kept', stages: 'Their made-up stage' },
      { id: 'mine', stages: 'My made-up stage' },
      { id: 'added', stages: 'My made-up addition' },
      { id: 'theirs', stages: 'Their addition' },
    ]);
  });

  it('merges an activity field by field, and asks again for a count the other changed', () => {
    const start = packStructureForm(pack);
    const row = start.activities[0]!;
    const form = { ...start, activities: [{ ...row, name: { ar: 'اسم مختلق لي' }, retyped: '2' }] };
    const newer = { ...pack.activities![0]!, name: { ar: 'قراءة تجريبية', fr: 'Lecture inventée' }, sessions: 5 };
    assert.deepEqual(rebasePackStructureForm(form, pack, { ...pack, activities: [newer] }).activities, [
      { code: 'reading', name: { ar: 'اسم مختلق لي', fr: 'Lecture inventée' }, sessions: '5', retyped: '' },
    ]);
    const mine = { ...start, activities: [{ ...row, sessions: '7', retyped: '7' }] };
    assert.deepEqual(rebasePackStructureForm(mine, pack, { ...pack, activities: [newer] }).activities, [
      { code: 'reading', name: { ar: 'قراءة تجريبية', fr: 'Lecture inventée' }, sessions: '7', retyped: '7' },
    ]);
  });

  it('follows a repeated ID’s rows one by one, and reads a key or a name’s order as no change', () => {
    const base: PlanPack = { ...pack, stageTemplates: [{ id: 'a', stages: ['Made-up a'] }] };
    const start = packStructureForm(base);
    const newer: PlanPack = { ...base, stageTemplates: [{ id: 'a', stages: ['Their a'] }] };
    const both = { ...start, templates: [{ id: 'a', stages: 'My a' }, start.templates[0]!] };
    assert.deepEqual(rebasePackStructureForm(both, base, newer).templates, [
      { id: 'a', stages: 'My a' },
      { id: 'a', stages: 'Their a' },
    ]);
    const spaced = { ...start, templates: [{ id: 'a ', stages: 'Made-up a' }] };
    assert.deepEqual(rebasePackStructureForm(spaced, base, newer).templates[0]?.stages, 'Their a');
    assert.deepEqual(rebasePackStructureForm(spaced, base, { ...base, stageTemplates: [] }).templates, []);
    const named = { ...pack.activities![0]!, name: { fr: 'Lecture', ar: 'قراءة' } };
    const reordered = { ...pack, activities: [named] };
    const form = packStructureForm(reordered);
    const kept = { ...form, activities: [{ ...form.activities[0]!, name: { ar: 'قراءة', fr: 'Lecture' } }] };
    assert.deepEqual(rebasePackStructureForm(kept, reordered, { ...pack, activities: [] }).activities, []);
  });

  it('keeps a repeated ID and a renamed row in place, for the reader to judge', () => {
    const base: PlanPack = {
      ...pack,
      stageTemplates: [
        { id: 'a', stages: ['Made-up a'] },
        { id: 'b', stages: ['Made-up b'] },
      ],
    };
    const start = packStructureForm(base);
    const repeated = { ...start, templates: [...start.templates, { id: 'a', stages: 'My new a' }] };
    assert.deepEqual(rebasePackStructureForm(repeated, base, base).templates, [
      { id: 'a', stages: 'Made-up a' },
      { id: 'b', stages: 'Made-up b' },
      { id: 'a', stages: 'My new a' },
    ]);
    const renamed = { ...start, templates: [{ id: 'c', stages: 'Made-up a' }, start.templates[1]!] };
    assert.deepEqual(
      rebasePackStructureForm(renamed, base, base).templates.map((one) => one.id),
      ['c', 'b'],
    );
  });

  it('names the unit a pack’s budgets are in', () => {
    assert.equal(budgetUnitOf(pack), 'hours');
    assert.equal(budgetUnitOf({ ...pack, anchor: { kind: 'weeks' } }), null);
  });
});
