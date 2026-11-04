// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up container and Durable Object state for the tests of host/worker.ts,
// which records what the Worker asks of it. All values here are made up.

import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { DemoServer } from '../host/worker.js';
import type { Env, State } from '../host/worker.js';

export const SECRETS = {
  AWS_ENDPOINT: 'https://made-up.r2.example',
  AWS_ACCESS_KEY_ID: 'made-up-id',
  AWS_SECRET_ACCESS_KEY: 'made-up-secret',
  WALG_LIBSODIUM_KEY: 'ab'.repeat(32),
};
export const SLEEP_AFTER_MS = 30 * 60_000;
export const namespace: Env['SERVER'] = {
  idFromName: () => 'id',
  get: () => ({ fetch: () => Promise.reject(new Error()) }),
};
export const env = { ...SECRETS, SERVER: namespace };

/** A container that answers once `listening` says so, and a Durable Object's state around it. */
export function made(
  overrides: { listening?: boolean; refuseStart?: boolean; refuseTimeout?: boolean; running?: boolean } = {},
) {
  const seen = { starts: [] as unknown[], timeouts: [] as number[], requests: [] as Request[], pings: 0, blocked: 0 };
  const box = {
    running: overrides.running ?? false,
    listening: overrides.listening ?? true,
    refuseStart: overrides.refuseStart ?? false,
    health: 200,
    refuseTimeout: overrides.refuseTimeout ?? false,
  };
  const state: State = {
    container: {
      get running() {
        return box.running;
      },
      start(options) {
        if (box.refuseStart) throw new Error('no instance yet');
        assert.equal(box.running, false);
        box.running = true;
        seen.starts.push(options);
      },
      setInactivityTimeout(ms) {
        seen.timeouts.push(ms);
        return box.refuseTimeout ? Promise.reject(new Error('made up')) : Promise.resolve();
      },
      getTcpPort: (port) => {
        assert.equal(port, 8080);
        return {
          fetch(input) {
            if (!box.listening) return Promise.reject(new Error('not listening'));
            if (typeof input === 'string') {
              seen.pings += 1;
              return Promise.resolve(new Response('{}', { status: box.health }));
            }
            if (input.url.startsWith('https:')) return Promise.reject(new Error('no HTTPS to a container'));
            seen.requests.push(input);
            return Promise.resolve(new Response('served'));
          },
        };
      },
    },
    blockConcurrencyWhile(work) {
      seen.blocked += 1;
      return work();
    },
  };
  return { seen, box, state, server: new DemoServer(state, env) };
}

export const WEB = 'https://minhajna.djazair.dev';
export const request = () =>
  new Request('https://demo.example/worlds', { headers: { 'CF-Connecting-IP': '192.0.2.7' } });
export const preflight = (origin: string) =>
  new Request('https://demo.example/worlds', {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
  });

/** Lets mocked time pass in steps, so a wait in the Worker sees each of them. */
export async function pass(ms: number): Promise<void> {
  for (let gone = 0; gone < ms; gone += 500) {
    mock.timers.tick(500);
    await new Promise((resolve) => setImmediate(resolve));
  }
}
