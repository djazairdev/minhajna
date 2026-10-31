// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The body guard: each route's largest body, refused before it is read, and
// a body that does not say its length refused.

import assert from 'node:assert/strict';
import { request } from 'node:http';
import { after, before, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';
import { BATCH_BODY, DELIVERY_BODY, DRAIN_AT, SMALL_BODY } from '../src/body-guard.js';

let connection: string | undefined;

function send(base: string, path: string, headers: Record<string, string>, body = ''): Promise<number> {
  return new Promise((done, fail) => {
    const req = request(new URL(path, base), { method: 'POST', headers }, (res) => {
      res.resume();
      connection = res.headers.connection;
      done(res.statusCode ?? 0);
    });
    req.on('error', fail);
    req.end(body);
  });
}

describe('the body guard', () => {
  let app: NestNodeApplication;
  let base: string;

  before(async () => {
    app = await createApp(false);
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  it('refuses a body larger than the route takes before reading it, and keeps the connection', async () => {
    const json = { 'content-type': 'application/json' };
    const small = 'x'.repeat(SMALL_BODY + 1);
    assert.equal(await send(base, '/worlds', { ...json, 'content-length': String(small.length) }, small), 413);
    assert.notEqual(connection, 'close');
    const upload = '/worlds/AAAAA/spaces/c2Nob29sLW9mLXRoZS1kZW1v/batches';
    const big = 'x'.repeat(BATCH_BODY + 1);
    assert.equal(await send(base, upload, { ...json, 'content-length': String(big.length) }, big), 413);
    assert.notEqual(connection, 'close');
    assert.equal(await send(base, upload, { ...json, 'content-length': String(small.length) }, small), 400);
    assert.equal(await send(base, '/worlds', { ...json, 'content-length': '2' }, '{}'), 400);
    const delivery = '/worlds/AAAAA/state/deliveries';
    const larger = 'x'.repeat(DELIVERY_BODY + 1);
    assert.equal(await send(base, delivery, { ...json, 'content-length': String(larger.length) }, larger), 413);
    assert.equal(await send(base, delivery, { ...json, 'content-length': String(small.length) }, small), 400);
  });

  it('closes the connection instead of draining a body that claims far too much', async () => {
    connection = undefined;
    const claim = String(DRAIN_AT + 1);
    const status = await send(base, '/worlds', { 'content-type': 'application/json', 'content-length': claim }).catch(
      () => 413,
    );
    assert.equal(status, 413);
    assert.equal(connection, 'close');
  });

  it('refuses a body that does not say its length', async () => {
    assert.equal(
      await send(base, '/worlds', { 'content-type': 'application/json', 'transfer-encoding': 'chunked' }, '{}'),
      411,
    );
  });
});
