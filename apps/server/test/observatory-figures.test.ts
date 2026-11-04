// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// An observatory's figures over HTTP (#626, answer 678): only the world's
// starter ends a term's collection, given as its year, two years in turn, and
// its term alone, once for good, at most 12 a world, and only in a world whose
// observatory is open; a sending for an ended term is refused, seeded or sent;
// the figures come only for an ended term, never while it is open, as its
// packs' headings, the nation's hidden left out, and each pack's figures by its
// place, formed as the term ends, a second end forming them if a first try
// failed, and never worked out again; a term and a place are asked for right;
// and a wrong pass finds no world. Every world, school and sending here is made
// up.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';
import { MemoryInsightStore } from '../src/insights/insight-store.js';
import { PlainLogger } from '../src/plain-logger.js';
import { MemoryWorldStore } from '../src/worlds/world-store.js';
import { madeUpSending, startedWorld } from './insights-kit.js';
import { OPEN, WITH_PASS } from './state-kit.js';

describe('an observatory’s figures over HTTP', () => {
  const store = new MemoryWorldStore();
  const insights = new MemoryInsightStore(async (id) => (await store.get(id)) !== undefined);
  const plenty = { perAddress: 100_000, total: 100_000, windowMs: 60 * 60_000 };
  const json = { ...WITH_PASS, 'content-type': 'application/json' };
  let app: NestNodeApplication;
  let base = '';

  before(async () => {
    const limits = { starts: OPEN, joins: OPEN, relay: plenty, uploads: plenty, sendings: plenty };
    const logger = new PlainLogger(
      () => {},
      () => {},
    );
    app = await createApp(logger, { store, insights, ...limits, now: () => Date.UTC(2026, 10, 30, 10) });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  after(() => app.close());

  const end = (id: string, body: unknown, starter?: string, pass: Record<string, string> = {}) =>
    fetch(`${base}/worlds/${id}/insights/closed`, {
      method: 'POST',
      headers: { ...json, ...pass, ...(starter === undefined ? {} : { authorization: `Bearer ${starter}` }) },
      body: JSON.stringify(body),
    });
  const figures = (id: string, query: string, headers: Record<string, string> = WITH_PASS) =>
    fetch(`${base}/worlds/${id}/insights/figures?${query}`, { headers });
  const term = { year: '2027-2028', term: 1 };

  const seed = (id: string, starter: string, sendings: unknown[]) =>
    fetch(`${base}/worlds/${id}/insights`, {
      method: 'POST',
      headers: { ...json, authorization: `Bearer ${starter}` },
      body: JSON.stringify({ sendings }),
    });
  const classes = Array.from({ length: 12 }, (_, at) => madeUpSending(at + 1, at + 1, (at % 3) + 1));

  it('ends a term only for the starter, given right, once for good, in an open observatory', async () => {
    const { id, starter } = await startedWorld(base);
    assert.equal((await end(id, term, starter)).status, 409);
    assert.equal((await figures(id, 'year=2027-2028&term=1')).status, 409);
    assert.equal((await seed(id, starter, classes)).status, 200);
    assert.equal((await end(id, term)).status, 403);
    for (const wrong of [
      { ...term, term: '1' },
      { ...term, term: 4 },
      { ...term, year: '2027' },
      { ...term, year: '2027-2029' },
      { year: term.year },
      { ...term, at: 1 },
      [term],
    ]) {
      assert.equal((await end(id, wrong, starter)).status, 400);
    }
    assert.equal((await end(id, term, starter, { 'x-world-pass': 'not-the-pass' })).status, 404);
    assert.equal((await end('ZZZZZ', term, starter)).status, 404);
    assert.equal((await figures(id, 'year=2027-2028&term=1')).status, 409);
    const ended = await end(id, term, starter);
    assert.equal(ended.status, 200);
    assert.deepEqual(await ended.json(), term);
    assert.equal((await end(id, term, starter)).status, 200);
    const late = await fetch(`${base}/worlds/${id}/insights/sendings`, {
      method: 'PUT',
      headers: json,
      body: JSON.stringify(madeUpSending(20, 20, 1)),
    });
    assert.equal(late.status, 409);
    assert.match(((await late.json()) as { message: string }).message, /term.*ended/);
    const seeded = await seed(id, starter, [{ ...madeUpSending(22, 22, 1), term: 2 }, madeUpSending(23, 23, 1)]);
    assert.equal(seeded.status, 409);
    assert.match(((await seeded.json()) as { message: string }).message, /^sending 1: .*ended/);
    for (let year = 2028; year < 2032; year += 1) {
      for (const one of [1, 2, 3]) {
        const status = (await end(id, { year: `${year}-${year + 1}`, term: one }, starter)).status;
        assert.equal(status, year === 2031 && one === 3 ? 409 : 200);
      }
    }
  });

  it('gives an ended term’s packs and each pack’s figures as kept, asked for right', async () => {
    const { id, starter } = await startedWorld(base);
    const other = { ...madeUpSending(30, 30, 1), pack: 'dz.cem.4am.arabic.other' };
    await seed(id, starter, [...classes, other]);
    const read = insights.sendings.bind(insights);
    let reads = 0;
    insights.sendings = (world) => {
      reads += 1;
      return read(world);
    };
    try {
      assert.equal((await end(id, term, starter)).status, 200);
      const index = await figures(id, 'year=2027-2028&term=1');
      assert.equal(index.status, 200);
      assert.equal(index.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await index.json(), {
        ...term,
        packs: [{ grade: '4am', subject: 'arabic', pack: 'dz.cem.4am.arabic.made-up', release: '2027.1' }],
      });
      const answer = await figures(id, 'year=2027-2028&term=1&at=0');
      const body = (await answer.json()) as { at: number; figures: { nation: Record<string, number> } };
      assert.equal(body.at, 0);
      const { classes: held, teachers, schools } = body.figures.nation;
      assert.deepEqual([held, teachers, schools], [12, 12, 3]);
      assert.deepEqual(await (await figures(id, 'year=2027-2028&term=1&at=0')).json(), body);
      assert.equal(reads, 0);
    } finally {
      insights.sendings = read;
    }
    const { id: retried, starter: retriedStarter } = await startedWorld(base);
    await seed(retried, retriedStarter, classes);
    const form = insights.form.bind(insights);
    insights.form = () => Promise.resolve();
    try {
      assert.equal((await end(retried, term, retriedStarter)).status, 200);
    } finally {
      insights.form = form;
    }
    const forming = await figures(retried, 'year=2027-2028&term=1');
    assert.equal(forming.status, 409);
    assert.match(((await forming.json()) as { message: string }).message, /being formed/);
    assert.equal((await end(retried, term, retriedStarter)).status, 200);
    const formed = await figures(retried, 'year=2027-2028&term=1');
    assert.equal(formed.status, 200);
    assert.deepEqual(((await formed.json()) as { packs: unknown[] }).packs, [
      { grade: '4am', subject: 'arabic', pack: 'dz.cem.4am.arabic.made-up', release: '2027.1' },
    ]);
    const wrong = ['term=4', 'term=01', 'year=2027-2028', 'term=1&year=2027', 'term=1&year=2027-2029', 'term=1&at=x'];
    for (const query of [...wrong, 'term=1&at=01', 'term=1&at=-1', 'term=1&at=1']) {
      const asked = query.includes('year') ? query : `${query}&year=2027-2028`;
      assert.equal((await figures(id, asked)).status, 400, asked);
    }
    assert.equal((await figures(id, 'year=2027-2028&term=2')).status, 409);
    assert.equal((await figures(id, 'year=2027-2028&term=1', { 'x-world-pass': 'not-the-pass' })).status, 404);
    assert.equal((await figures('ZZZZZ', 'year=2027-2028&term=1')).status, 404);
  });
});
