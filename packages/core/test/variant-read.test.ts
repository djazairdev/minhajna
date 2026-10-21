// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Layer files (#226, answers 337 and 338): a district layer only in a file
// signed by a key that may sign packs, a school layer only as it is, built
// by the coordinator from one class's changes. Made-up layers and keys only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addedId,
  addedLayerHolds,
  addLayer,
  courseSetup,
  layerFile,
  layerFromChanges,
  layerKey,
  LAYER_BYTES,
  PLAN_LAYER_FORMAT,
  queueItems,
  readLayerFile,
  switchLayer,
  type LayerRead,
} from '../src/index.ts';
import { cemEvents, contextOf, d, mathPack, openBook, reference } from './fixtures.ts';
import { change, day, made } from './plan-change-fixtures.ts';
import { makeTestKey, nodeVerifier, signedFile } from './signed-fixtures.ts';

const key = makeTestKey();
const payload = (fields: Record<string, unknown> = {}) => ({
  format: PLAN_LAYER_FORMAT,
  version: { major: 1, minor: 0 },
  country: 'dz',
  level: 'school',
  id: 'example-school',
  pack: mathPack.id,
  title: 'Made-up school layer',
  by: 'Made-up coordinator',
  made: '2026-09-28',
  operations: [{ kind: 'budget', item: 'l3', sessions: 2 }],
  ...fields,
});
const read = (text: string, keys = [key.trusted]) => readLayerFile(text, keys, nodeVerifier, reference.country);
const problem = (result: LayerRead) => (result.ok ? 'ok' : result.problem);

describe('Layer files', () => {
  it('checks again a layer that came from another device or a backup', async () => {
    const text = signedFile(key, payload({ level: 'district', id: 'example-district' }));
    const district = await read(text);
    assert.ok(district.ok);
    const holds = (added: typeof district.added) =>
      addedLayerHolds(added, [key.trusted], nodeVerifier, reference.country);
    assert.equal(await holds(district.added), true);
    const changed = { ...district.added.layer, operations: [{ kind: 'skip' as const, item: 'l1' }] };
    assert.equal(await holds({ ...district.added, layer: changed }), false);
    assert.equal(await holds({ layer: district.added.layer }), false);
    assert.equal(
      await holds({ ...district.added, signed: { ...district.added.signed!, key: 'example-other' } }),
      false,
    );
    const school = await read(JSON.stringify(payload()));
    assert.ok(school.ok);
    assert.equal(await holds(school.added), true);
    assert.equal(await holds({ ...school.added, signed: { key: key.trusted.id, file: text } }), false);
    assert.equal(await holds({ layer: { ...school.added.layer, title: 'Two\nlines' } }), false);
  });

  it('writes no school layer file another teacher could not read', async () => {
    const school = await read(JSON.stringify(payload()));
    assert.ok(school.ok);
    const write = (fields: object) => layerFile({ ...school.added.layer, ...fields }, reference.country);
    assert.notEqual(write({}), null);
    assert.equal(write({ level: 'district' }), null);
    assert.equal(write({ title: 'Two\nlines' }), null);
    assert.equal(write({ operations: Array.from({ length: 201 }, () => ({ kind: 'skip', item: 'l3' })) }), null);
    assert.equal(write({ operations: [{ kind: 'skip', item: 'x'.repeat(257) }] }), null);
  });

  it('reads a school layer as it is, and a district layer only signed', async () => {
    const school = await read(JSON.stringify(payload({ note: 'Made-up note' })));
    assert.ok(school.ok);
    assert.equal(school.added.layer.note, 'Made-up note');
    assert.equal(school.added.signed, undefined);
    const text = signedFile(key, payload({ level: 'district', id: 'example-district' }));
    const district = await read(text);
    assert.ok(district.ok);
    assert.deepEqual(district.added.signed, { key: key.trusted.id, file: text });
    assert.equal(district.signer?.id, key.trusted.id);
    assert.equal(problem(await read(JSON.stringify(payload({ level: 'district' })))), 'level');
    assert.equal(problem(await read(signedFile(key, payload()))), 'level');
  });

  it('refuses a district layer a key may not sign, or one it does not know or that was changed', async () => {
    const district = payload({ level: 'district', id: 'example-district' });
    const calendarOnly = makeTestKey('example-calendar', ['calendar']);
    assert.equal(problem(await read(signedFile(calendarOnly, district), [calendarOnly.trusted])), 'signer');
    assert.equal(problem(await read(signedFile(key, district), [])), 'unknown-key');
    const changed = JSON.parse(signedFile(key, district)) as { payload: string };
    changed.payload = changed.payload.replace('l3', 'l4');
    assert.equal(problem(await read(JSON.stringify(changed))), 'signature');
    assert.equal(problem(await read(signedFile(key, { ...district, version: { major: 2, minor: 0 } }))), 'version');
  });

  it('checks every field, and never reads a file over its size', async () => {
    const refused = async (fields: Record<string, unknown>) => problem(await read(JSON.stringify(payload(fields))));
    assert.equal(await refused({ format: 'minhajna.plan-pack' }), 'invalid');
    assert.equal(await refused({ version: { major: 2, minor: 0 } }), 'version');
    for (const fields of [
      { country: 'tn' },
      { pack: 'tn.cem.1am.math.example' },
      { pack: 'not a pack' },
      { id: 'Example' },
      { id: 'ab' },
      { title: 'Two\nlines' },
      { title: 'Made-up \u202eflip' },
      { by: undefined },
      { note: 'x'.repeat(501) },
      { made: '28/09/2026' },
      { operations: [] },
      { operations: [{ kind: 'undo', change: 'c1' }] },
      { operations: [{ kind: 'budget', item: 'l3', sessions: 61 }] },
      { operations: [{ kind: 'budget', item: 'l 3', sessions: 2 }] },
      { operations: [{ kind: 'move', item: 'l3' }] },
      { operations: [{ kind: 'split', item: 'l3', titles: ['One'] }] },
      { operations: [{ kind: 'add', title: '', sessions: 1, before: null }] },
      { operations: [{ kind: 'join', items: ['l3', 'l3'] }] },
      { operations: [{ kind: 'join', items: ['l3', 4] }] },
      { operations: Array.from({ length: 201 }, () => ({ kind: 'skip', item: 'l3' })) },
    ])
      assert.equal(await refused(fields), 'payload', JSON.stringify(fields).slice(0, 80));
    const big = JSON.stringify(payload({ note: 'x'.repeat(400), title: 'y'.repeat(150) })).padEnd(LAYER_BYTES + 1);
    assert.equal(problem(await read(big)), 'invalid');
    assert.equal(problem(await read('not json')), 'invalid');
  });

  it('keeps only the format fields of each operation', async () => {
    const result = await read(
      JSON.stringify(
        payload({ operations: [{ kind: 'move', item: 'l5', before: null, align: 'class-x', extra: true }] }),
      ),
    );
    assert.ok(result.ok);
    assert.deepEqual(result.added.layer.operations, [{ kind: 'move', item: 'l5', before: null }]);
  });

  it("builds a school layer from a class's changes, which another class reads to the same plan", async () => {
    const book = await openBook(cemEvents());
    const context = await change(
      book,
      { ...made, id: 'a1', kind: 'add', title: 'Made-up review', sessions: 1, before: 'l3' },
      { ...made, id: 'm1', kind: 'move', item: addedId('a1'), before: 'l2', align: 'class-x' },
      { ...made, id: 's1', kind: 'split', item: addedId('a1'), titles: ['Review one', 'Review two'] },
      { ...made, id: 'u1', kind: 'undo', change: 's1' },
      { ...made, id: 'k1', kind: 'skip', item: 'l7' },
    );
    const id = 'f'.repeat(32);
    const about = { id, title: 'Made-up school layer', by: 'Made-up coordinator', made: d('2026-09-28') };
    const layer = layerFromChanges(context, 'c-math', about);
    assert.deepEqual(layer.operations, [
      { kind: 'add', title: 'Made-up review', sessions: 1, before: 'l3' },
      { kind: 'move', item: addedId(`s.${id}.1`), before: 'l2' },
      { kind: 'skip', item: 'l7' },
    ]);
    const result = await read(layerFile(layer, reference.country)!);
    assert.ok(result.ok);
    assert.deepEqual(result.added.layer, layer);
    const other = await openBook(cemEvents());
    await other.record(day, addLayer(other.state, result.added));
    await other.record(day, switchLayer(other.state, 'c-math', 'school', layerKey(layer)));
    const main = (pack = courseSetup(contextOf(other), 'c-math').pack!) =>
      queueItems(pack, 'main').map((one) => one.id);
    const mine = queueItems(courseSetup(context, 'c-math').pack!, 'main').map((one) => one.id);
    assert.deepEqual(
      main(),
      mine.map((one) => (one === addedId('a1') ? addedId(`s.${id}.1`) : one)),
    );
    const empty = await openBook(cemEvents());
    assert.throws(() => layerFromChanges(contextOf(empty), 'c-math', about), RangeError);
  });
});
