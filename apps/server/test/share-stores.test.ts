// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The store of the schools' shares of the totals (#596, answer 628), in memory
// and in PostgreSQL: each world's shares for a day in the order first kept, a
// share sent again replacing the first in its place, apart from other days and
// worlds, up to MAX_SHARES a day, and erased with the world. Every world and
// share here is made up.

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { MAX_SHARES } from '../src/totals/share-store.js';
import { madeUpShare } from './share-kit.js';
import { KINDS, madeUpWorld, type Stores } from './store-kinds.js';

for (const kind of KINDS) {
  describe(`the shares’ store ${kind.name}`, { skip: kind.skip }, () => {
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

    it('keeps a day’s shares in order, replaces one sent again, apart from other days and worlds', () =>
      withStores(async ({ shares }) => {
        assert.equal(await shares.put('AAAAA', madeUpShare(1)), 'added');
        assert.equal(await shares.put('AAAAA', madeUpShare(2)), 'added');
        assert.equal(await shares.put('AAAAA', madeUpShare(1, '2026-12-06', 7)), 'replaced');
        assert.deepEqual(await shares.shares('AAAAA', '2026-12-06'), [madeUpShare(1, '2026-12-06', 7), madeUpShare(2)]);
        assert.equal(await shares.put('AAAAA', madeUpShare(1, '2026-12-20')), 'added');
        assert.deepEqual(await shares.shares('AAAAA', '2026-12-20'), [madeUpShare(1, '2026-12-20')]);
        assert.deepEqual(await shares.shares('BBBBB', '2026-12-06'), []);
      }));

    it('keeps at most MAX_SHARES a day, and erases them with the world', () =>
      withStores(async ({ worlds, shares }) => {
        for (let at = 1; at <= MAX_SHARES; at += 1) assert.equal(await shares.put('BBBBB', madeUpShare(at)), 'added');
        assert.equal(await shares.put('BBBBB', madeUpShare(MAX_SHARES + 1)), 'full');
        assert.equal(await shares.put('BBBBB', madeUpShare(1, '2026-12-06', 9)), 'replaced');
        assert.equal(await shares.put('BBBBB', madeUpShare(1, '2026-12-20')), 'added');
        assert.equal(await shares.put('AAAAA', madeUpShare(1)), 'added');
        await shares.forget(await worlds.sweep('2026-12-07'));
        assert.deepEqual(await shares.shares('AAAAA', '2026-12-06'), []);
        assert.deepEqual(await shares.shares('BBBBB', '2026-12-20'), []);
      }));
  });
}
