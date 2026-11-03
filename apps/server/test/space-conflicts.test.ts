// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The relay's two refusals to open a space, both 409: a space that exists
// with another kind, and a world that holds as many spaces as it may. Their
// messages are pinned, because the Android app tells the first apart by the
// words "another kind" (apps/android/src/school/stream-put.ts), so the second
// must never contain them. Made-up ids only.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';
import { MAX_SPACES, MemorySpaceStore } from '../src/spaces/space-store.js';
import { MemoryWorldStore } from '../src/worlds/world-store.js';

const OPEN = { perAddress: 10_000, total: 10_000, windowMs: 60_000 };
const PASS = 'cGFzcy1mb3ItYS1tYWRlLXVwLWRlbW8td29ybGQtMDI';
const WORLD = 'K7FMN';
const SCHOOL = 'c2Nob29sLW9mLXRoZS1kZW1v';
const OTHER_KIND = 'this space exists with another kind';
const WORLD_FULL = 'the world holds as many spaces as it may';

describe('the refusals to open a space', () => {
  let app: NestNodeApplication;
  let base: string;
  const spaces = new MemorySpaceStore();

  async function put(space: string, kind: string): Promise<{ status: number; message: string | undefined }> {
    const res = await fetch(`${base}/worlds/${WORLD}/spaces/${space}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-world-pass': PASS },
      body: JSON.stringify({ kind }),
    });
    const body = (await res.json()) as { message?: string };
    return { status: res.status, message: body.message };
  }

  before(async () => {
    app = await createApp(false, { store: new MemoryWorldStore(), spaces, starts: OPEN, joins: OPEN, relay: OPEN });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    const res = await fetch(`${base}/worlds`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ world: WORLD, sealed: 'c2VhbGVk', date: '2026-12-01', announcedDays: [], pass: PASS }),
    });
    assert.equal(res.status, 201);
    assert.equal((await put(SCHOOL, 'school')).status, 200);
  });

  after(async () => {
    await app.close();
  });

  it('answers 409 naming another kind when the space exists with another kind', async () => {
    assert.deepEqual(await put(SCHOOL, 'directorate'), { status: 409, message: OTHER_KIND });
  });

  it('answers 409 without naming a kind when the world holds as many spaces as it may', async () => {
    for (let index = 1; index < MAX_SPACES; index++) {
      assert.equal(await spaces.addSpace(WORLD, `space-${index}`, 'school'), 'added');
    }
    const full = await put('b25lLXNwYWNlLXRvby1tYW55', 'school');
    assert.deepEqual(full, { status: 409, message: WORLD_FULL });
    assert.equal(full.message?.includes('another kind'), false);
    assert.deepEqual(await put(SCHOOL, 'directorate'), { status: 409, message: OTHER_KIND });
    assert.equal((await put(SCHOOL, 'school')).status, 200);
  });
});
