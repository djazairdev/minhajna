// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The limits on a world's observatory (#621, answers 676 and 699): a phone's
// kept sendings count against the daily limit by address and every kept sending
// against the uploads quota, an opening by its bytes together and its new
// school marks, refused ones costing nothing, and every request counts under
// the relay's limits. Every world and sending here is made up.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';
import { SEALED_BATCH_BYTES } from '../src/spaces/space-rules.js';
import { keptOf, madeUpSending, startedWorld } from './insights-kit.js';
import { OPEN, WITH_PASS } from './state-kit.js';

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

  /** A made-up sending of most of a sealed batch, however it is cut. */
  const heavySending = (at: number) => {
    const sending = madeUpSending(at);
    const padding = Array.from({ length: 200 }, (_, item): [string, number] => [`padding-${item}`, 1]);
    return { ...sending, sessions: { ...sending.sessions, ...Object.fromEntries(padding) } };
  };

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
    const more = Array.from({ length: 64 }, (_, at) => heavySending(at + 200));
    assert.equal((await call(id, 'POST', '', { sendings: more }, starter)).status, 429);
    clock += 2 * 60 * 60_000;
    assert.equal((await call(id, 'PUT', '/sendings', madeUpSending(5))).status, 201);
  });

  it('refuses a sending past the uploads quota alone, a refused one costing nothing', async () => {
    clock += 2 * 60 * 60_000;
    const { id, starter } = await startedWorld(base);
    const size = JSON.stringify(keptOf(heavySending(100), '')).length;
    const fill = Math.floor((28 * SEALED_BATCH_BYTES) / size);
    const seeded = Array.from({ length: fill }, (_, at) => heavySending(at + 100));
    assert.equal((await call(id, 'POST', '', { sendings: seeded }, starter)).status, 200);
    assert.equal((await call(id, 'PUT', '/sendings', madeUpSending(100, 9))).status, 409);
    assert.equal((await call(id, 'PUT', '/sendings', madeUpSending(101, 9))).status, 409);
    assert.equal((await call(id, 'PUT', '/sendings', madeUpSending(1))).status, 201);
    assert.equal((await call(id, 'PUT', '/sendings', madeUpSending(2))).status, 429);
  });

  it('charges an opening the batches its sendings’ bytes together fill, not one or more each', async () => {
    clock += 2 * 60 * 60_000;
    const { id, starter } = await startedWorld(base);
    const seeded = Array.from({ length: 64 }, (_, at) => madeUpSending(at + 100));
    assert.equal((await call(id, 'POST', '', { sendings: seeded }, starter)).status, 200);
  });

  it('charges an opening one more for each school’s mark new to the world', async () => {
    clock += 2 * 60 * 60_000;
    const { id, starter } = await startedWorld(base);
    const schools = (from: number, count: number) =>
      Array.from({ length: count }, (_, at) => madeUpSending(from + at, 1, from + at));
    assert.equal((await call(id, 'POST', '', { sendings: schools(300, 20) }, starter)).status, 200);
    assert.equal((await call(id, 'POST', '', { sendings: schools(400, 8) }, starter)).status, 429);
    assert.equal((await call(id, 'POST', '', { sendings: schools(500, 6) }, starter)).status, 200);
  });

  it('counts every request under the relay’s limits', async () => {
    clock += 2 * 60 * 60_000;
    const { id } = await startedWorld(base);
    const statuses: number[] = [];
    for (let at = 0; at < 15; at += 1) statuses.push((await call(id, 'PUT', '/sendings', { made: 'up' })).status);
    assert.deepEqual(statuses, [...Array<number>(14).fill(400), 429]);
  });
});
