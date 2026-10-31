// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The stand-in receiving system's store (#590, answer 618), in memory and in
// PostgreSQL: each world's receiving key read without making it, made once,
// apart from its CA key and its world, and erased with it; its receipts newest
// first, each once, apart from other worlds, up to MAX_RECEIPTS, and erased
// with it. Every world and receipt here is made up.

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { MAX_RECEIPTS, type Receipt } from '../src/worlds/world-store.js';
import { KINDS, madeUpWorld, type Stores } from './store-kinds.js';

const receipt = (at: number, term = 1): Receipt => ({
  standIn: true,
  id: at.toString(16).padStart(32, '0'),
  kind: 'marks',
  term,
  class: '1م2',
  subject: 'math',
  rows: 30,
  signed: '2026-11-29',
  received: '2026-12-01',
  signer: 'a'.repeat(32),
});

for (const kind of KINDS) {
  describe(`the stand-in receiving system’s store ${kind.name}`, { skip: kind.skip }, () => {
    beforeEach(kind.reset);

    async function withStores(test: (stores: Stores) => Promise<void>): Promise<void> {
      const stores = kind.open();
      try {
        for (const id of ['AAAAA', 'BBBBB']) assert.equal(await stores.worlds.add(madeUpWorld(id)), true);
        await test(stores);
      } finally {
        await stores.close();
      }
    }

    it('makes a world’s receiving key once, apart from its CA key and the world, and erases it with the world', () =>
      withStores(async ({ worlds }) => {
        assert.deepEqual([await worlds.receiverKey('AAAAA'), await worlds.caKey('AAAAA')], [undefined, undefined]);
        assert.equal(await worlds.receiverKey('AAAAA', () => 'first-key'), 'first-key');
        assert.equal(await worlds.receiverKey('AAAAA'), 'first-key');
        assert.equal(await worlds.receiverKey('AAAAA', () => 'second-key'), 'first-key');
        assert.equal(await worlds.caKey('AAAAA', () => 'ca-key'), 'ca-key');
        assert.equal(await worlds.receiverKey('BBBBB', () => 'other-key'), 'other-key');
        assert.equal(await worlds.receiverKey('CCCCC', () => 'no-world'), undefined);
        assert.deepEqual(await worlds.get('AAAAA'), madeUpWorld('AAAAA'));
        await worlds.sweep('2026-12-07');
        assert.equal(await worlds.receiverKey('AAAAA', () => 'after'), undefined);
      }));

    it('keeps a world’s receipts newest first, apart from other worlds, up to the cap, and erases them', () =>
      withStores(async ({ worlds }) => {
        assert.equal(await worlds.addReceipt('AAAAA', receipt(1)), 'added');
        assert.equal(await worlds.addReceipt('AAAAA', receipt(2, 2)), 'added');
        assert.equal(await worlds.addReceipt('AAAAA', receipt(2, 2)), 'kept');
        assert.deepEqual(await worlds.receipts('AAAAA'), [receipt(2, 2), receipt(1)]);
        assert.deepEqual(await worlds.receipts('BBBBB'), []);
        assert.equal(await worlds.addReceipt('CCCCC', receipt(3)), 'no-world');
        for (let at = 1; at < MAX_RECEIPTS; at += 1) await worlds.addReceipt('BBBBB', receipt(at));
        assert.equal(await worlds.addReceipt('BBBBB', receipt(1)), 'kept');
        assert.equal(await worlds.addReceipt('BBBBB', receipt(MAX_RECEIPTS)), 'added');
        assert.equal(await worlds.addReceipt('BBBBB', receipt(MAX_RECEIPTS + 1)), 'full');
        await worlds.sweep('2026-12-07');
        assert.deepEqual(await worlds.receipts('AAAAA'), []);
        assert.equal(await worlds.addReceipt('AAAAA', receipt(4)), 'no-world');
      }));
  });
}
