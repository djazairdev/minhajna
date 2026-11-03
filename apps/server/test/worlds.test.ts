// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The worlds API (#540): starting a world from the first half of its code,
// joining it, reading its date and announced days, moving the date only with
// the starter token, and replacing the announced days after the date with the
// pass (#608), which the date then moves through, each refused when the other
// changed meanwhile. Every world here is made up.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, describe, it, mock } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';
import { MemoryWorldStore, type World } from '../src/worlds/world-store.js';

const OPEN = { perAddress: 1000, total: 1000, windowMs: 60_000 };
const PASS = 'cGFzcy1mb3ItYS1tYWRlLXVwLWRlbW8td29ybGQtMDE';
const WITH_PASS = { 'x-world-pass': PASS };
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
    const res = await post('/worlds', {
      world,
      sealed: 'c2VhbGVkLXdvcmxk',
      date: '2026-12-01',
      announcedDays: DAYS,
      pass: PASS,
    });
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
    assert.equal(kept?.passHash, createHash('sha256').update(PASS).digest('hex'));
    assert.equal(JSON.stringify(kept).includes(starter), false);
    assert.equal(JSON.stringify(kept).includes(PASS), false);
    assert.deepEqual(kept?.announcedDays, ['2026-11-30', '2026-12-06', '2026-12-20', '2027-02-14']);
  });

  it('lets anyone join a world by its id and read its date, and lets no one cache them', async () => {
    const { world } = await start();
    const join = await fetch(`${base}/worlds/${world}`, { headers: WITH_PASS });
    assert.equal(join.status, 200);
    assert.equal(join.headers.get('cache-control'), 'no-store');
    const days = ['2026-11-30', '2026-12-06', '2026-12-20', '2027-02-14'];
    assert.deepEqual(await join.json(), { sealed: 'c2VhbGVkLXdvcmxk', date: '2026-12-01', announcedDays: days });
    assert.deepEqual(await (await fetch(`${base}/worlds/${world}/date`, { headers: WITH_PASS })).json(), {
      date: '2026-12-01',
      announcedDays: days,
    });
  });

  it('answers a wrong or missing pass exactly as an unknown id', async () => {
    const { world } = await start();
    const unknown = await fetch(`${base}/worlds/ZZZZZ`, { headers: WITH_PASS });
    assert.equal(unknown.status, 404);
    const expected: unknown = await unknown.json();
    for (const headers of [{}, { 'x-world-pass': PASS.replace(/.$/, 'A') }, { 'x-world-pass': 'short' }]) {
      for (const path of [`/worlds/${world}`, `/worlds/${world}/date`]) {
        const res = await fetch(`${base}${path}`, { headers });
        assert.equal(res.status, 404);
        assert.deepEqual(await res.json(), expected);
      }
    }
  });

  it('refuses a second world with the same id', async () => {
    const { world } = await start();
    const again = await post('/worlds', {
      world,
      sealed: 'b3RoZXI',
      date: '2026-12-01',
      announcedDays: [],
      pass: PASS,
    });
    assert.equal(again.status, 409);
    assert.equal((await store.get(world))?.sealed, 'c2VhbGVkLXdvcmxk');
  });

  it('never accepts more of the code than its first half', async () => {
    for (const world of ['W0001K7QF3M9TWX2R8HDN', 'W0001K', 'w0001', 'U0001', 'W00 1', 42]) {
      const res = await post('/worlds', {
        world,
        sealed: 'c2VhbGVk',
        date: '2026-12-01',
        announcedDays: [],
        pass: PASS,
      });
      assert.equal(res.status, 400, String(world));
    }
  });

  it('refuses a malformed start', async () => {
    const good = {
      world: freshId(),
      sealed: 'c2VhbGVk',
      date: '2026-12-01',
      announcedDays: ['2026-12-06'],
      pass: PASS,
    };
    for (const bad of [
      { ...good, sealed: 'not+base64/url=' },
      { ...good, sealed: 'A'.repeat(48 * 1024 + 1) },
      { ...good, date: '2026-02-30' },
      { ...good, date: '1 Dec 2026' },
      { ...good, announcedDays: '2026-12-06' },
      { ...good, announcedDays: ['2026-13-01'] },
      { ...good, announcedDays: Array.from({ length: 401 }, () => '2026-12-06') },
      { ...good, pass: undefined },
      { ...good, pass: `${PASS}A` },
      { ...good, pass: 'not a pass with spaces in it, forty-three!!' },
    ]) {
      assert.equal((await post('/worlds', bad)).status, 400);
    }
    assert.equal((await post('/worlds', '[1, 2')).status, 400);
    assert.equal((await post('/worlds', 'null')).status, 400);
    assert.equal((await post('/worlds', { ...good, sealed: 'A'.repeat(70 * 1024) })).status, 413);
    assert.equal(await store.get(good.world), undefined);
  });

  it('moves the date through the announced days only with the pass and the starter token', async () => {
    const { world, starter } = await start();
    const path = `/worlds/${world}/date`;
    for (const authorization of [undefined, 'Bearer wrong-token', `Basic ${starter}`, `Bearer ${starter}x`]) {
      const res = await post(path, {}, authorization ? { ...WITH_PASS, authorization } : WITH_PASS);
      assert.equal(res.status, 403);
    }
    assert.equal((await store.get(world))?.date, '2026-12-01');
    assert.equal((await post(path, {}, { authorization: `Bearer ${starter}` })).status, 404);
    const auth = { ...WITH_PASS, authorization: `bearer ${starter}` };
    for (const day of ['2026-12-06', '2026-12-20', '2027-02-14']) {
      assert.deepEqual(await (await post(path, {}, auth)).json(), { date: day });
    }
    const last = await post(path, {}, auth);
    assert.equal(last.status, 409);
    assert.equal(last.headers.get('cache-control'), 'no-store');
    assert.equal((await store.get(world))?.date, '2027-02-14');
  });

  it('replaces the announced days after the date with the pass, and the date then moves through them', async () => {
    const { world, starter } = await start();
    const path = `/worlds/${world}/announced-days`;
    const put = (body: unknown, headers: Record<string, string> = WITH_PASS) =>
      fetch(`${base}${path}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
    const sent = ['2027-01-10', '2026-12-13', '2027-01-10'];
    const res = await put({ announcedDays: sent });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const kept = ['2026-11-30', '2026-12-13', '2027-01-10'];
    assert.deepEqual(await res.json(), { announcedDays: kept });
    assert.deepEqual((await store.get(world))?.announcedDays, kept);
    const read = await fetch(`${base}/worlds/${world}/date`, { headers: WITH_PASS });
    assert.deepEqual(await read.json(), { date: '2026-12-01', announcedDays: kept });
    for (const body of [
      {},
      { announcedDays: ['2027-01-10'], date: '2027-01-10' },
      { announcedDays: '2027-01-10' },
      { announcedDays: ['2026-12-01'] },
      { announcedDays: ['2026-11-15'] },
      { announcedDays: ['2027-02-30'] },
      {
        announcedDays: Array.from({ length: 400 }, (_, at) =>
          new Date(Date.UTC(2027, 0, 1 + at)).toISOString().slice(0, 10),
        ),
      },
    ]) {
      assert.equal((await put(body)).status, 400);
    }
    assert.equal((await put({ announcedDays: [] }, {})).status, 404);
    assert.equal((await put({ announcedDays: [] }, { 'x-world-pass': PASS.replace(/.$/, 'A') })).status, 404);
    assert.deepEqual((await store.get(world))?.announcedDays, kept);
    const auth = { ...WITH_PASS, authorization: `Bearer ${starter}` };
    assert.deepEqual(await (await post(`/worlds/${world}/date`, {}, auth)).json(), { date: '2026-12-13' });
    assert.deepEqual(await (await put({ announcedDays: [] })).json(), { announcedDays: ['2026-11-30', '2026-12-13'] });
    assert.equal((await post(`/worlds/${world}/date`, {}, auth)).status, 409);
  });

  it('keeps 400 announced days in all, and refuses a change when the other moved meanwhile', async () => {
    const { world, starter } = await start();
    const put = (announcedDays: readonly string[]) =>
      fetch(`${base}/worlds/${world}/announced-days`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', ...WITH_PASS },
        body: JSON.stringify({ announcedDays }),
      });
    const later = Array.from({ length: 399 }, (_, at) =>
      new Date(Date.UTC(2027, 0, 1 + at)).toISOString().slice(0, 10),
    );
    assert.equal((await put(later)).status, 200);
    assert.equal((await store.get(world))?.announcedDays.length, 400);
    const kept = store.setAnnouncedDays.bind(store);
    const moved = mock.method(store, 'setAnnouncedDays', async (id: string, date: string, days: readonly string[]) => {
      await store.setDate(id, '2026-12-06', (await store.get(id))!);
      return kept(id, date, days);
    });
    try {
      assert.equal((await put(['2026-12-20'])).status, 409);
    } finally {
      moved.mock.restore();
    }
    assert.equal((await store.get(world))?.announcedDays.length, 400);
    const date = store.setDate.bind(store);
    const changed = mock.method(store, 'setDate', async (id: string, day: string, was: World) => {
      await store.setAnnouncedDays(id, was.date, ['2027-05-01']);
      return date(id, day, was);
    });
    try {
      const auth = { ...WITH_PASS, authorization: `Bearer ${starter}` };
      assert.equal((await post(`/worlds/${world}/date`, {}, auth)).status, 409);
    } finally {
      changed.mock.restore();
    }
    assert.equal((await store.get(world))?.date, '2026-12-06');
  });

  it("does not move a world's date with another world's token", async () => {
    const first = await start();
    const second = await start();
    const res = await post(
      `/worlds/${second.world}/date`,
      {},
      { ...WITH_PASS, authorization: `Bearer ${first.starter}` },
    );
    assert.equal(res.status, 403);
  });

  it('answers 404 for a world that does not exist or an id that cannot be one', async () => {
    for (const id of ['ZZZZZ', 'not-an-id']) {
      assert.equal((await fetch(`${base}/worlds/${id}`, { headers: WITH_PASS })).status, 404);
      assert.equal((await fetch(`${base}/worlds/${id}/date`, { headers: WITH_PASS })).status, 404);
      assert.equal((await post(`/worlds/${id}/date`, {}, { ...WITH_PASS, authorization: 'Bearer abc' })).status, 404);
    }
  });
});
