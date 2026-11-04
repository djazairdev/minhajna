// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Worker in front of the demo server's container (host/worker.ts), on a
// made-up container: what it starts it with, that it never starts without the
// sealed archive's settings, that a request reaches the server whole, what a
// request waits for, and how it wakes. All values here are made up.

import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, it, mock } from 'node:test';
import { DemoServer } from '../host/worker.js';
import { made, namespace, pass, preflight, request, SECRETS, SLEEP_AFTER_MS, WEB } from './host-kit.js';

describe('the demo server’s Durable Object', () => {
  beforeEach(() => mock.timers.enable({ apis: ['Date', 'setTimeout'] }));
  afterEach(() => mock.timers.reset());
  after(() => mock.reset());

  it('starts the container with the bucket’s settings and its time to sleep', async () => {
    const { seen, server } = made();
    const answer = await server.fetch(request());
    assert.equal(await answer.text(), 'served');
    assert.deepEqual(seen.starts, [
      {
        enableInternet: true,
        env: {
          ...SECRETS,
          WALG_S3_PREFIX: 's3://minhajna-demo/archive',
          WALG_LIBSODIUM_KEY_TRANSFORM: 'hex',
          AWS_REGION: 'auto',
          AWS_S3_FORCE_PATH_STYLE: 'true',
          BACKUP_EVERY: '82800',
          TRUST_PROXY: 'cloudflare',
        },
      },
    ]);
    assert.deepEqual(seen.timeouts, [SLEEP_AFTER_MS]);
  });

  it('hands a request on whole, over plain HTTP, the only way to a container’s port', async () => {
    const { seen, server } = made();
    const body = JSON.stringify({ made: 'up' });
    await server.fetch(
      new Request('https://demo.example/worlds/K7QF4/date?a=1', {
        method: 'POST',
        body,
        headers: { 'CF-Connecting-IP': '192.0.2.7', 'X-World-Pass': 'made-up' },
      }),
    );
    const handed = seen.requests[0];
    assert.equal(handed?.url, 'http://container/worlds/K7QF4/date?a=1');
    assert.equal(handed?.method, 'POST');
    assert.equal(handed?.headers.get('CF-Connecting-IP'), '192.0.2.7');
    assert.equal(handed?.headers.get('X-World-Pass'), 'made-up');
    assert.equal(await handed?.text(), body);
  });

  it('asks once whether the server answers, and starts nothing while it runs', async () => {
    const { seen, server } = made();
    await server.fetch(request());
    await server.fetch(request());
    assert.equal(seen.starts.length, 1);
    assert.equal(seen.pings, 1);
    assert.equal(seen.requests.length, 2);
  });

  it('starts one container for requests that come together', async () => {
    const { seen, box, server } = made({ listening: false });
    const both = Promise.all([server.fetch(request()), server.fetch(request())]);
    await pass(1_000);
    box.listening = true;
    await pass(1_000);
    assert.deepEqual(
      (await both).map((answer) => answer.status),
      [200, 200],
    );
    assert.equal(seen.starts.length, 1);
  });

  for (const name of Object.keys(SECRETS)) {
    it(`never starts without ${name}`, async () => {
      const { seen, state } = made();
      const rest: Record<string, string> = { ...SECRETS };
      delete rest[name];
      const server = new DemoServer(state, { ...rest, SERVER: namespace });
      const answer = await server.fetch(request());
      assert.equal(answer.status, 503);
      assert.equal(answer.headers.get('Retry-After'), '15');
      assert.equal(answer.headers.get('Cache-Control'), 'no-store');
      assert.equal((await server.fetch(preflight(WEB))).status, 204);
      assert.deepEqual(seen.starts, []);
    });
  }

  it('answers 503 past its patience, once started, and hands the next request on when the server is up', async () => {
    const { seen, box, server } = made({ listening: false });
    const waiting = server.fetch(request());
    await pass(17_000);
    let settled = false;
    void waiting.then(() => (settled = true));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(settled, false);
    await pass(2_000);
    assert.equal((await waiting).status, 503);
    assert.equal(seen.starts.length, 1);
    box.listening = true;
    assert.equal((await server.fetch(request())).status, 200);
    assert.equal(seen.starts.length, 1);
  });

  it('does not take a failing health check for a server that is up', async () => {
    const { box, server, seen } = made();
    box.health = 500;
    const waiting = server.fetch(request());
    await pass(19_000);
    assert.equal((await waiting).status, 503);
    assert.deepEqual(seen.requests, []);
  });

  it('keeps trying while the platform has no instance to give', async () => {
    const { seen, box, server } = made({ refuseStart: true, listening: false });
    const waiting = server.fetch(request());
    await pass(2_000);
    box.refuseStart = false;
    box.listening = true;
    await pass(1_000);
    assert.equal((await waiting).status, 200);
    assert.equal(seen.starts.length, 1);
  });

  it('answers 503 when the running server stops answering, and starts it again once it has stopped', async () => {
    const { seen, box, server } = made();
    await server.fetch(request());
    box.listening = false;
    assert.equal((await server.fetch(request())).status, 503);
    box.running = false;
    box.listening = true;
    assert.equal((await server.fetch(request())).status, 200);
    assert.equal(seen.starts.length, 2);
  });

  it('sets its time to sleep again when it restarts with the container running', () => {
    const { seen } = made({ running: true });
    assert.deepEqual(seen.timeouts, [SLEEP_AFTER_MS]);
    assert.equal(seen.blocked, 1);
  });

  it('reaches a running container after a restart with no new start', async () => {
    const { seen, server } = made({ running: true });
    assert.equal((await server.fetch(request())).status, 200);
    assert.deepEqual(seen.starts, []);
  });

  it('sets its time to sleep at the next wake when the platform refused it', async () => {
    const { seen, box, server } = made({ listening: false, refuseTimeout: true });
    const first = server.fetch(request());
    await pass(19_000);
    assert.equal((await first).status, 503);
    const tried = seen.timeouts.length;
    assert.ok(tried > 0);
    box.refuseTimeout = false;
    box.listening = true;
    assert.equal((await server.fetch(request())).status, 200);
    assert.equal(seen.timeouts.length, tried + 1);
    assert.equal(seen.starts.length, 1);
    await server.fetch(request());
    assert.equal(seen.timeouts.length, tried + 1);
  });

  it('survives the platform refusing its time to sleep as it restarts, and asks again at the next wake', async () => {
    const { seen, box, server } = made({ running: true, refuseTimeout: true });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(seen.timeouts, [SLEEP_AFTER_MS]);
    box.refuseTimeout = false;
    assert.equal((await server.fetch(request())).status, 200);
    assert.deepEqual(seen.timeouts, [SLEEP_AFTER_MS, SLEEP_AFTER_MS]);
  });
});
