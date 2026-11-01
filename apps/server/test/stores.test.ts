// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The world and space stores (#541, #542, #554), from store-kinds.ts: the same
// rules, caps, stand-in CA keys and sweep for the memory stores and
// PostgreSQL's, which run against the database named by TEST_DATABASE_URL,
// emptied before each test, and are skipped without it; CI always sets it. Then
// a world kept in PostgreSQL outliving a restart of the server. Every world
// here is made up.

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { beforeEach, describe, it } from 'node:test';
import pg from 'pg';
import { SEALED_BATCH_BYTES } from '../src/spaces/space-rules.js';
import { MAX_BATCHES, MAX_SPACES, StoreBusy } from '../src/spaces/space-store.js';
import { PrismaStores } from '../src/storage/prisma-stores.js';
import { createApp } from '../src/app.js';
import { emptyDatabase, KINDS, madeUpWorld, url, type Stores } from './store-kinds.js';

const one = [new Uint8Array([1])];

for (const kind of KINDS) {
  describe(`the stores ${kind.name}`, { skip: kind.skip }, () => {
    beforeEach(kind.reset);

    async function withStores(test: (stores: Stores) => Promise<void>, most?: number): Promise<void> {
      const stores = kind.open(most);
      try {
        for (const id of ['AAAAA', 'BBBBB']) assert.equal(await stores.worlds.add(madeUpWorld(id)), true);
        await test(stores);
      } finally {
        await stores.close();
      }
    }

    it('keeps a world as it was started, once per id, and moves its date and announced days', () =>
      withStores(async ({ worlds }) => {
        assert.deepEqual(await worlds.get('AAAAA'), madeUpWorld('AAAAA'));
        assert.equal(await worlds.add(madeUpWorld('AAAAA', '2027-01-01')), false);
        assert.equal(await worlds.get('CCCCC'), undefined);
        const was = madeUpWorld('AAAAA');
        assert.equal(await worlds.setDate('AAAAA', '2026-12-06', { ...was, announcedDays: ['2026-12-06'] }), false);
        assert.equal(await worlds.setDate('AAAAA', '2026-12-06', { ...was, date: '2026-11-30' }), false);
        assert.equal(await worlds.setDate('AAAAA', '2026-12-06', was), true);
        assert.equal((await worlds.get('AAAAA'))?.date, '2026-12-06');
        assert.equal(await worlds.setDate('CCCCC', '2026-12-06', was), false);
        assert.equal(await worlds.setAnnouncedDays('AAAAA', '2026-12-01', ['2026-12-13']), false);
        assert.equal(await worlds.setAnnouncedDays('AAAAA', '2026-12-06', ['2026-12-13', '2027-01-10']), true);
        assert.deepEqual((await worlds.get('AAAAA'))?.announcedDays, ['2026-12-13', '2027-01-10']);
        assert.deepEqual(await worlds.get('BBBBB'), madeUpWorld('BBBBB'));
        assert.equal(await worlds.setAnnouncedDays('CCCCC', '2026-12-06', ['2026-12-13']), false);
        assert.equal(await worlds.get('CCCCC'), undefined);
      }));

    it('makes a world’s stand-in CA key once, keeps it apart from the world, and erases it with the world', () =>
      withStores(async ({ worlds }) => {
        assert.equal(await worlds.caKey('AAAAA', () => 'first-key'), 'first-key');
        assert.equal(await worlds.caKey('AAAAA', () => 'second-key'), 'first-key');
        assert.equal(await worlds.caKey('BBBBB', () => 'other-key'), 'other-key');
        assert.equal(await worlds.caKey('CCCCC', () => 'no-world'), undefined);
        await worlds.add(madeUpWorld('DDDDD'));
        const [one, two] = await Promise.all(['one', 'two'].map((key) => worlds.caKey('DDDDD', () => key)));
        assert.equal(one, two);
        assert.ok(one === 'one' || one === 'two');
        assert.deepEqual(await worlds.get('AAAAA'), madeUpWorld('AAAAA'));
        await worlds.sweep('2026-12-07');
        assert.equal(await worlds.caKey('AAAAA', () => 'after'), undefined);
      }));

    it('keeps each world’s spaces apart', () =>
      withStores(async ({ spaces }) => {
        assert.equal(await spaces.addSpace('AAAAA', 'space-one', 'school'), 'added');
        assert.equal(await spaces.kindOf('AAAAA', 'space-one'), 'school');
        assert.equal(await spaces.kindOf('BBBBB', 'space-one'), undefined);
        assert.equal(await spaces.addBatches('BBBBB', 'space-one', 'stream', 0, one), 'full');
        assert.deepEqual(await spaces.batchesAfter('BBBBB', 'space-one', 0, 10), []);
      }));

    it('numbers each stream’s batches from 0 with no gap, and reads them in the order they arrived', () =>
      withStores(async ({ spaces }) => {
        await spaces.addSpace('AAAAA', 'space-one', 'school');
        assert.equal(await spaces.addBatches('AAAAA', 'space-one', 'stream', 1, one), 'gap');
        assert.equal(await spaces.addBatches('AAAAA', 'space-one', 'stream', 0, [...one, ...one]), 'added');
        assert.equal(await spaces.addBatches('AAAAA', 'space-one', 'stream', 1, one), 'taken');
        assert.equal(await spaces.addBatches('AAAAA', 'space-one', 'stream', 3, one), 'gap');
        assert.equal(await spaces.nextNumber('AAAAA', 'space-one', 'stream'), 2);
        assert.equal(await spaces.nextNumber('AAAAA', 'space-one', 'other'), 0);
        assert.equal(await spaces.addBatches('AAAAA', 'space-one', 'other', 0, [new Uint8Array([7, 8])]), 'added');
        const read = await spaces.batchesAfter('AAAAA', 'space-one', 1, 10);
        assert.deepEqual(
          read.map(({ seq, stream, number, bytes }) => [seq, stream, number, [...bytes]]),
          [
            [2, 'stream', 1, [1]],
            [3, 'other', 0, [7, 8]],
          ],
        );
        assert.equal((await spaces.batchesAfter('AAAAA', 'space-one', 0, 2)).length, 2);
      }));

    it('gives one of two uploads of the same numbers their place', () =>
      withStores(async ({ spaces }) => {
        await spaces.addSpace('AAAAA', 'space-one', 'school');
        const both = await Promise.all([0, 1].map(() => spaces.addBatches('AAAAA', 'space-one', 's', 0, one)));
        assert.deepEqual(both.sort(), ['added', 'taken']);
      }));

    it('caps what the whole server holds', () =>
      withStores(async ({ spaces }) => {
        await spaces.addSpace('AAAAA', 'space-one', 'school');
        await spaces.addSpace('BBBBB', 'space-one', 'school');
        assert.equal(await spaces.addBatches('AAAAA', 'space-one', 's', 0, [...one, ...one]), 'added');
        assert.equal(await spaces.addBatches('BBBBB', 'space-one', 's', 0, [...one, ...one]), 'server-full');
        assert.equal(await spaces.addBatches('BBBBB', 'space-one', 's', 0, one), 'added');
      }, 3));

    it('caps a world’s spaces and batches', () =>
      withStores(async ({ spaces }) => {
        for (let index = 0; index < MAX_SPACES; index++) await spaces.addSpace('AAAAA', `space-${index}`, 'school');
        assert.equal(await spaces.addSpace('AAAAA', 'one-too-many', 'school'), 'full');
        assert.equal(await spaces.addSpace('AAAAA', 'space-0', 'school'), 'same');
        assert.equal(await spaces.addSpace('AAAAA', 'space-0', 'national'), 'other');
        assert.equal(await spaces.addSpace('BBBBB', 'one-too-many', 'school'), 'added');
        const chunk = Array.from({ length: 2_048 }, () => new Uint8Array(1));
        for (let first = 0; first < MAX_BATCHES; first += chunk.length) {
          assert.equal(await spaces.addBatches('AAAAA', 'space-0', 'stream', first, chunk), 'added');
        }
        assert.equal(await spaces.addBatches('AAAAA', 'space-1', 'stream', 0, one), 'full');
        assert.equal(await spaces.addBatches('BBBBB', 'one-too-many', 'stream', 0, one), 'added');
      }));

    it('erases worlds on their 7th day, with their spaces and batches', () =>
      withStores(async ({ worlds, spaces }) => {
        await worlds.add(madeUpWorld('CCCCC', '2026-12-08'));
        for (const world of ['AAAAA', 'CCCCC']) {
          await spaces.addSpace(world, 'space-one', 'school');
          assert.equal(await spaces.addBatches(world, 'space-one', 's', 0, one), 'added');
        }
        assert.deepEqual(await worlds.sweep('2026-12-06'), []);
        assert.deepEqual((await worlds.sweep('2026-12-07')).sort(), ['AAAAA', 'BBBBB']);
        await spaces.forget(['AAAAA', 'BBBBB']);
        assert.equal(await worlds.get('AAAAA'), undefined);
        assert.equal(await spaces.kindOf('AAAAA', 'space-one'), undefined);
        assert.deepEqual(await spaces.batchesAfter('AAAAA', 'space-one', 0, 10), []);
        assert.equal(await spaces.kindOf('CCCCC', 'space-one'), 'school');
        assert.equal(await spaces.addBatches('CCCCC', 'space-one', 's', 1, one), 'added');
      }, 2));
  });
}

describe('a server keeping its worlds in PostgreSQL', { skip: KINDS[1]!.skip }, () => {
  beforeEach(emptyDatabase);

  it('answers gone for a world erased meanwhile, and busy when a world’s turn comes too late', async () => {
    const stores = new PrismaStores(url!, { lockWait: 200, timeout: 5_000 });
    const holder = new pg.Client({ connectionString: url });
    await holder.connect();
    try {
      assert.equal(await stores.spaces.addSpace('ZZZZZ', 'space-one', 'school'), 'gone');
      assert.equal(await stores.spaces.addBatches('ZZZZZ', 'space-one', 's', 0, [new Uint8Array(1)]), 'gone');
      await stores.worlds.add(madeUpWorld('AAAAA'));
      await stores.spaces.addSpace('AAAAA', 'space-one', 'school');
      await holder.query("BEGIN; SELECT 1 FROM world WHERE id = 'AAAAA' FOR UPDATE");
      const asked = Date.now();
      await assert.rejects(stores.spaces.addBatches('AAAAA', 'space-one', 's', 0, [new Uint8Array(1)]), StoreBusy);
      assert.ok(Date.now() - asked < 2_000, 'PostgreSQL gave up the wait while the lock was still held');
      await holder.query('ROLLBACK');
      assert.equal(await stores.spaces.nextNumber('AAAAA', 'space-one', 's'), 0);
    } finally {
      await holder.end();
      await stores.close();
    }
  });

  it('keeps a world through a restart, and erases it on its 7th day', async () => {
    const pass = 'cGFzcy1mb3ItYS1tYWRlLXVwLWRlbW8td29ybGQtMDM';
    const json = { 'content-type': 'application/json', 'x-world-pass': pass };
    const start = { world: 'K7QF3', sealed: 'c2VhbGVk', date: '2026-12-01', announcedDays: [], pass };
    const batch = randomBytes(SEALED_BATCH_BYTES).toString('base64url');
    const serve = async (day: string): Promise<{ base: string; stop: () => Promise<void> }> => {
      const stores = new PrismaStores(url!);
      const now = () => Date.parse(`${day}T09:00:00Z`);
      const options = { store: stores.worlds, spaces: stores.spaces, now, close: () => stores.close() };
      const app = await createApp(false, options);
      await app.listen(0, '127.0.0.1');
      return { base: await app.getUrl(), stop: () => app.close() };
    };

    const first = await serve('2026-11-30');
    try {
      const res = await fetch(`${first.base}/worlds`, { method: 'POST', headers: json, body: JSON.stringify(start) });
      assert.equal(res.status, 201);
      const space = `${first.base}/worlds/K7QF3/spaces/national`;
      const opened = await fetch(space, { method: 'PUT', headers: json, body: '{"kind":"national"}' });
      assert.equal(opened.status, 200);
      const body = JSON.stringify({ stream: 'cGhvbmUtb2YtdGVhY2hlci1h', first: 0, batches: [batch] });
      assert.equal((await fetch(`${space}/batches`, { method: 'POST', headers: json, body })).status, 201);
    } finally {
      await first.stop();
    }
    const kept = new PrismaStores(url!);
    assert.equal((await kept.worlds.get('K7QF3'))?.erasesOn, '2026-12-06');
    await kept.close();

    const second = await serve('2026-12-05');
    try {
      const join = await fetch(`${second.base}/worlds/K7QF3`, { headers: json });
      assert.deepEqual(await join.json(), { sealed: 'c2VhbGVk', date: '2026-12-01', announcedDays: [] });
      const read = await fetch(`${second.base}/worlds/K7QF3/spaces/national/batches?after=0`, { headers: json });
      const { batches } = (await read.json()) as { batches: { bytes: string }[] };
      assert.deepEqual(
        batches.map((one) => one.bytes),
        [batch],
      );
    } finally {
      await second.stop();
    }

    const third = await serve('2026-12-06');
    try {
      assert.equal((await fetch(`${third.base}/worlds/K7QF3`, { headers: json })).status, 404);
    } finally {
      await third.stop();
    }
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      for (const table of ['world', 'space', 'batch']) {
        const { rows } = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
        assert.equal(rows[0]?.n, 0, table);
      }
    } finally {
      await client.end();
    }
  });
});
