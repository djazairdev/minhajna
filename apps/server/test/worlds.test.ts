// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The worlds API (#540): starting a world from the first half of its code,
// joining it, reading its date, and moving the date only with the starter
// token. Every world here is made up.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';
import { MemoryWorldStore } from '../src/worlds/world-store.js';

const OPEN = { perAddress: 1000, total: 1000, windowMs: 60_000 };
const DAYS = ['2027-02-14', '2026-12-20', '2026-12-06', '2026-12-20', '2026-11-30'];

let ids = 0;
function freshId(): string {
  ids += 1;
  return `W${String(ids).padStart(4, '0')}`;
}

describe('the worlds API', () => {
  let app: NestNodeApplication;
  let base: string;
  let store: MemoryWorldStore;

  async function post(path: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
    return fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  async function start(world = freshId()): Promise<{ world: string; starter: string }> {
    const res = await post('/worlds', { world, sealed: 'c2VhbGVkLXdvcmxk', date: '2026-12-01', announcedDays: DAYS });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const { starter } = (await res.json()) as { starter: string };
    return { world, starter };
  }

  before(async () => {
    store = new MemoryWorldStore();
    app = await createApp(false, { store, starts: OPEN, joins: OPEN });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  it('starts a world and answers a starter token, kept only as its hash', async () => {
    const { world, starter } = await start();
    assert.match(starter, /^[A-Za-z0-9_-]{43}$/);
    const kept = await store.get(world);
    assert.equal(kept?.starterHash, createHash('sha256').update(starter).digest('hex'));
    assert.equal(JSON.stringify(kept).includes(starter), false);
    assert.deepEqual(kept?.announcedDays, ['2026-11-30', '2026-12-06', '2026-12-20', '2027-02-14']);
  });

  it('lets anyone join a world by its id and read its date, and lets no one cache them', async () => {
    const { world } = await start();
    const join = await fetch(`${base}/worlds/${world}`);
    assert.equal(join.status, 200);
    assert.equal(join.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await join.json(), { sealed: 'c2VhbGVkLXdvcmxk', date: '2026-12-01' });
    assert.deepEqual(await (await fetch(`${base}/worlds/${world}/date`)).json(), { date: '2026-12-01' });
  });

  it('refuses a second world with the same id', async () => {
    const { world } = await start();
    const again = await post('/worlds', { world, sealed: 'b3RoZXI', date: '2026-12-01', announcedDays: [] });
    assert.equal(again.status, 409);
    assert.equal((await store.get(world))?.sealed, 'c2VhbGVkLXdvcmxk');
  });

  it('never accepts more of the code than its first half', async () => {
    for (const world of ['W0001K7QF3M9TWX2R8HDN', 'W0001K', 'w0001', 'U0001', 'W00 1', 42]) {
      const res = await post('/worlds', { world, sealed: 'c2VhbGVk', date: '2026-12-01', announcedDays: [] });
      assert.equal(res.status, 400, String(world));
    }
  });

  it('refuses a malformed start', async () => {
    const good = { world: freshId(), sealed: 'c2VhbGVk', date: '2026-12-01', announcedDays: ['2026-12-06'] };
    for (const bad of [
      { ...good, sealed: 'not+base64/url=' },
      { ...good, sealed: 'A'.repeat(48 * 1024 + 1) },
      { ...good, date: '2026-02-30' },
      { ...good, date: '1 Dec 2026' },
      { ...good, announcedDays: '2026-12-06' },
      { ...good, announcedDays: ['2026-13-01'] },
      { ...good, announcedDays: Array.from({ length: 401 }, () => '2026-12-06') },
    ]) {
      assert.equal((await post('/worlds', bad)).status, 400);
    }
    assert.equal((await post('/worlds', '[1, 2')).status, 400);
    assert.equal((await post('/worlds', 'null')).status, 400);
    assert.equal((await post('/worlds', { ...good, sealed: 'A'.repeat(70 * 1024) })).status, 413);
    assert.equal(await store.get(good.world), undefined);
  });

  it('moves the date through the announced days only with the starter token', async () => {
    const { world, starter } = await start();
    const path = `/worlds/${world}/date`;
    for (const authorization of [undefined, 'Bearer wrong-token', `Basic ${starter}`, `Bearer ${starter}x`]) {
      const res = await post(path, {}, authorization ? { authorization } : {});
      assert.equal(res.status, 403);
    }
    assert.equal((await store.get(world))?.date, '2026-12-01');
    const auth = { authorization: `bearer ${starter}` };
    for (const day of ['2026-12-06', '2026-12-20', '2027-02-14']) {
      assert.deepEqual(await (await post(path, {}, auth)).json(), { date: day });
    }
    const last = await post(path, {}, auth);
    assert.equal(last.status, 409);
    assert.equal(last.headers.get('cache-control'), 'no-store');
    assert.equal((await store.get(world))?.date, '2027-02-14');
  });

  it("does not move a world's date with another world's token", async () => {
    const first = await start();
    const second = await start();
    const res = await post(`/worlds/${second.world}/date`, {}, { authorization: `Bearer ${first.starter}` });
    assert.equal(res.status, 403);
  });

  it('answers 404 for a world that does not exist or an id that cannot be one', async () => {
    for (const id of ['ZZZZZ', 'not-an-id']) {
      assert.equal((await fetch(`${base}/worlds/${id}`)).status, 404);
      assert.equal((await fetch(`${base}/worlds/${id}/date`)).status, 404);
      assert.equal((await post(`/worlds/${id}/date`, {}, { authorization: 'Bearer abc' })).status, 404);
    }
  });
});
