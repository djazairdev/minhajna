// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Worker's own part of the demo server's host (host/worker.ts), before any
// request reaches its Durable Object: which paths it hands on, plain HTTP, and
// the daily wake. All addresses here are made up but the one the cron asks.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import worker from '../host/worker.js';
import type { Env } from '../host/worker.js';

describe('the demo server’s Worker', () => {
  function reached() {
    const asked: (string | Request)[] = [];
    const named: string[] = [];
    const SERVER: Env['SERVER'] = {
      idFromName(name) {
        named.push(name);
        return name;
      },
      get: () => ({
        fetch(input) {
          asked.push(input);
          return Promise.resolve(new Response('served'));
        },
      }),
    };
    return { asked, named, env: { SERVER } };
  }

  it('answers a path the server never serves itself, and wakes nothing', async () => {
    const { asked, env: bare } = reached();
    for (const path of ['/', '/wp-login.php', '/healthz', '/worlds-of-made-up', '/health/more']) {
      assert.equal((await worker.fetch(new Request(`https://minhajna-demo.example${path}`), bare)).status, 404);
    }
    assert.deepEqual(asked, []);
  });

  it('sends plain HTTP to HTTPS, and nothing of it to the server', async () => {
    const { asked, env: bare } = reached();
    const answer = await worker.fetch(new Request('http://minhajna-demo.example/health?a=1'), bare);
    assert.equal(answer.status, 301);
    assert.equal(answer.headers.get('Location'), 'https://minhajna-demo.example/health?a=1');
    assert.deepEqual(asked, []);
  });

  it('hands HTTPS, and plain HTTP on this computer, to the one Durable Object', async () => {
    const { asked, named, env: bare } = reached();
    await worker.fetch(new Request('https://minhajna-demo.example/health'), bare);
    await worker.fetch(new Request('https://minhajna-demo.example/worlds'), bare);
    await worker.fetch(new Request('https://minhajna-demo.example/worlds/K7QF4/date'), bare);
    await worker.fetch(new Request('http://127.0.0.1:8787/health'), bare);
    assert.equal(asked.length, 4);
    assert.deepEqual(named, ['demo', 'demo', 'demo', 'demo']);
  });

  it('says the server is starting when its Durable Object fails, as a deploy may make it', async () => {
    const refusing: Env = {
      SERVER: { idFromName: () => 'id', get: () => ({ fetch: () => Promise.reject(new Error('made up')) }) },
    };
    const answer = await worker.fetch(new Request('https://minhajna-demo.example/health'), refusing);
    assert.equal(answer.status, 503);
    assert.equal(answer.headers.get('Retry-After'), '15');
    const asked = new Request('https://minhajna-demo.example/worlds', {
      method: 'OPTIONS',
      headers: { Origin: 'https://minhajna.djazair.dev', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal((await worker.fetch(asked, refusing)).status, 204);
  });

  it('wakes the server on its schedule, through its health check', async () => {
    const { asked, named, env: bare } = reached();
    await worker.scheduled(undefined, bare);
    assert.deepEqual(asked, ['https://minhajna-demo.djazair.dev/health']);
    assert.deepEqual(named, ['demo']);
  });
});
