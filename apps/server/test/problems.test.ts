// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A world's problem reports over HTTP (#619, answer 656): only with the pass; a
// report as the app shapes it answered with its ID and a token, kept with the
// day it came, listed newest first without tokens, in its own world only; every
// other shape refused, a note with any control character but a new line, a bidi
// override or isolate, a lone surrogate or nothing shown among them; marking
// one fixed erasing it and adding a line to the admin log; its sender deleting
// it with the token alone; the cap of reports; and the reports erased with
// their world, on a fixed clock. Every world, note and version here is made up.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { MAX_PROBLEMS, MemoryAdminStore } from '../src/admin/admin-store.js';
import { createApp } from '../src/app.js';
import { MemoryWorldStore } from '../src/worlds/world-store.js';
import { WorldSweeper } from '../src/worlds/world-sweeper.js';
import { freshId, NOW, OPEN, PASS, WITH_PASS } from './state-kit.js';

const REPORT = { part: 'roll', note: 'A made-up note.\nThe roll call did not save.', version: '0.7.0' };
const JSON_PASS = { 'content-type': 'application/json', ...WITH_PASS };

describe("a world's problem reports", () => {
  let app: NestNodeApplication;
  let base: string;
  const admin = new MemoryAdminStore();
  const store = new MemoryWorldStore();

  before(async () => {
    app = await createApp(false, { store, admin, starts: OPEN, joins: OPEN, now: NOW });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  async function start(): Promise<string> {
    const world = freshId();
    const res = await fetch(`${base}/worlds`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ world, sealed: 'c2VhbGVkLXdvcmxk', date: '2026-12-01', announcedDays: [], pass: PASS }),
    });
    assert.equal(res.status, 201);
    return world;
  }

  const send = (world: string, body: unknown, headers: Record<string, string> = JSON_PASS) =>
    fetch(`${base}/worlds/${world}/problems`, { method: 'POST', headers, body: JSON.stringify(body) });
  const list = async (world: string) =>
    (
      (await (await fetch(`${base}/worlds/${world}/problems`, { headers: WITH_PASS })).json()) as {
        problems: unknown[];
      }
    ).problems;
  const act = (world: string, id: string, what: 'fixed' | 'delete', headers: Record<string, string> = WITH_PASS) =>
    fetch(`${base}/worlds/${world}/problems/${id}/${what}`, { method: 'POST', headers });

  it('takes a report only with the pass, and lists it newest first in its own world', async () => {
    const world = await start();
    const other = await start();
    assert.equal((await send(world, REPORT, { 'content-type': 'application/json' })).status, 404);
    const first = await send(world, REPORT);
    assert.equal(first.status, 201);
    const sent = (await first.json()) as { id: string; token: string };
    assert.match(sent.id, /^[0-9a-f]{32}$/);
    assert.match(sent.token, /^[A-Za-z0-9_-]{43}$/);
    const second = (await (await send(world, { ...REPORT, part: 'other' })).json()) as { id: string };
    assert.deepEqual(await list(world), [
      { id: second.id, ...REPORT, part: 'other', received: '2026-11-30' },
      { id: sent.id, ...REPORT, received: '2026-11-30' },
    ]);
    assert.deepEqual(await list(other), []);
    assert.equal((await fetch(`${base}/worlds/${world}/problems`)).status, 404);
  });

  it('refuses a report shaped otherwise', async () => {
    const world = await start();
    for (const odd of [
      {},
      { ...REPORT, extra: 1 },
      { ...REPORT, part: 'lessons' },
      { ...REPORT, note: '' },
      { ...REPORT, note: ' \n ' },
      { ...REPORT, note: 'x'.repeat(1001) },
      { ...REPORT, note: 'a bell\u0007' },
      { ...REPORT, note: 'a carriage return\r' },
      { ...REPORT, note: 'a\ttab' },
      { ...REPORT, note: 'turned \u202Eover' },
      { ...REPORT, note: 'isolated \u2067text\u2069' },
      { ...REPORT, note: '\u200B\u200B' },
      { ...REPORT, note: 'a lone \uD800 half' },
      { ...REPORT, version: 'seven point oh' },
      { ...REPORT, version: 7 },
    ])
      assert.equal((await send(world, odd)).status, 400, JSON.stringify(odd).slice(0, 60));
    assert.equal((await send(world, { ...REPORT, note: 'ع'.repeat(1000) })).status, 201);
    assert.equal((await send(world, { ...REPORT, note: 'لا\u200Dتظهر \u200Fالحصة' })).status, 201);
  });

  it('erases a report marked fixed, and says so in the admin log', async () => {
    const world = await start();
    const { id } = (await (await send(world, REPORT)).json()) as { id: string };
    assert.equal((await act(world, id, 'fixed', {})).status, 404);
    assert.equal((await act(world, 'f'.repeat(32), 'fixed')).status, 404);
    const res = await act(world, id, 'fixed');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { id });
    assert.deepEqual(await list(world), []);
    assert.equal((await act(world, id, 'fixed')).status, 404);
    assert.deepEqual((await admin.lines(1))[0], {
      day: '2026-11-30',
      action: 'problem.fixed',
      detail: { problem: id },
    });
  });

  it('lets its sender delete it with the token alone', async () => {
    const world = await start();
    const { id, token } = (await (await send(world, REPORT)).json()) as { id: string; token: string };
    const other = (await (await send(world, REPORT)).json()) as { token: string };
    const bearer = (value: string) => ({ ...WITH_PASS, authorization: `Bearer ${value}` });
    assert.equal((await act(world, id, 'delete')).status, 404);
    assert.equal((await act(world, id, 'delete', bearer(other.token))).status, 404);
    assert.equal((await act(world, id, 'delete', { authorization: `Bearer ${token}` })).status, 404);
    assert.equal((await act(world, id, 'delete', bearer(token))).status, 200);
    assert.equal((await list(world)).length, 1);
    assert.equal((await act(world, id, 'delete', bearer(token))).status, 404);
  });

  it(`keeps at most ${MAX_PROBLEMS} reports a world, and erases them with it`, async () => {
    const world = await start();
    for (let i = 0; i < MAX_PROBLEMS; i += 1) assert.equal((await send(world, REPORT)).status, 201);
    assert.equal((await send(world, REPORT)).status, 409);
    const later = await createApp(false, { store, admin, now: () => NOW() + 7 * 86_400_000 });
    try {
      const erased = await later.get(WorldSweeper).sweep();
      assert.equal(erased > 0, true);
      assert.deepEqual(await admin.problems(world), []);
      const line = { day: '2026-12-07', action: 'worlds.erased', detail: { count: erased } };
      assert.deepEqual((await admin.lines(1))[0], line);
    } finally {
      await later.close();
    }
  });
});
