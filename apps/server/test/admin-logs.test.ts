// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The operators' logs (#619, answer 656): only with a world's pass; the admin
// log saying the server started, with its version, fingerprint and the
// migrations it applied, newest first, and a sweep dropping its lines older
// than 12 months; and the security log counting, by day and kind and nothing
// else, requests over the rate limits, a pass that opened nothing, a starter
// token refused, and certificate requests and deliveries refused, with or
// without a trailing slash, but no other failure, nor a world gone during a
// request, kept 7 days in memory only and never in the admin store, and
// answered the same through every world. Every world here is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpException } from '@nestjs/common';
import { MemoryAdminStore } from '../src/admin/admin-store.js';
import { FINGERPRINT } from '../src/admin/fingerprint.js';
import { SecurityLog, securityKind } from '../src/admin/security-log.js';
import { createApp } from '../src/app.js';
import { VERSION } from '../src/version.js';
import { noWorld, PassRefused } from '../src/worlds/world-access.js';
import { WorldSweeper } from '../src/worlds/world-sweeper.js';
import type { WorldsOptions } from '../src/worlds/worlds.module.js';
import { freshId, NOW, OPEN, PASS, WITH_PASS } from './state-kit.js';

const DAY = 86_400_000;
const ZERO = {
  'rate-limited': 0,
  'pass-refused': 0,
  'starter-refused': 0,
  'certificate-refused': 0,
  'delivery-refused': 0,
};

async function serve(options: WorldsOptions, test: (base: string) => Promise<void>): Promise<void> {
  const app = await createApp(false, { starts: OPEN, joins: OPEN, now: NOW, ...options });
  await app.listen(0, '127.0.0.1');
  try {
    await test(await app.getUrl());
  } finally {
    await app.close();
  }
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

const read = async (base: string, world: string, path: string) => {
  const res = await fetch(`${base}/worlds/${world}/admin/${path}`, { headers: WITH_PASS });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  return res.json();
};

describe('the admin log', () => {
  it('says the server started, with what it applied, only with the pass', async () => {
    const admin = new MemoryAdminStore();
    await serve({ admin, migrations: ['0006_admin'] }, async (base) => {
      const world = await start(base);
      assert.equal((await fetch(`${base}/worlds/${world}/admin/log`)).status, 404);
      const fingerprint = FINGERPRINT ?? 'none';
      assert.deepEqual(await read(base, world, 'log'), {
        lines: [
          {
            day: '2026-11-30',
            action: 'server.started',
            detail: { version: VERSION, fingerprint, migrations: ['0006_admin'] },
          },
        ],
      });
    });
    await serve({ admin }, async (base) => {
      const lines = ((await read(base, await start(base), 'log')) as { lines: { detail: object }[] }).lines;
      assert.equal(lines.length, 2);
      assert.deepEqual(lines[0]?.detail, { version: VERSION, fingerprint: FINGERPRINT ?? 'none' });
    });
  });
});

describe('the sweep', () => {
  it('drops the lines older than 12 months from the admin log', async () => {
    const admin = new MemoryAdminStore();
    await admin.log({ day: '2025-11-29', action: 'worlds.erased', detail: { count: 1 } });
    await admin.log({ day: '2025-11-30', action: 'worlds.erased', detail: { count: 2 } });
    const app = await createApp(false, { admin, now: NOW });
    try {
      await app.get(WorldSweeper).sweep();
      assert.deepEqual(await admin.lines(10), [{ day: '2025-11-30', action: 'worlds.erased', detail: { count: 2 } }]);
    } finally {
      await app.close();
    }
  });
});

describe('the security log', () => {
  it('counts each kind of refusal by day, and nothing else, the same through every world', async () => {
    const admin = new MemoryAdminStore();
    const tight = { perAddress: 6, total: 1000, windowMs: 60_000 };
    await serve({ admin, starts: tight, joins: OPEN }, async (base) => {
      const world = await start(base);
      const other = await start(base);
      const post = (path: string, body: unknown, headers: Record<string, string> = WITH_PASS) =>
        fetch(`${base}/worlds/${world}/${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify(body),
        });
      assert.equal((await fetch(`${base}/worlds/${world}/date`)).status, 404);
      assert.equal((await fetch(`${base}/worlds/ZZZZZ/date`, { headers: WITH_PASS })).status, 404);
      assert.equal((await post('date', {}, { ...WITH_PASS, authorization: 'Bearer wrong-token' })).status, 403);
      assert.equal((await post('certificates', { world })).status, 400);
      assert.equal((await post('seed/certificates/', { requests: 1 })).status, 403);
      assert.equal((await post('certificates/', { world })).status, 400);
      assert.equal((await post('state/deliveries', { kind: 'marks', sealed: 'AAAA' })).status, 400);
      assert.equal((await post('state/deliveries/', { kind: 'marks', sealed: 'AAAA' })).status, 400);
      assert.equal((await post('problems', { part: 'none' })).status, 400);
      assert.equal((await fetch(`${base}/nowhere`)).status, 404);
      assert.equal((await fetch(`${base}/worlds/${world}/admin/security`)).status, 404);
      for (let i = 0; i < 6; i += 1) await fetch(`${base}/worlds`, { method: 'POST' });
      const security = await read(base, world, 'security');
      assert.deepEqual(security, {
        keptDays: 7,
        days: [
          {
            day: '2026-11-30',
            counts: {
              ...ZERO,
              'rate-limited': 2,
              'pass-refused': 3,
              'starter-refused': 2,
              'certificate-refused': 2,
              'delivery-refused': 2,
            },
          },
        ],
      });
      assert.deepEqual(await read(base, other, 'security'), security);
      assert.equal(JSON.stringify(await admin.lines(10)).includes('refused'), false);
    });
  });

  it('keeps 7 days, newest first', () => {
    let now = NOW();
    const log = new SecurityLog(() => now);
    for (let day = 0; day < 9; day += 1) {
      log.count('pass-refused');
      now += DAY;
    }
    now -= DAY;
    const days = log.days();
    assert.deepEqual(
      days.map((one) => one.day),
      ['2026-12-08', '2026-12-07', '2026-12-06', '2026-12-05', '2026-12-04', '2026-12-03', '2026-12-02'],
    );
    assert.deepEqual(days[0]?.counts, { ...ZERO, 'pass-refused': 1 });
  });

  it('tells the kinds apart by status and route alone', () => {
    const at = (status: number, message = 'refused') => new HttpException(message, status);
    assert.equal(securityKind(at(404, 'no such report'), '/worlds/AAAAA/problems/x/fixed'), null);
    assert.equal(securityKind(new PassRefused(), '/worlds/AAAAA'), 'pass-refused');
    assert.equal(securityKind(noWorld(), '/worlds/AAAAA/spaces/s/batches'), null);
    assert.equal(securityKind(at(409), '/worlds/AAAAA/seed/certificates'), 'certificate-refused');
    assert.equal(securityKind(at(422), '/worlds/AAAAA/state/deliveries?x=1'), 'delivery-refused');
    assert.equal(securityKind(at(503), '/worlds/AAAAA/state/deliveries'), null);
    assert.equal(securityKind(at(400), '/worlds/AAAAA/spaces/s/batches'), null);
  });
});
