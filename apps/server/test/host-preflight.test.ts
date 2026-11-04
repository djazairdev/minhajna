// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the Worker in front of the demo server's container (host/worker.ts)
// tells a browser while the server is not up: the web app's page can read its
// 503 and is answered its preflight at once, just as the server answers it, and
// a page elsewhere gets neither and wakes nothing. All values here are made up.

import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { after, afterEach, beforeEach, describe, it, mock } from 'node:test';
import { DemoServer } from '../host/worker.js';
import { cors } from '../src/cors.js';
import { env, made, pass, preflight, request, WEB } from './host-kit.js';

describe('the demo server’s Durable Object and a browser', () => {
  beforeEach(() => mock.timers.enable({ apis: ['Date', 'setTimeout'] }));
  afterEach(() => mock.timers.reset());
  after(() => mock.reset());

  it('lets the web app’s page read its 503, and no other page', async () => {
    const { server, state } = made({ refuseStart: true, listening: false });
    const from = (origin: string) =>
      new Request('https://demo.example/worlds', { headers: { Origin: origin, 'X-World-Pass': 'made-up' } });
    const named = server.fetch(from(WEB));
    await pass(19_000);
    const answer = await named;
    assert.equal(answer.status, 503);
    assert.equal(answer.headers.get('Access-Control-Allow-Origin'), WEB);
    assert.equal(answer.headers.get('Access-Control-Expose-Headers'), 'Retry-After');
    assert.equal(answer.headers.get('Vary'), 'Origin');
    const elsewhere = new DemoServer(state, env).fetch(from('https://not-the-web-app.example'));
    await pass(19_000);
    assert.equal((await elsewhere).headers.has('Access-Control-Allow-Origin'), false);
  });

  it('answers the web app’s preflight at once while the server is down, and starts it', async () => {
    const { seen, server } = made({ listening: false });
    const answer = await server.fetch(preflight(WEB));
    assert.equal(answer.status, 204);
    assert.equal(answer.headers.get('Access-Control-Allow-Origin'), WEB);
    assert.equal(answer.headers.get('Access-Control-Allow-Methods'), 'GET, POST, PUT');
    assert.equal(
      answer.headers.get('Access-Control-Allow-Headers'),
      'accept, authorization, content-type, x-world-pass',
    );
    assert.equal(answer.headers.has('Access-Control-Allow-Credentials'), false);
    assert.equal(seen.starts.length, 1);
  });

  it('refuses a preflight from elsewhere while the server is down, and wakes nothing', async () => {
    const { seen, server } = made();
    const answer = await server.fetch(preflight('https://not-the-web-app.example'));
    assert.equal(answer.status, 403);
    assert.equal(answer.headers.has('Access-Control-Allow-Origin'), false);
    assert.deepEqual(seen.starts, []);
  });

  it('answers the web app’s preflight just as the server does', async () => {
    const headers: Record<string, string> = {};
    const response = {
      setHeader: (name: string, value: string) => (headers[name.toLowerCase()] = value),
      removeHeader: (name: string) => delete headers[name.toLowerCase()],
      writeHead(status: number, more: Record<string, string>) {
        assert.equal(status, 204);
        for (const [name, value] of Object.entries(more)) headers[name.toLowerCase()] = value;
      },
      end: () => undefined,
    } as unknown as ServerResponse;
    const asked = {
      method: 'OPTIONS',
      headers: { origin: WEB, 'access-control-request-method': 'POST' },
    } as unknown as IncomingMessage;
    cors(asked, response, () => assert.fail('the server should answer a preflight itself'));
    const answer = await made({ listening: false }).server.fetch(preflight(WEB));
    assert.deepEqual(Object.fromEntries(answer.headers), headers);
  });

  it('answers a preflight, not a 503, when the running server stops answering', async () => {
    const { box, server } = made();
    await server.fetch(request());
    box.listening = false;
    assert.equal((await server.fetch(preflight(WEB))).status, 204);
  });

  it('hands a preflight to the server once it is up', async () => {
    const { seen, server } = made();
    await server.fetch(request());
    await server.fetch(preflight('https://not-the-web-app.example'));
    assert.equal(seen.requests.at(-1)?.method, 'OPTIONS');
  });
});
