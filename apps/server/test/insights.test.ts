// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A world's observatory (#621, answer 676): only the starter opens it, with
// the pass, keeping up to 256 made-up sendings at once, every one checked
// before any is kept and a refusal stopping there, keeping those before it; a
// refused opening opens nothing; a world whose observatory is not open refuses
// sendings; a sending is kept once with the pass, 201 when new and 200 when
// sent again with its token, its ID alone answered, and refused with another
// token's ID, past MAX_SENDINGS a world, or in any other shape; the server
// keeps no school-and-term code and logs none; a phone's kept sendings count
// against the daily limit by address and every kept sending against the
// uploads quota, refused ones costing nothing, and every request counts under
// the relay's limits; a body over its route's size is refused before it is
// read; and the sweeper erases the observatory with the world. Every world and
// sending here is made up.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';
import { MAX_SENDINGS, MemoryInsightStore } from '../src/insights/insight-store.js';
import { SEED_SENDINGS } from '../src/insights/insights.controller.js';
import { PlainLogger } from '../src/plain-logger.js';
import { MemoryWorldStore } from '../src/worlds/world-store.js';
import { WorldSweeper } from '../src/worlds/world-sweeper.js';
import { keptOf, madeUpSending, startedWorld } from './insights-kit.js';
import { OPEN, WITH_PASS } from './state-kit.js';

describe('a world’s observatory', () => {
  let app: NestNodeApplication;
  let base: string;
  const store = new MemoryWorldStore();
  const insights = new MemoryInsightStore(async (id) => (await store.get(id)) !== undefined);
  const lines: string[] = [];
  let clock = Date.UTC(2026, 10, 30, 10);

  before(async () => {
    const plenty = { perAddress: 100_000, total: 100_000, windowMs: 60 * 60_000 };
    const logger = new PlainLogger(
      (line) => lines.push(line),
      (line) => lines.push(line),
    );
    const options = { store, insights, starts: OPEN, joins: OPEN, relay: plenty, uploads: plenty, sendings: plenty };
    app = await createApp(logger, { ...options, now: () => clock });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  const json = { 'content-type': 'application/json' };
  const open = (id: string, starter: string | null, body: unknown, headers: Record<string, string> = WITH_PASS) =>
    fetch(`${base}/worlds/${id}/insights`, {
      method: 'POST',
      headers: { ...headers, ...json, ...(starter === null ? {} : { authorization: `Bearer ${starter}` }) },
      body: JSON.stringify(body),
    });
  const send = (id: string, body: unknown, headers: Record<string, string> = WITH_PASS) =>
    fetch(`${base}/worlds/${id}/insights/sendings`, {
      method: 'PUT',
      headers: { ...headers, ...json },
      body: JSON.stringify(body),
    });

  it('is opened only by the starter, with the pass, and refuses sendings until then', async () => {
    const { id, starter } = await startedWorld(base);
    const refused = await send(id, madeUpSending(1));
    assert.equal(refused.status, 409);
    assert.match(((await refused.json()) as { message: string }).message, /no observatory/);
    assert.equal((await open(id, starter, { sendings: [] }, {})).status, 404);
    assert.equal((await open(id, null, { sendings: [] })).status, 403);
    assert.equal((await open(id, 'not-the-starter', { sendings: [] })).status, 403);
    const opened = await open(id, starter, { sendings: [] });
    assert.equal(opened.status, 200);
    assert.equal(opened.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await opened.json(), { kept: 0 });
    assert.equal((await send(id, madeUpSending(1))).status, 201);
  });

  it('keeps the starter’s made-up sendings, all checked before any is kept', async () => {
    const { id, starter } = await startedWorld(base);
    const seeded = [madeUpSending(1), madeUpSending(2, 2, 2)];
    const bad = await open(id, starter, { sendings: [madeUpSending(3), { ...madeUpSending(4), term: 4 }] });
    assert.equal(bad.status, 400);
    assert.match(((await bad.json()) as { message: string }).message, /^sending 1: .*term/);
    assert.equal((await open(id, starter, { sendings: [madeUpSending(3), madeUpSending(3)] })).status, 400);
    const many = Array.from({ length: 257 }, (_, at) => madeUpSending(at + 1));
    assert.equal((await open(id, starter, { sendings: many })).status, 400);
    for (const body of [{}, [], { sendings: [], more: 1 }, { sendings: 'all' }]) {
      assert.equal((await open(id, starter, body)).status, 400, JSON.stringify(body));
    }
    assert.deepEqual(await insights.sendings(id), []);
    assert.deepEqual(await (await open(id, starter, { sendings: seeded })).json(), { kept: 2 });
    assert.deepEqual(await insights.sendings(id), seeded.map(keptOf));
  });

  it('keeps a sending once, replaced only with its token, and drops its school-and-term code', async () => {
    const { id, starter } = await startedWorld(base);
    await open(id, starter, { sendings: [] });
    assert.equal((await send(id, madeUpSending(1), {})).status, 404);
    const first = await send(id, madeUpSending(1, 1, 7));
    assert.equal(first.status, 201);
    assert.equal(first.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await first.json(), { id: madeUpSending(1).id });
    const again = { ...madeUpSending(1, 1, 7), reached: 400 };
    assert.equal((await send(id, again)).status, 200);
    assert.equal((await send(id, madeUpSending(1, 2))).status, 409);
    assert.deepEqual(await insights.sendings(id), [keptOf(again)]);
    const code = madeUpSending(1, 1, 7).schoolTerm;
    assert.equal(JSON.stringify(await insights.sendings(id)).includes(code), false);
    assert.equal(JSON.stringify(await insights.sendings(id)).includes('schoolTerm'), false);
    assert.equal(lines.join('\n').includes(code), false);
  });

  it('refuses a sending of any other shape, keeping nothing', async () => {
    const { id, starter } = await startedWorld(base);
    await open(id, starter, { sendings: [] });
    const one = madeUpSending(1);
    const wrong: unknown[] = [
      { ...one, format: 'minhajna/insights/2' },
      { ...one, id: 'A'.repeat(32) },
      { ...one, token: 'e'.repeat(31) },
      { ...one, schoolTerm: 'made-up-school' },
      { ...one, year: '2027' },
      { ...one, term: 0 },
      { ...one, wilaya: '__proto__' },
      { ...one, subject: 'constructor' },
      { ...one, pack: 'made-up' },
      { ...one, release: '2027' },
      { ...one, reached: 1001 },
      { ...one, sessions: { 's1-w1': 501 } },
      { ...one, sessions: { toString: 1 } },
      { ...one, changed: { ...one.changed, merged: ['s1-w9'] } },
      { ...one, changed: { ...one.changed, split: ['s1-w5', 's1-w4'] } },
      { ...one, changed: { merged: [] } },
      { ...one, teacher: 'made-up-teacher' },
      { ...one, date: '2027-12-16' },
      [one],
    ];
    for (const body of wrong) assert.equal((await send(id, body)).status, 400, JSON.stringify(body));
    assert.deepEqual(await insights.sendings(id), []);
  });

  it('refuses a body over its route’s size before reading it', async () => {
    const { id, starter } = await startedWorld(base);
    const big = { ...madeUpSending(1), pad: 'x'.repeat(70 * 1024) };
    assert.equal((await send(id, big)).status, 413);
    const over = await send(id, { ...madeUpSending(1), pad: 'x'.repeat(50 * 1024) });
    assert.equal(over.status, 400);
    assert.match(((await over.json()) as { message: string }).message, /bytes/);
    const huge = { sendings: [{ pad: 'x'.repeat(1100 * 1024) }] };
    assert.equal((await open(id, starter, huge)).status, 413);
    const large = { sendings: [{ ...madeUpSending(1), pad: 'x'.repeat(200 * 1024) }] };
    assert.equal((await open(id, starter, large)).status, 400);
  });

  it('stops a seeding at a refused sending, keeping those before it', async () => {
    const { id, starter } = await startedWorld(base);
    await open(id, starter, { sendings: [madeUpSending(1)] });
    const refused = await open(id, starter, { sendings: [madeUpSending(2), madeUpSending(1, 9), madeUpSending(3)] });
    assert.equal(refused.status, 409);
    assert.match(((await refused.json()) as { message: string }).message, /^sending 1: .*another token/);
    assert.deepEqual(await insights.sendings(id), [madeUpSending(1), madeUpSending(2)].map(keptOf));
  });

  it('opens no observatory on a refused opening', async () => {
    const { id, starter } = await startedWorld(base);
    assert.equal((await open(id, starter, { sendings: [{ ...madeUpSending(1), term: 0 }] })).status, 400);
    assert.equal((await open(id, null, { sendings: [] })).status, 403);
    assert.equal((await send(id, madeUpSending(1))).status, 409);
  });

  it('refuses a sending past MAX_SENDINGS a world', async () => {
    const { id, starter } = await startedWorld(base);
    for (let at = 0; at < MAX_SENDINGS; at += SEED_SENDINGS) {
      const sendings = Array.from({ length: SEED_SENDINGS }, (_, one) => madeUpSending(at + one + 1));
      assert.equal((await open(id, starter, { sendings })).status, 200);
    }
    const full = await send(id, madeUpSending(MAX_SENDINGS + 1));
    assert.equal(full.status, 409);
    assert.match(((await full.json()) as { message: string }).message, /at most/);
    assert.equal((await send(id, madeUpSending(1))).status, 200);
  });

  it('is erased with its world', async () => {
    const { id, starter } = await startedWorld(base);
    await open(id, starter, { sendings: [madeUpSending(1)] });
    clock = Date.UTC(2026, 11, 7, 1);
    await app.get(WorldSweeper).sweep();
    assert.deepEqual(await insights.sendings(id), []);
    assert.equal((await send(id, madeUpSending(2))).status, 404);
  });
});

describe('the observatory’s limits', () => {
  let app: NestNodeApplication;
  let base: string;
  let clock = Date.UTC(2026, 10, 30, 10);

  before(async () => {
    const hour = 60 * 60_000;
    const limits = {
      starts: OPEN,
      relay: { perAddress: 14, total: 1000, windowMs: hour },
      uploads: { perAddress: 30, total: 1000, windowMs: hour },
      sendings: { perAddress: 4, total: 1000, windowMs: hour },
    };
    app = await createApp(false, { ...limits, now: () => clock });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  const call = (id: string, method: string, path: string, body: unknown, starter?: string) =>
    fetch(`${base}/worlds/${id}/insights${path}`, {
      method,
      headers: {
        ...WITH_PASS,
        'content-type': 'application/json',
        ...(starter ? { authorization: `Bearer ${starter}` } : {}),
      },
      body: JSON.stringify(body),
    });

  it('counts kept sendings by address and against the uploads quota, refused ones costing nothing', async () => {
    const { id, starter } = await startedWorld(base);
    const seeded = Array.from({ length: 10 }, (_, at) => madeUpSending(at + 100));
    assert.equal((await call(id, 'POST', '', { sendings: seeded }, starter)).status, 200);
    assert.equal((await call(id, 'PUT', '/sendings', madeUpSending(100, 9))).status, 409);
    for (let at = 1; at <= 4; at += 1)
      assert.equal((await call(id, 'PUT', '/sendings', madeUpSending(at))).status, 201);
    assert.equal((await call(id, 'PUT', '/sendings', madeUpSending(5))).status, 429);
    const more = Array.from({ length: 20 }, (_, at) => madeUpSending(at + 200));
    assert.equal((await call(id, 'POST', '', { sendings: more }, starter)).status, 429);
    clock += 2 * 60 * 60_000;
    assert.equal((await call(id, 'PUT', '/sendings', madeUpSending(5))).status, 201);
  });

  it('refuses a sending past the uploads quota alone, a refused one costing nothing', async () => {
    clock += 2 * 60 * 60_000;
    const { id, starter } = await startedWorld(base);
    const seeded = Array.from({ length: 29 }, (_, at) => madeUpSending(at + 100));
    assert.equal((await call(id, 'POST', '', { sendings: seeded }, starter)).status, 200);
    assert.equal((await call(id, 'PUT', '/sendings', madeUpSending(100, 9))).status, 409);
    assert.equal((await call(id, 'PUT', '/sendings', madeUpSending(101, 9))).status, 409);
    assert.equal((await call(id, 'PUT', '/sendings', madeUpSending(1))).status, 201);
    assert.equal((await call(id, 'PUT', '/sendings', madeUpSending(2))).status, 429);
  });

  it('counts every request under the relay’s limits', async () => {
    clock += 2 * 60 * 60_000;
    const { id } = await startedWorld(base);
    const statuses: number[] = [];
    for (let at = 0; at < 15; at += 1) statuses.push((await call(id, 'PUT', '/sendings', { made: 'up' })).status);
    assert.deepEqual(statuses, [...Array<number>(14).fill(400), 429]);
  });
});
