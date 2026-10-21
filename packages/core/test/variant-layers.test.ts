// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// District and school layers (#226, answers 337 and 338): operations over
// the pack, switched on class by class, applied district first, then
// school, then the class's own changes. Made-up layers only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addedId,
  addLayer,
  budgetInSessions,
  courseLayers,
  courseSetup,
  findPackItem,
  joinsOf,
  layerAddStatus,
  layerKey,
  opId,
  partId,
  queueItems,
  recordsForRoute,
  skippedBy,
  switchLayer,
  type Context,
  type LayerLevel,
  type LayerOp,
  type PlanLayer,
  type RecordBook,
} from '../src/index.ts';
import { cemEvents, contextOf, d, mathPack, openBook } from './fixtures.ts';
import { change, day, made } from './plan-change-fixtures.ts';

const layer = (level: LayerLevel, id: string, operations: LayerOp[], pack = mathPack.id): PlanLayer => ({
  level,
  id,
  pack,
  title: `Made-up ${level} layer`,
  by: 'Made-up author',
  made: d('2026-09-28'),
  operations,
});

const signed = { key: 'example-ministry', file: '{}' };

/** Takes the layers in, then switches each on for 1AM1. */
async function withLayers(book: RecordBook, ...layers: PlanLayer[]): Promise<Context> {
  for (const one of layers) {
    const added = one.level === 'district' ? { layer: one, signed } : { layer: one };
    await book.record(day, addLayer(book.state, added));
  }
  for (const one of layers) await book.record(day, switchLayer(book.state, 'c-math', one.level, layerKey(one)));
  return contextOf(book);
}

const plan = (context: Context) => courseSetup(context, 'c-math').pack!;
const ids = (context: Context) => queueItems(plan(context), 'main').map((item) => item.id);
const sessionsOf = (context: Context, id: string) => {
  const { pack, sessionMinutes } = courseSetup(context, 'c-math');
  return budgetInSessions(
    pack!,
    pack!.items.find((item) => item.id === id)!,
    sessionMinutes,
  );
};

describe('District and school layers', () => {
  it('changes no class until switched on, and then only that class', async () => {
    const book = await openBook(cemEvents());
    const before = ids(contextOf(book));
    const district = layer('district', 'example-district', [{ kind: 'move', item: 'l5', before: 'l2' }]);
    await book.record(day, addLayer(book.state, { layer: district, signed }));
    assert.deepEqual(ids(contextOf(book)), before);
    const context = await withLayers(book);
    assert.deepEqual(ids(context), before);
    await book.record(day, switchLayer(book.state, 'c-math', 'district', layerKey(district)));
    const after = ids(contextOf(book));
    assert.deepEqual(after.slice(after.indexOf('l1'), after.indexOf('l1') + 3), ['l1', 'l5', 'l2']);
    assert.equal(plan(contextOf(book)).items.find((item) => item.id === 'l5')?.unit, 'u1');
    await book.record(day, switchLayer(book.state, 'c-math', 'district', null));
    assert.deepEqual(ids(contextOf(book)), before);
  });

  it('applies the district layer, then the school layer, then the class own changes', async () => {
    const book = await openBook(cemEvents());
    const district = layer('district', 'example-district', [{ kind: 'budget', item: 'l3', sessions: 3 }]);
    const school = layer('school', 'example-school', [{ kind: 'budget', item: 'l3', sessions: 4 }]);
    let context = await withLayers(book, school, district);
    assert.deepEqual(
      courseLayers(context.state, 'c-math').on.map((one) => one.level),
      ['district', 'school'],
    );
    assert.equal(sessionsOf(context, 'l3'), 4);
    context = await change(book, { ...made, id: 'b1', kind: 'budget', item: 'l3', sessions: 2 });
    assert.equal(sessionsOf(context, 'l3'), 2);
  });

  it('names what a layer adds or splits by the layer, and lets its later operations reach them', async () => {
    const book = await openBook(cemEvents());
    const school = layer('school', 'example-school', [
      { kind: 'add', title: 'Made-up review', sessions: 1, before: 'l3' },
      { kind: 'split', item: 'l1', titles: ['Reading', 'Writing'] },
      { kind: 'move', item: addedId(opId({ level: 'school', id: 'example-school' }, 0)), before: 'l2' },
    ]);
    const context = await withLayers(book, school);
    const added = addedId('s.example-school.1');
    const parts = [1, 2].map((n) => partId('l1', 's.example-school.2', n as 1 | 2));
    const main = ids(context);
    assert.deepEqual(main.slice(main.indexOf(parts[0]!), main.indexOf(parts[0]!) + 4), [...parts, added, 'l2']);
    assert.equal(findPackItem(plan(context), parts[1]!)?.title, 'Writing');
  });

  it('keeps the titles of what a layer made once it is switched off', async () => {
    const book = await openBook(cemEvents());
    const school = layer('school', 'example-school', [
      { kind: 'add', title: 'Made-up review', sessions: 1, before: null },
    ]);
    await withLayers(book, school);
    await book.record(day, switchLayer(book.state, 'c-math', 'school', null));
    const pack = plan(contextOf(book));
    assert.ok(!pack.items.some((item) => item.id === addedId('s.example-school.1')));
    assert.equal(findPackItem(pack, addedId('s.example-school.1'))?.title, 'Made-up review');
  });

  it('skips and joins from a layer, each once beside the class own', async () => {
    const book = await openBook(cemEvents());
    const district = layer('district', 'example-district', [
      { kind: 'skip', item: 'l7' },
      { kind: 'join', items: ['l3', 'l4'] },
    ]);
    let context = await withLayers(book, district);
    assert.deepEqual(skippedBy(plan(context), context.state.decisions, 'c-math'), ['l7']);
    assert.deepEqual(joinsOf(plan(context), context.state.decisions, 'c-math'), [['l3', 'l4']]);
    context = await change(book, { ...made, id: 'k1', kind: 'skip', item: 'l7' });
    assert.deepEqual(skippedBy(plan(context), context.state.decisions, 'c-math'), ['l7']);
  });

  it('leaves out what no longer fits, and a split of an item an exam-window answer names', async () => {
    const book = await openBook(cemEvents());
    await book.record(day, {
      kind: 'plan.decided',
      decision: { id: 'x1', courseId: 'c-math', kind: 'leave-out', item: 'l6' },
    });
    const before = ids(contextOf(book));
    const school = layer('school', 'example-school', [
      { kind: 'split', item: 'l6', titles: ['One', 'Two'] },
      { kind: 'move', item: 'gone', before: 'l2' },
      { kind: 'budget', item: 'l3', sessions: 2 },
    ]);
    const context = await withLayers(book, school);
    assert.deepEqual(ids(context), before);
    assert.equal(sessionsOf(context, 'l3'), 2);
  });

  it('holds one layer at each level for a class, and only of its own pack', async () => {
    const book = await openBook(cemEvents());
    const first = layer('school', 'example-first', [{ kind: 'budget', item: 'l3', sessions: 2 }]);
    const second = layer('school', 'example-second', [{ kind: 'budget', item: 'l3', sessions: 5 }]);
    const other = layer('school', 'example-other', [{ kind: 'skip', item: 'l1' }], 'dz.cem.2am.math.example');
    let context = await withLayers(book, first, second);
    assert.deepEqual(
      courseLayers(context.state, 'c-math').on.map((one) => one.id),
      ['example-second'],
    );
    assert.equal(sessionsOf(context, 'l3'), 5);
    await book.record(day, addLayer(book.state, { layer: other }));
    context = contextOf(book);
    assert.throws(() => switchLayer(context.state, 'c-math', 'school', layerKey(other)), RangeError);
    assert.throws(() => switchLayer(context.state, 'c-math', 'district', layerKey(first)), RangeError);
    assert.throws(() => switchLayer(context.state, 'c-math', 'school', 'school:missing'), RangeError);
    assert.deepEqual(
      courseLayers(context.state, 'c-math').known.map((one) => one.id),
      ['example-first', 'example-second'],
    );
  });

  it('takes a layer in once, a district layer only with its signed file', async () => {
    const book = await openBook(cemEvents());
    const school = layer('school', 'example-school', [{ kind: 'skip', item: 'l7' }]);
    await book.record(day, addLayer(book.state, { layer: school }));
    assert.throws(() => addLayer(book.state, { layer: { ...school, title: 'Changed' } }), RangeError);
    const district = layer('district', 'example-district', [{ kind: 'skip', item: 'l7' }]);
    assert.throws(() => addLayer(book.state, { layer: district }), RangeError);
    assert.throws(() => addLayer(book.state, { layer: school, signed }), RangeError);
    assert.equal(layerAddStatus(book.state, school), 'held');
    assert.equal(layerAddStatus(book.state, { ...school, title: 'Changed' }), 'clash');
    assert.equal(layerAddStatus(book.state, district), 'new');
    await book.record(day, { kind: 'layer.added', added: { layer: district } });
    assert.equal(book.state.layers.length, 1);
  });

  it('keeps the first layer under an ID, and passes layers and switches on in a handover', async () => {
    const book = await openBook(cemEvents());
    const school = layer('school', 'example-school', [{ kind: 'skip', item: 'l7' }]);
    await withLayers(book, school);
    await book.record(day, { kind: 'layer.added', added: { layer: { ...school, title: 'Changed' } } });
    assert.equal(book.state.layers.length, 1);
    assert.equal(book.state.layers[0]?.layer.title, school.title);
    const records = recordsForRoute(book.state, 'handover');
    assert.deepEqual(
      records.filter((one) => one.kind.startsWith('layer.')),
      [
        { kind: 'layer.added', added: { layer: school } },
        { kind: 'layer.switched', switched: { courseId: 'c-math', level: 'school', layer: 'school:example-school' } },
      ],
    );
  });
});
