// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reading the day's totals (#596, answer 628): GET /worlds/:world/totals/:day
// answers, only with the pass and never stored on the way, the Ministry's view
// of the shares kept, every directorate's and the nation's, and with
// ?directorate= one directorate's own, each as share-sums.ts adds them up;
// a day not announced or not reached is refused, and so is a directorate not
// named as the reference data names one, __proto__ among them, or named twice;
// and a day with no share shows only the nation's known zeros. Every world and
// share here is made up.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';
import type { Share } from '../src/totals/share-read.js';
import { MemoryShareStore } from '../src/totals/share-store.js';
import { dayTotals } from '../src/totals/share-sums.js';
import { MemoryWorldStore } from '../src/worlds/world-store.js';
import { announcedWorld, madeUpShare } from './share-kit.js';
import { OPEN, WITH_PASS } from './state-kit.js';

describe('the day’s totals', () => {
  let app: NestNodeApplication;
  let base: string;
  const shares = new MemoryShareStore();

  before(async () => {
    const store = new MemoryWorldStore();
    app = await createApp(false, { store, shares, starts: OPEN, joins: OPEN, relay: OPEN, uploads: OPEN });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  const get = (id: string, day: string, query = '', headers: Record<string, string> = WITH_PASS) =>
    fetch(`${base}/worlds/${id}/totals/${day}${query}`, { headers });

  /** Made-up shares of three directorates: the first of three schools, the others of four. */
  const kept = (): Share[] =>
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((at) => ({
      ...madeUpShare(at, '2026-12-06', at <= 3 ? 2 : 4),
      directorate: at <= 3 ? 'dir-01' : at <= 7 ? 'dir-02' : 'dir-03',
    }));

  it('answers the Ministry’s view and a directorate’s own, only with the pass', async () => {
    const id = await announcedWorld(base);
    for (const share of kept()) assert.equal(await shares.put(id, share), 'added');
    assert.equal((await get(id, '2026-12-06', '', {})).status, 404);
    const ministry = await get(id, '2026-12-06');
    assert.equal(ministry.status, 200);
    assert.equal(ministry.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await ministry.json(), dayTotals('2026-12-06', kept(), null));
    const own = await get(id, '2026-12-06', '?directorate=dir-01');
    assert.deepEqual(await own.json(), dayTotals('2026-12-06', kept(), 'dir-01'));
    const none = await get(id, '2026-12-06', '?directorate=dir-09');
    assert.deepEqual(await none.json(), dayTotals('2026-12-06', kept(), 'dir-09'));
  });

  it('refuses a day not announced or not reached, and a directorate not named right', async () => {
    const id = await announcedWorld(base);
    assert.equal((await get(id, '2026-12-07')).status, 422);
    assert.equal((await get(id, '2026-12-20')).status, 422);
    assert.equal((await get(id, 'today')).status, 400);
    for (const query of ['?directorate=__proto__', '?directorate=dir%2001', '?directorate=a&directorate=b']) {
      assert.equal((await get(id, '2026-12-06', query)).status, 400, query);
    }
    const empty = await (await get(id, '2026-12-06')).json();
    assert.deepEqual(empty, {
      day: '2026-12-06',
      directorates: [],
      national: dayTotals('2026-12-06', [], null).national,
    });
  });
});
