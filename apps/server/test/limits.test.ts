// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Rate limits on starting and joining worlds (#540): per address and for
// everyone, over a window, and Cloudflare's header read only when trusted.

import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import { describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { clientAddress, Limiter, limitKey } from '../src/worlds/limits.js';

function request(remoteAddress: string | undefined, headers: Record<string, string> = {}): IncomingMessage {
  return { socket: { remoteAddress }, headers } as unknown as IncomingMessage;
}

describe('the rate limits', () => {
  it('lets each address take its share in a window, then refuses until the window passes', () => {
    let now = 0;
    const limiter = new Limiter({ perAddress: 2, total: 10, windowMs: 1000 }, () => now);
    assert.equal(limiter.take('10.0.0.1'), true);
    assert.equal(limiter.take('10.0.0.1'), true);
    assert.equal(limiter.take('10.0.0.1'), false);
    assert.equal(limiter.take('10.0.0.2'), true);
    now = 1001;
    assert.equal(limiter.take('10.0.0.1'), true);
  });

  it('refuses everyone once the total is reached', () => {
    let now = 0;
    const limiter = new Limiter({ perAddress: 5, total: 3, windowMs: 1000 }, () => now);
    for (const address of ['10.0.0.1', '10.0.0.2', '10.0.0.3']) assert.equal(limiter.take(address), true);
    assert.equal(limiter.take('10.0.0.4'), false);
    now = 1500;
    assert.equal(limiter.take('10.0.0.4'), true);
  });

  it("reads Cloudflare's header only when told the server runs behind it", () => {
    const behind = request('172.16.0.9', { 'cf-connecting-ip': '192.0.2.7' });
    assert.equal(clientAddress(behind, true), '192.0.2.7');
    assert.equal(clientAddress(behind, false), '172.16.0.9');
    assert.equal(clientAddress(request('172.16.0.9'), true), '172.16.0.9');
    assert.equal(clientAddress(request(undefined), false), 'unknown');
  });

  it('counts an IPv6 address by its /64, and an IPv4-mapped address as IPv4', () => {
    assert.equal(limitKey('2001:db8:aa:1::1'), '2001:db8:aa:1::/64');
    assert.equal(limitKey('2001:0db8:00aa:0001:ffff:1:2:3'), '2001:db8:aa:1::/64');
    assert.equal(limitKey('2001:db8::7'), '2001:db8:0:0::/64');
    assert.equal(limitKey('::1'), '0:0:0:0::/64');
    assert.equal(limitKey('fe80::1%eth0'), 'fe80:0:0:0::/64');
    assert.equal(limitKey('1::2:3:4:5:1.2.3.4'), '1:0:2:3::/64');
    assert.equal(limitKey('64:ff9b::192.0.2.1'), '64:ff9b:0:0::/64');
    assert.equal(limitKey('::ffff:192.0.2.7'), '192.0.2.7');
    assert.equal(limitKey('192.0.2.7'), '192.0.2.7');
    assert.equal(limitKey('unknown'), 'unknown');
    const limiter = new Limiter({ perAddress: 1, total: 10, windowMs: 1000 }, () => 0);
    assert.equal(limiter.take(clientAddress(request('2001:db8:aa:1::1'), false)), true);
    assert.equal(limiter.take(clientAddress(request('2001:db8:aa:1:9:9:9:9'), false)), false);
    assert.equal(limiter.take(clientAddress(request('2001:db8:aa:2::1'), false)), true);
    const behind = request('172.16.0.9', { 'cf-connecting-ip': '2001:db8:aa:1::5' });
    assert.equal(clientAddress(behind, true), '2001:db8:aa:1::/64');
  });

  it('answers 429 to starts and joins over the limit', async () => {
    const tight = { perAddress: 2, total: 100, windowMs: 60_000 };
    const app = await createApp(false, { starts: tight, joins: tight });
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    try {
      const start = (world: string): Promise<Response> =>
        fetch(`${base}/worlds`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ world, sealed: 'c2VhbGVk', date: '2026-12-01', announcedDays: [] }),
        });
      assert.equal((await start('K1MT1')).status, 201);
      assert.equal((await start('K1MT2')).status, 201);
      assert.equal((await start('K1MT3')).status, 429);
      assert.equal((await fetch(`${base}/worlds/K1MT1`)).status, 200);
      assert.equal((await fetch(`${base}/worlds/K1MT2/date`)).status, 200);
      assert.equal((await fetch(`${base}/worlds/K1MT1`)).status, 429);
    } finally {
      await app.close();
    }
  });
});
