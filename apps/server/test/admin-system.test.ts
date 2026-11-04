// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The operators' view of the server (#618, answer 655): only with a world's
// pass, a wrong one answered as an unknown world; the package's version, the
// fingerprint of its built code, its parts and its storage, the same through
// every world and naming none; PostgreSQL's state as its probe gives it; 503
// with the database failing, the same to everyone, when checking the pass
// fails or hangs; 500 when a store kept in memory fails; and its requests
// sharing one budget with the other world requests. Every world is made up.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { BUILT, fingerprintOf } from '../src/admin/fingerprint.js';
import type { StorageState, SystemProbe } from '../src/admin/system-probe.js';
import { createApp } from '../src/app.js';
import { VERSION } from '../src/version.js';
import type { WorldsOptions } from '../src/worlds/worlds.module.js';
import { MemoryWorldStore, type World } from '../src/worlds/world-store.js';
import { freshId, OPEN, PASS, WITH_PASS } from './state-kit.js';

const WRONG = { 'x-world-pass': 'd3JvbmctcGFzcy1mb3ItYS1tYWRlLXVwLXdvcmxkLTAx' };
const PARTS = ['gateway', 'relay', 'totals', 'standins', 'observatory'];

/** A made-up PostgreSQL probe answering as it is told. */
function probe(state: StorageState): SystemProbe {
  return { storage: 'postgresql', check: () => Promise.resolve(state) };
}

/** A world store whose reads fail, or never end. */
class BrokenStore extends MemoryWorldStore {
  constructor(private readonly hangs: boolean) {
    super();
  }

  override get(): Promise<World | undefined> {
    return this.hangs ? new Promise(() => undefined) : Promise.reject(new Error('the database is down'));
  }
}

async function serve(options: WorldsOptions): Promise<{ app: NestNodeApplication; base: string }> {
  const app = await createApp(false, { starts: OPEN, joins: OPEN, ...options });
  await app.listen(0, '127.0.0.1');
  return { app, base: await app.getUrl() };
}

async function start(base: string): Promise<string> {
  const world = freshId();
  const res = await fetch(`${base}/worlds`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ world, sealed: 'c2VhbGVkLXdvcmxk', date: '2026-12-01', announcedDays: [], pass: PASS }),
  });
  assert.equal(res.status, 201);
  return world;
}

const system = (base: string, world: string, headers: Record<string, string> = WITH_PASS) =>
  fetch(`${base}/worlds/${world}/admin/system`, { headers });

describe("the operators' view of the server", () => {
  let app: NestNodeApplication;
  let base: string;

  before(async () => {
    ({ app, base } = await serve({ store: new MemoryWorldStore() }));
  });

  after(async () => {
    await app.close();
  });

  it('answers only with the pass, a wrong one as an unknown world', async () => {
    const world = await start(base);
    const wrong = await system(base, world, WRONG);
    const none = await system(base, world, {});
    const unknown = await system(base, 'ZZZZZ');
    assert.deepEqual([wrong.status, none.status, unknown.status], [404, 404, 404]);
    assert.deepEqual(await wrong.json(), await unknown.json());
  });

  it('answers the version, the fingerprint, the parts and the storage, the same through every world', async () => {
    const first = await start(base);
    const second = await start(base);
    const res = await system(base, first);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const text = await res.text();
    const view = JSON.parse(text) as { fingerprint: string };
    assert.deepEqual(view, { version: VERSION, fingerprint: fingerprintOf(BUILT), parts: PARTS, storage: 'memory' });
    assert.match(view.fingerprint, /^[0-9a-f]{64}$/);
    assert.equal(text.includes(first), false);
    assert.equal(await (await system(base, second)).text(), text);
  });
});

describe("the operators' view of PostgreSQL", () => {
  it("answers the database's state as its probe gives it", async () => {
    for (const state of [
      { storage: 'postgresql', database: 'ok', archive: 'on', archiving: 'ok', restore: null },
      {
        storage: 'postgresql',
        database: 'ok',
        archive: 'on',
        archiving: 'failing',
        restore: { day: '2026-12-01', result: 'passed' },
      },
      { storage: 'postgresql', database: 'ok', archive: 'off' },
      { storage: 'postgresql', database: 'failing' },
    ] as const) {
      const { app, base } = await serve({ store: new MemoryWorldStore(), probe: probe(state) });
      try {
        const res = await system(base, await start(base));
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), {
          version: VERSION,
          fingerprint: fingerprintOf(BUILT),
          parts: PARTS,
          ...state,
        });
      } finally {
        await app.close();
      }
    }
  });

  it('answers 503 with the database failing, the same to everyone, when the pass cannot be checked', async () => {
    const ok = probe({ storage: 'postgresql', database: 'ok', archive: 'on', archiving: 'ok', restore: null });
    for (const hangs of [false, true]) {
      const { app, base } = await serve({ store: new BrokenStore(hangs), probe: ok });
      try {
        const answers = await Promise.all([system(base, 'AAAAA'), system(base, 'AAAAA', WRONG)]);
        for (const res of answers) {
          assert.equal(res.status, 503);
          assert.deepEqual(await res.json(), {
            version: VERSION,
            fingerprint: fingerprintOf(BUILT),
            parts: PARTS,
            storage: 'postgresql',
            database: 'failing',
          });
        }
      } finally {
        await app.close();
      }
    }
  });
});

describe("the operators' view of a store kept in memory", () => {
  it('answers 500 when the store fails, since memory is not a database to say is failing', async () => {
    const { app, base } = await serve({ store: new BrokenStore(false) });
    try {
      assert.equal((await system(base, 'AAAAA')).status, 500);
    } finally {
      await app.close();
    }
  });
});

describe("the operators' view among the world requests", () => {
  it('shares one budget with them', async () => {
    const { app, base } = await serve({ joins: { perAddress: 3, total: 1000, windowMs: 60_000 } });
    try {
      const statuses = [(await fetch(`${base}/worlds/AAAAA/date`, { headers: WITH_PASS })).status];
      for (let i = 0; i < 3; i += 1) statuses.push((await system(base, 'AAAAA')).status);
      assert.deepEqual(statuses, [404, 404, 404, 429]);
    } finally {
      await app.close();
    }
  });
});
