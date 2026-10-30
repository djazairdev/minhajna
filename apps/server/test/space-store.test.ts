// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The relay's memory store (#541): spaces kept apart by world, and the caps
// on a world's spaces and batches.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_BATCHES, MAX_SPACES, MemorySpaceStore } from '../src/spaces/space-store.js';

describe('the space store', () => {
  it('keeps each world’s spaces apart', async () => {
    const store = new MemorySpaceStore();
    assert.equal(await store.addSpace('AAAAA', 'space-one', 'school'), 'added');
    assert.equal(await store.kindOf('AAAAA', 'space-one'), 'school');
    assert.equal(await store.kindOf('BBBBB', 'space-one'), undefined);
    assert.equal(await store.addBatches('BBBBB', 'space-one', 'stream', 0, [new Uint8Array(1)]), 'full');
    assert.deepEqual(await store.batchesAfter('BBBBB', 'space-one', 0, 10), []);
  });

  it('numbers each stream’s batches from 0 with no gap', async () => {
    const store = new MemorySpaceStore();
    await store.addSpace('AAAAA', 'space-one', 'school');
    const one = [new Uint8Array(1)];
    assert.equal(await store.addBatches('AAAAA', 'space-one', 'stream', 1, one), 'gap');
    assert.equal(await store.addBatches('AAAAA', 'space-one', 'stream', 0, [...one, ...one]), 'added');
    assert.equal(await store.addBatches('AAAAA', 'space-one', 'stream', 1, one), 'taken');
    assert.equal(await store.addBatches('AAAAA', 'space-one', 'stream', 3, one), 'gap');
    assert.equal(await store.nextNumber('AAAAA', 'space-one', 'stream'), 2);
    assert.equal(await store.nextNumber('AAAAA', 'space-one', 'other'), 0);
    assert.equal(await store.addBatches('AAAAA', 'space-one', 'other', 0, one), 'added');
  });

  it('caps what the whole server holds', async () => {
    const store = new MemorySpaceStore(3);
    await store.addSpace('AAAAA', 'space-one', 'school');
    await store.addSpace('BBBBB', 'space-one', 'school');
    assert.equal(await store.addBatches('AAAAA', 'space-one', 's', 0, [new Uint8Array(1), new Uint8Array(1)]), 'added');
    assert.equal(
      await store.addBatches('BBBBB', 'space-one', 's', 0, [new Uint8Array(1), new Uint8Array(1)]),
      'server-full',
    );
    assert.equal(await store.addBatches('BBBBB', 'space-one', 's', 0, [new Uint8Array(1)]), 'added');
  });

  it('caps a world’s spaces and batches', async () => {
    const store = new MemorySpaceStore();
    for (let index = 0; index < MAX_SPACES; index++) await store.addSpace('AAAAA', `space-${index}`, 'school');
    assert.equal(await store.addSpace('AAAAA', 'one-too-many', 'school'), 'full');
    assert.equal(await store.addSpace('AAAAA', 'space-0', 'school'), 'same');
    assert.equal(await store.addSpace('BBBBB', 'one-too-many', 'school'), 'added');
    const chunk = Array.from({ length: 10_000 }, () => new Uint8Array(1));
    for (let first = 0; first < MAX_BATCHES; first += chunk.length) {
      assert.equal(await store.addBatches('AAAAA', 'space-0', 'stream', first, chunk), 'added');
    }
    assert.equal(await store.addBatches('AAAAA', 'space-1', 'stream', 0, [new Uint8Array(1)]), 'full');
    assert.equal(await store.addBatches('BBBBB', 'one-too-many', 'stream', 0, [new Uint8Array(1)]), 'added');
  });
});
