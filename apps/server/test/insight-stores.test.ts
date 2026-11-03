// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The observatories' store (#621, answer 676), in memory and in PostgreSQL: a
// world takes sendings only once its observatory is open, and only while the
// world exists; each is kept in the order first kept, one sent again with the
// same ID and token replacing the first in its place, one with another
// sending's ID but another token refused, and a world holds at most
// MAX_SENDINGS, even when two puts race for the last place, the sendings after
// a refusal not kept; a world's sendings are apart from another's and erased
// with it, and a world gone says so. Every world and sending here is made up.

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { MAX_SENDINGS } from '../src/insights/insight-store.js';
import { keptOf, madeUpSending } from './insights-kit.js';
import { KINDS, madeUpWorld, type Stores } from './store-kinds.js';

const sending = (at: number, teacher = 1) => keptOf(madeUpSending(at, teacher), `0a0b0c0d0a0b0c0d.${at}`);

for (const kind of KINDS) {
  describe(`the observatories’ store ${kind.name}`, { skip: kind.skip }, () => {
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

    it('takes sendings only into an open observatory of a world that exists', () =>
      withStores(async ({ insights }) => {
        assert.deepEqual(await insights.put('AAAAA', [sending(1)]), ['closed']);
        assert.equal(await insights.open('CCCCC'), false);
        assert.equal(await insights.open('AAAAA'), true);
        assert.equal(await insights.open('AAAAA'), true);
        assert.deepEqual(await insights.put('AAAAA', []), []);
        assert.deepEqual(await insights.put('AAAAA', [sending(1), sending(2)]), ['added', 'added']);
        assert.deepEqual(await insights.sendings('AAAAA'), [sending(1), sending(2)]);
        assert.deepEqual(await insights.sendings('BBBBB'), []);
      }));

    it('replaces a sending sent again with its token in its place, and refuses another token’s', () =>
      withStores(async ({ insights }) => {
        await insights.open('AAAAA');
        await insights.put('AAAAA', [sending(1), sending(2)]);
        const again = { ...sending(1), reached: 420 };
        assert.deepEqual(await insights.put('AAAAA', [again, sending(1, 2), sending(3)]), ['replaced', 'taken']);
        assert.deepEqual(await insights.sendings('AAAAA'), [again, sending(2)]);
      }));

    it('keeps at most MAX_SENDINGS a world, and erases them with the world', () =>
      withStores(async ({ worlds, insights }) => {
        await insights.open('BBBBB');
        await insights.open('AAAAA');
        const all = Array.from({ length: MAX_SENDINGS }, (_, at) => sending(at + 1));
        for (let at = 0; at < all.length; at += 256) {
          assert.ok((await insights.put('BBBBB', all.slice(at, at + 256))).every((one) => one === 'added'));
        }
        assert.deepEqual(await insights.put('BBBBB', [sending(1), sending(MAX_SENDINGS + 1)]), ['replaced', 'full']);
        assert.deepEqual(await insights.put('BBBBB', [sending(MAX_SENDINGS + 1)]), ['full']);
        assert.deepEqual(await insights.put('AAAAA', [sending(1)]), ['added']);
        await insights.forget(await worlds.sweep('2026-12-07'));
        assert.deepEqual(await insights.sendings('AAAAA'), []);
        assert.deepEqual(await insights.sendings('BBBBB'), []);
        assert.deepEqual(await insights.put('AAAAA', [sending(1)]), ['no-world']);
        assert.equal(await insights.open('AAAAA'), false);
      }));

    it('lets only one of two puts racing for the last place have it', () =>
      withStores(async ({ insights }) => {
        await insights.open('AAAAA');
        const all = Array.from({ length: MAX_SENDINGS - 1 }, (_, at) => sending(at + 1));
        for (let at = 0; at < all.length; at += 256) await insights.put('AAAAA', all.slice(at, at + 256));
        const raced = await Promise.all([
          insights.put('AAAAA', [sending(9001)]),
          insights.put('AAAAA', [sending(9002)]),
        ]);
        assert.deepEqual(raced.flat().sort(), ['added', 'full']);
        assert.equal((await insights.sendings('AAAAA')).length, MAX_SENDINGS);
      }));
  });
}
