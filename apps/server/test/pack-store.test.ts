// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the pack desk keeps (#612), in both kinds of store: an account as its
// token's hash, and each release's steps by revision. All of it is made up.

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { PackStep } from '../src/packs/pack-rules.js';
import { MAX_PACK_STEPS } from '../src/packs/pack-store.js';
import { hashToken } from '../src/worlds/world-rules.js';
import { KINDS, madeUpWorld, type Stores } from './store-kinds.js';

const PACK = 'dz.cem.4am.arabic.made-up';
const DIGEST = 'A'.repeat(43);
const DATE = '2026-12-01';

for (const kind of KINDS) {
  describe(`the pack store, ${kind.name}`, { skip: kind.skip }, () => {
    let stores: Stores;
    const WORLD = 'S0001';
    const made = (revision: number, fields: Partial<PackStep> = {}): PackStep => ({
      id: PACK,
      release: '2026.1',
      stage: 'draft',
      status: 'community',
      digest: DIGEST,
      by: null,
      day: DATE,
      revision,
      role: 'curator',
      signature: 'c2lnbmVk',
      ...fields,
    });

    beforeEach(async () => {
      await kind.reset();
      stores = kind.open();
      await stores.worlds.add(madeUpWorld(WORLD));
    });

    afterEach(async () => {
      await stores.close();
    });

    it('keeps an account as a hash, one for each role, and none without the world', async () => {
      assert.equal(await stores.packs.setAccount(WORLD, 'curator', hashToken('first')), true);
      assert.equal(await stores.packs.accountRole(WORLD, hashToken('first')), 'curator');
      await stores.packs.setAccount(WORLD, 'curator', hashToken('second'));
      assert.equal(await stores.packs.accountRole(WORLD, hashToken('first')), undefined);
      assert.equal(await stores.packs.setAccount('S9999', 'curator', hashToken('x')), false);
    });

    it('keeps steps by revision, and one taken again drops what followed', async () => {
      await stores.packs.putStep(WORLD, made(1));
      await stores.packs.putStep(WORLD, made(2, { stage: 'under-review' }));
      await stores.packs.putStep(WORLD, made(1, { release: '2026.2' }));
      assert.equal((await stores.packs.stepAt(WORLD, PACK, '2026.1', 2))?.stage, 'under-review');
      assert.equal((await stores.packs.latestStep(WORLD, PACK, '2026.1'))?.revision, 2);
      const latest = await stores.packs.latestSteps(WORLD);
      assert.deepEqual(
        latest.map((one) => [one.release, one.revision]),
        [
          ['2026.1', 2],
          ['2026.2', 1],
        ],
      );
      assert.equal(await stores.packs.putStep(WORLD, made(1, { digest: 'B'.repeat(43) })), 'kept');
      assert.equal(await stores.packs.stepAt(WORLD, PACK, '2026.1', 2), undefined);
      assert.deepEqual(await stores.packs.stepAt(WORLD, PACK, '2026.1', 1), made(1, { digest: 'B'.repeat(43) }));
    });

    it('takes no step without the world', async () => {
      assert.equal(await stores.packs.putStep('S9999', made(1)), 'no-world');
    });

    it('takes none past the cap', { skip: kind.name !== 'in memory' }, async () => {
      for (let revision = 1; revision <= MAX_PACK_STEPS; revision += 1)
        await stores.packs.putStep(WORLD, made(revision));
      assert.equal(await stores.packs.putStep(WORLD, made(MAX_PACK_STEPS + 1)), 'full');
      assert.equal(await stores.packs.putStep(WORLD, made(MAX_PACK_STEPS)), 'kept');
    });

    it('forgets an erased world', async () => {
      await stores.packs.setAccount(WORLD, 'ministry', hashToken('gone'));
      await stores.packs.putStep(WORLD, made(1));
      await stores.worlds.sweep('2027-01-01');
      await stores.packs.forget([WORLD]);
      assert.equal(await stores.packs.accountRole(WORLD, hashToken('gone')), undefined);
      assert.deepEqual(await stores.packs.latestSteps(WORLD), []);
    });
  });
}
