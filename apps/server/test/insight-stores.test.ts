// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The observatories' store (#621, #626, answers 676 and 678), in memory and
// in PostgreSQL: a world takes sendings only once its observatory is open, and
// only while the world exists; each is kept in the order first kept, one sent
// again with the same ID and token replacing the first in its place, one with
// another sending's ID but another token refused, and a world holds at most
// MAX_SENDINGS, even when two puts race for the last place, the sendings after
// a refusal not kept; a world's sendings are apart from another's and erased
// with it, and a world gone says so. A term's collection ends once for good,
// a put racing the end either kept before it or refused, no sending of it kept
// or replaced after, nor one replacing a sending of it; its figures formed
// once, even by two at once, of its own sendings, only after it ended, and
// kept by pack as formed, those of packs the nation's figure hides left out;
// a world ends at most 12 terms, and its ends go with it. Every world and
// sending here is made up.

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { termFigures } from '../src/insights/figures.js';
import { MAX_SENDINGS, type Term } from '../src/insights/insight-store.js';
import type { KeptSending } from '../src/insights/sending-read.js';
import { keptOf, madeUpSending } from './insights-kit.js';
import { KINDS, madeUpWorld, type Stores } from './store-kinds.js';

const first: Term = { year: '2027-2028', term: 1 };
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

    it('ends a term once for good, so no sending of it is kept or replaced, nor one with a sending of it', () =>
      withStores(async ({ worlds, insights }) => {
        assert.equal(await insights.end('AAAAA', first), 'closed');
        assert.equal(await insights.end('CCCCC', first), 'no-world');
        await insights.open('AAAAA');
        await insights.put('AAAAA', [sending(1), { ...sending(2), term: 2 }]);
        assert.equal(await insights.figures('AAAAA', first), undefined);
        const [ended, raced] = await Promise.all([insights.end('AAAAA', first), insights.put('AAAAA', [sending(3)])]);
        assert.equal(ended, 'ended');
        assert.equal(await insights.end('AAAAA', first), 'ended');
        assert.equal(await insights.figures('AAAAA', first), 'forming');
        assert.deepEqual(await insights.put('AAAAA', [sending(4)]), ['ended']);
        assert.deepEqual(await insights.put('AAAAA', [{ ...sending(1), reached: 999 }]), ['ended']);
        assert.deepEqual(await insights.put('AAAAA', [{ ...sending(1), term: 2 }]), ['ended']);
        assert.deepEqual(await insights.put('AAAAA', [{ ...sending(2), term: 1 }]), ['ended']);
        assert.deepEqual(await insights.put('AAAAA', [sending(1, 2)]), ['taken']);
        assert.deepEqual(
          await insights.put('AAAAA', [{ ...sending(5), term: 2 }, sending(6), { ...sending(7), term: 2 }]),
          ['added', 'ended'],
        );
        const ofTerm = (await insights.sendings('AAAAA')).filter((one) => one.term === 1).map((one) => one.id);
        assert.deepEqual(ofTerm, raced[0] === 'added' ? [sending(1).id, sending(3).id] : [sending(1).id]);
        let formed: string[] = [];
        const form = (sendings: KeptSending[]) => {
          formed = sendings.map((one) => one.id);
          return termFigures(sendings, first.year, first.term);
        };
        await Promise.all([insights.form('AAAAA', first, form), insights.form('AAAAA', first, form)]);
        assert.deepEqual(formed, ofTerm);
        await insights.form('AAAAA', first, () => assert.fail('formed twice'));
        await insights.form('AAAAA', { ...first, term: 2 }, () => assert.fail('formed while open'));
        await insights.forget(await worlds.sweep('2026-12-07'));
        assert.equal(await insights.figures('AAAAA', first), undefined);
      }));

    it('keeps the figures of the packs the nation shows, by pack, as formed, and ends at most 12 terms', () =>
      withStores(async ({ insights }) => {
        await insights.open('AAAAA');
        const many = Array.from({ length: 24 }, (_, at) => ({
          ...keptOf(madeUpSending(at + 1, at + 1), `0a0b0c0d0a0b0c0d.${at % 4}`),
          wilaya: at % 2 === 0 ? '16' : '31',
          reached: 300 + at,
        }));
        const few = { ...keptOf(madeUpSending(99, 99), '0a0b0c0d0a0b0c0d.9'), pack: 'dz.cem.4am.arabic.other' };
        await insights.put('AAAAA', [...many, few]);
        await insights.end('AAAAA', first);
        const figures = termFigures([...many, few], first.year, first.term);
        await insights.form('AAAAA', first, () => figures);
        assert.deepEqual(await insights.figures('AAAAA', first), [
          { grade: '4am', subject: 'arabic', pack: 'dz.cem.4am.arabic.made-up', release: '2027.1' },
        ]);
        const kept = await insights.pack('AAAAA', first, 0);
        assert.equal(figures[1]?.nation, null);
        assert.equal(JSON.stringify(kept), JSON.stringify(figures[0]));
        assert.equal(await insights.pack('AAAAA', first, 1), undefined);
        assert.equal(await insights.pack('AAAAA', { ...first, term: 2 }, 0), undefined);
        const ends: string[] = [];
        for (let year = 2028; year < 2032; year += 1) {
          for (const term of [1, 2, 3]) ends.push(await insights.end('AAAAA', { year: `${year}-${year + 1}`, term }));
        }
        assert.deepEqual(ends, [...Array<string>(11).fill('ended'), 'full']);
        assert.equal(await insights.end('AAAAA', first), 'ended');
      }));
  });
}
