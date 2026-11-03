// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The observatory's count of schools (#626, answer 677): sendings seeded and
// sent keep their school's mark for the run in place of the school-and-term
// code, one school's sendings one mark, so a figure counts each school once;
// after the run the store and the logs hold no code and no hash of one; a
// sending sent again takes its new mark in place of its old; a refused sending
// keeps nothing; and a server started again on the same store marks a school
// afresh, so a school seen before and after counts once at most. Every world,
// school and sending here is made up.

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';
import { MemoryInsightStore } from '../src/insights/insight-store.js';
import { MARK, schoolsIn } from '../src/insights/school-marks.js';
import type { KeptSending } from '../src/insights/sending-read.js';
import { PlainLogger } from '../src/plain-logger.js';
import { MemoryWorldStore } from '../src/worlds/world-store.js';
import { madeUpSending, startedWorld } from './insights-kit.js';
import { OPEN, WITH_PASS } from './state-kit.js';

const schoolsOf = (sendings: readonly KeptSending[], wilaya?: string) =>
  schoolsIn(sendings.filter((one) => wilaya === undefined || one.wilaya === wilaya).map((one) => one.mark));

describe('the observatory’s count of schools', () => {
  const store = new MemoryWorldStore();
  const insights = new MemoryInsightStore(async (id) => (await store.get(id)) !== undefined);
  const lines: string[] = [];
  const apps: NestNodeApplication[] = [];
  const plenty = { perAddress: 100_000, total: 100_000, windowMs: 60 * 60_000 };

  async function server(): Promise<string> {
    const logger = new PlainLogger(
      (line) => lines.push(line),
      (line) => lines.push(line),
    );
    const limits = { starts: OPEN, joins: OPEN, relay: plenty, uploads: plenty, sendings: plenty };
    const app = await createApp(logger, { store, insights, ...limits, now: () => Date.UTC(2026, 10, 30, 10) });
    await app.listen(0, '127.0.0.1');
    apps.push(app);
    return app.getUrl();
  }

  after(async () => {
    for (const app of apps) await app.close();
  });

  const json = { ...WITH_PASS, 'content-type': 'application/json' };
  const send = (base: string, id: string, body: unknown) =>
    fetch(`${base}/worlds/${id}/insights/sendings`, { method: 'PUT', headers: json, body: JSON.stringify(body) });

  it('counts each school once, keeps no code, and counts a school once at most over a restart', async () => {
    const base = await server();
    const { id, starter } = await startedWorld(base);
    const seeded = [madeUpSending(1, 1, 1), madeUpSending(2, 2, 1), madeUpSending(3, 3, 2)];
    const opened = await fetch(`${base}/worlds/${id}/insights`, {
      method: 'POST',
      headers: { ...json, authorization: `Bearer ${starter}` },
      body: JSON.stringify({ sendings: seeded }),
    });
    assert.equal(opened.status, 200);
    assert.equal((await send(base, id, { ...madeUpSending(4, 4, 3), wilaya: '31' })).status, 201);
    assert.equal((await send(base, id, madeUpSending(1, 2))).status, 409);
    let kept = await insights.sendings(id);
    assert.equal(schoolsOf(kept, '16'), 2);
    assert.equal(schoolsOf(kept, '31'), 1);
    assert.equal(schoolsOf(kept), 3);
    for (const one of kept) assert.match(one.mark, MARK);

    assert.equal((await send(base, id, { ...madeUpSending(3, 3, 1), release: '2027.2' })).status, 200);
    kept = await insights.sendings(id);
    assert.equal(
      schoolsOf(
        kept.filter((one) => one.release === '2027.1'),
        '16',
      ),
      1,
    );
    assert.equal(schoolsOf(kept), 2);

    const codes = [1, 2, 3].map((school) => madeUpSending(1, 1, school).schoolTerm);
    const text = JSON.stringify(kept) + lines.join('\n');
    for (const code of codes) assert.equal(text.includes(code), false);
    assert.equal(/[0-9a-f]{64}/.test(text), false);
    assert.equal(text.includes('schoolTerm'), false);

    const again = await server();
    assert.equal((await send(again, id, madeUpSending(5, 5, 1))).status, 201);
    assert.equal((await send(again, id, madeUpSending(6, 6, 7))).status, 201);
    kept = await insights.sendings(id);
    assert.equal(schoolsOf(kept), 2);
    assert.equal(new Set(kept.map((one) => one.mark.slice(0, 8))).size, 2);
  });
});
