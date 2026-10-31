// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The web app's origin (answer 583): a preflight from it, for what the demo
// client sends, is answered without credentials; one from another origin,
// or for another method or header, is refused; an answer names only the
// web app's origins back, lets them read Retry-After, and varies by origin;
// an OPTIONS request that is no preflight goes to the routes, which take none.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';
import { WEB_ORIGINS } from '../src/cors.js';

const WEB = 'https://minhajna.djazair.dev';

describe('the web app’s origin', () => {
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

  const preflight = (origin: string, method: string, headers = 'content-type, x-world-pass') =>
    fetch(`${base}/worlds/AAAAA`, {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': headers },
    });

  it('names only the web app and its local tries', () => {
    assert.deepEqual([...WEB_ORIGINS], [WEB, 'http://127.0.0.1:4180', 'http://127.0.0.1:8787']);
  });

  it('answers a preflight from the web app for what the demo client sends, without credentials', async () => {
    for (const method of ['GET', 'POST', 'PUT']) {
      const answer = await preflight(WEB, method, 'Accept, Authorization, Content-Type, X-World-Pass');
      assert.equal(answer.status, 204);
      assert.equal(answer.headers.get('access-control-allow-origin'), WEB);
      assert.equal(answer.headers.get('access-control-allow-methods'), 'GET, POST, PUT');
      assert.match(answer.headers.get('access-control-allow-headers') ?? '', /x-world-pass/);
      assert.equal(answer.headers.get('access-control-max-age'), '600');
      assert.equal(answer.headers.get('access-control-allow-credentials'), null);
      assert.equal(answer.headers.get('vary'), 'Origin');
    }
    assert.equal((await preflight('http://127.0.0.1:4180', 'POST')).status, 204);
    assert.equal((await preflight('http://127.0.0.1:8787', 'PUT')).status, 204);
    assert.equal((await preflight('http://127.0.0.1:4181', 'GET')).status, 403);
    assert.equal((await preflight(WEB, 'GET', '')).status, 204);
  });

  it('refuses a preflight from another origin, or for another method or header', async () => {
    for (const [origin, method, headers] of [
      ['https://elsewhere.example', 'GET', 'x-world-pass'],
      ['null', 'GET', 'x-world-pass'],
      ['https://minhajna.djazair.dev.example', 'GET', 'x-world-pass'],
      [WEB, 'DELETE', 'x-world-pass'],
      [WEB, 'GET', 'x-world-pass, cookie'],
    ] as const) {
      const answer = await preflight(origin, method, headers);
      assert.equal(answer.status, 403, `${origin} ${method} ${headers}`);
      assert.equal(answer.headers.get('access-control-allow-origin'), null);
      assert.equal(answer.headers.get('access-control-allow-methods'), null);
      await answer.text();
    }
  });

  it('names the web app back on its answers, lets it read Retry-After, and no other origin', async () => {
    const own = await fetch(`${base}/health`, { headers: { Origin: WEB } });
    assert.equal(own.headers.get('access-control-allow-origin'), WEB);
    assert.equal(own.headers.get('access-control-expose-headers'), 'Retry-After');
    assert.equal(own.headers.get('vary'), 'Origin');
    await own.text();
    const other = await fetch(`${base}/health`, { headers: { Origin: 'https://elsewhere.example' } });
    assert.equal(other.headers.get('access-control-allow-origin'), null);
    assert.equal(other.headers.get('vary'), 'Origin');
    await other.text();
    const refused = await fetch(`${base}/worlds`, {
      method: 'POST',
      headers: { Origin: WEB, 'Content-Type': 'application/json', 'Content-Length': String(64 * 1024 + 1) },
      body: 'x'.repeat(64 * 1024 + 1),
    });
    assert.equal(refused.status, 413);
    assert.equal(refused.headers.get('access-control-allow-origin'), WEB);
    await refused.text();
  });

  it('routes an OPTIONS request that is no preflight, which no route takes', async () => {
    const plain = await fetch(`${base}/health`, { method: 'OPTIONS', headers: { Origin: WEB } });
    assert.equal(plain.status, 404);
    assert.equal(plain.headers.get('access-control-allow-methods'), null);
    assert.equal(plain.headers.get('vary'), 'Origin');
    await plain.text();
  });

  it('leaves a request without an origin as it was', async () => {
    const plain = await fetch(`${base}/health`);
    assert.equal(plain.status, 200);
    assert.equal(plain.headers.get('access-control-allow-origin'), null);
    await plain.text();
  });
});
