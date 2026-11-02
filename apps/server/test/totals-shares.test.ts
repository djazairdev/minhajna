// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Taking the schools' shares of the totals (#596, answer 628): a share for an
// announced day the world's date has reached is kept, only with the pass, 201
// when new and 200 when sent again, its ID alone answered; a day not announced
// or not reached yet, a share for another day, or one shaped otherwise in any
// field, a name an object already holds such as __proto__ among them, is
// refused with nothing kept; a body over 256 KB is refused before it is read; a
// share costs the daily quota of uploads as the sealed batches its bytes fill,
// refused beyond it; and the sweeper erases the shares with the world. Every
// world and share here is made up.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';
import { MemoryShareStore } from '../src/totals/share-store.js';
import { MemoryWorldStore } from '../src/worlds/world-store.js';
import { WorldSweeper } from '../src/worlds/world-sweeper.js';
import { madeUpShare } from './share-kit.js';
import { freshId, OPEN, PASS, WITH_PASS } from './state-kit.js';

describe('the schools’ shares of the totals', () => {
  let app: NestNodeApplication;
  let base: string;
  const store = new MemoryWorldStore();
  const shares = new MemoryShareStore();
  let clock = Date.UTC(2026, 10, 30, 10);

  before(async () => {
    const uploads = { perAddress: 6, total: 1000, windowMs: 60 * 60_000 };
    app = await createApp(false, { store, shares, starts: OPEN, joins: OPEN, relay: OPEN, uploads, now: () => clock });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  /** A world dated 2026-12-01, its date moved onto its first announced day, 2026-12-06. */
  async function world(): Promise<string> {
    const id = freshId();
    const body = {
      world: id,
      sealed: 'c2VhbGVkLXdvcmxk',
      date: '2026-12-01',
      announcedDays: ['2026-12-06', '2026-12-20'],
    };
    const res = await fetch(`${base}/worlds`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, pass: PASS }),
    });
    const { starter } = (await res.json()) as { starter: string };
    const moved = await fetch(`${base}/worlds/${id}/date`, {
      method: 'POST',
      headers: { ...WITH_PASS, authorization: `Bearer ${starter}` },
    });
    assert.deepEqual(await moved.json(), { date: '2026-12-06' });
    return id;
  }

  const put = (id: string, day: string, body: unknown, headers: Record<string, string> = WITH_PASS) =>
    fetch(`${base}/worlds/${id}/totals/${day}/shares`, {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('keeps a share for a day the date reached, once, only with the pass', async () => {
    const id = await world();
    assert.equal((await put(id, '2026-12-06', madeUpShare(1), {})).status, 404);
    const first = await put(id, '2026-12-06', madeUpShare(1));
    assert.equal(first.status, 201);
    assert.equal(first.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await first.json(), { id: madeUpShare(1).id });
    const again = await put(id, '2026-12-06', madeUpShare(1, '2026-12-06', 8));
    assert.equal(again.status, 200);
    assert.deepEqual(await shares.shares(id, '2026-12-06'), [madeUpShare(1, '2026-12-06', 8)]);
  });

  it('refuses a day not announced or not reached, another day’s share, and every other shape', async () => {
    const id = await world();
    assert.equal((await put(id, '2026-12-07', madeUpShare(1, '2026-12-07'))).status, 422);
    assert.equal((await put(id, '2026-12-20', madeUpShare(1, '2026-12-20'))).status, 422);
    assert.equal((await put(id, 'today', madeUpShare(1))).status, 400);
    assert.equal((await put(id, '2026-12-06', madeUpShare(1, '2026-12-20'))).status, 400);
    const share = madeUpShare(2);
    const math = share.subjects['math']!;
    const wrong: unknown[] = [
      { ...share, format: 'minhajna/total-share/2' },
      { ...share, id: 'A'.repeat(64) },
      { ...share, id: 'a'.repeat(32) },
      { ...share, directorate: 'dir 01' },
      { ...share, school: 'made-up-school' },
      { ...share, subjects: { 'math teachers': math } },
      { ...share, subjects: { math: { ...math, teachers: -1 } } },
      { ...share, subjects: { math: { ...math, reached: 1.5 } } },
      { ...share, subjects: { math: { ...math, teacher: 'made-up-teacher' } } },
      { ...share, subjects: { math: { ...math, items: { 'item 01': math.items['item-01'] } } } },
      { ...share, subjects: { math: { ...math, items: { 'item-01': { sessions: 1, merged: 0, skipped: 0 } } } } },
      { ...share, subjects: Object.fromEntries(Array.from({ length: 65 }, (_, at) => [`s${at}`, math])) },
      { ...share, directorate: '__proto__' },
      { ...share, subjects: { ['__proto__']: math } },
      { ...share, subjects: { constructor: math } },
      { ...share, subjects: { math: { ...math, items: { toString: math.items['item-01'] } } } },
      [share],
    ];
    for (const body of wrong) assert.equal((await put(id, '2026-12-06', body)).status, 400, JSON.stringify(body));
    assert.deepEqual(await shares.shares(id, '2026-12-06'), []);
  });

  it('refuses a body over 256 KB unread, charges the daily quota by size, and erases with the world', async () => {
    const id = await world();
    const items = (count: number) =>
      Object.fromEntries(
        Array.from({ length: count }, (_, at) => [`item-${at}`, { sessions: 1, merged: 0, skipped: 0, retaught: 0 }]),
      );
    const share = madeUpShare(3);
    const math = share.subjects['math']!;
    const large = {
      ...share,
      subjects: Object.fromEntries(['arabic', 'french', 'math'].map((one) => [one, { ...math, items: items(2000) }])),
    };
    assert.equal((await put(id, '2026-12-06', large)).status, 413);
    assert.equal((await put(id, '2026-12-06', share)).status, 201);
    const costly = { ...madeUpShare(4), subjects: { math: { ...math, items: items(600) } } };
    assert.equal((await put(id, '2026-12-06', costly)).status, 429);
    assert.deepEqual(await shares.shares(id, '2026-12-06'), [share]);
    clock = Date.UTC(2026, 11, 7, 10);
    await app.get(WorldSweeper).sweep();
    assert.equal(await store.get(id), undefined);
    assert.deepEqual(await shares.shares(id, '2026-12-06'), []);
  });
});
