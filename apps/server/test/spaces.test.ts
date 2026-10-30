// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The encrypted relay (#541): spaces inside a world, sealed batches of one
// size added all or none and read back in order, and a store that holds
// nothing in clear after two clients exchange records. The clients seal as
// the core does: 4096-byte pieces under AES-256-GCM. Made-up records only.

import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';
import { SEALED_BATCH_BYTES } from '../src/spaces/space-rules.js';
import { MemorySpaceStore, StoreBusy } from '../src/spaces/space-store.js';
import { MemoryWorldStore } from '../src/worlds/world-store.js';

const OPEN = { perAddress: 10_000, total: 10_000, windowMs: 60_000 };
const PASS = 'cGFzcy1mb3ItYS1tYWRlLXVwLWRlbW8td29ybGQtMDI';
const WORLD = 'R3PAY';
const SCHOOL = 'c2Nob29sLW9mLXRoZS1kZW1v';
const RECORDS = [
  { teacher: 'Nadia Belkacem', class: '2AM3', week: '2026-11-08', signed: true },
  { teacher: 'Karim Saadi', class: '4AM1', week: '2026-11-08', signed: true },
];
const key = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);

async function seal(text: string): Promise<string> {
  const plain = new Uint8Array(4096);
  plain.set(new TextEncoder().encode(text));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  return Buffer.from([...iv, ...sealed]).toString('base64url');
}

async function unseal(bytes: string): Promise<string> {
  const raw = Buffer.from(bytes, 'base64url');
  const plain = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, key, raw.subarray(12));
  return new TextDecoder().decode(plain).replace(/\0+$/, '');
}

describe('the encrypted relay', () => {
  let app: NestNodeApplication;
  let base: string;
  const spaces = new MemorySpaceStore();
  const worlds = new MemoryWorldStore();

  function call(method: string, path: string, body?: unknown, pass = PASS): Promise<Response> {
    return fetch(`${base}/worlds/${WORLD}/spaces${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-world-pass': pass },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  before(async () => {
    app = await createApp(false, { store: worlds, spaces, starts: OPEN, joins: OPEN, relay: OPEN });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    const res = await fetch(`${base}/worlds`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ world: WORLD, sealed: 'c2VhbGVk', date: '2026-12-01', announcedDays: [], pass: PASS }),
    });
    assert.equal(res.status, 201);
    assert.equal((await call('PUT', `/${SCHOOL}`, { kind: 'school' })).status, 200);
  });

  after(async () => {
    await app.close();
  });

  it('opens a space once per id and kind, and the one national space by its name', async () => {
    const again = await call('PUT', `/${SCHOOL}`, { kind: 'school' });
    assert.equal(again.status, 200);
    assert.equal(again.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await again.json(), { kind: 'school' });
    assert.equal((await call('PUT', `/${SCHOOL}`, { kind: 'directorate' })).status, 409);
    assert.equal((await call('PUT', '/national', { kind: 'national' })).status, 200);
    for (const [id, kind] of [
      ['national', 'school'],
      ['ZGlyZWN0b3JhdGUtb2YtZGVtbw', 'national'],
      ['short', 'school'],
      ['ZGlyZWN0b3JhdGUtb2YtZGVtbw', 'wilaya'],
    ]) {
      assert.equal((await call('PUT', `/${id}`, { kind })).status, 400, `${id} ${kind}`);
    }
    assert.equal(
      (await call('PUT', '/ZGlyZWN0b3JhdGUtb2YtZGVtbw', { kind: 'directorate' }, 'x'.repeat(43))).status,
      404,
    );
  });

  it('carries records between two clients and keeps nothing in clear', async () => {
    const upload = await call('POST', `/${SCHOOL}/batches`, {
      stream: 'cGhvbmUtb2YtdGVhY2hlci1h',
      first: 0,
      batches: await Promise.all(RECORDS.map((record) => seal(JSON.stringify(record)))),
    });
    assert.equal(upload.status, 201);
    assert.deepEqual(await upload.json(), { added: 2 });

    const read = await call('GET', `/${SCHOOL}/batches?after=0`);
    assert.equal(read.status, 200);
    const { batches, more } = (await read.json()) as {
      batches: { seq: number; number: number; bytes: string }[];
      more: boolean;
    };
    assert.equal(more, false);
    assert.deepEqual(
      batches.map(({ seq, number }) => [seq, number]),
      [
        [1, 0],
        [2, 1],
      ],
    );
    assert.deepEqual(
      await Promise.all(batches.map(async (batch) => JSON.parse(await unseal(batch.bytes)) as unknown)),
      RECORDS,
    );

    const kept = await spaces.batchesAfter(WORLD, SCHOOL, 0, 100);
    const stored = Buffer.concat([
      ...kept.map((batch) => batch.bytes),
      Buffer.from(JSON.stringify(await worlds.get(WORLD))),
    ]);
    assert.ok(kept.every((batch) => batch.bytes.length === SEALED_BATCH_BYTES));
    for (const clear of ['Nadia', 'Belkacem', 'Karim', '2AM3', '2026-11-08', 'signed', 'teacher']) {
      assert.equal(stored.includes(clear), false, clear);
    }
    assert.deepEqual(Object.keys(kept[0]!).sort(), ['bytes', 'number', 'seq', 'stream']);
  });

  it('adds a stream’s next batches all or none, and refuses any other size', async () => {
    const one = await seal('made-up');
    const stream = 'c2Vjb25kLXN0cmVhbS1vZi1kZW1v';
    assert.equal((await call('POST', `/${SCHOOL}/batches`, { stream, first: 0, batches: [one, one] })).status, 201);
    for (const first of [1, 3]) {
      const res = await call('POST', `/${SCHOOL}/batches`, { stream, first, batches: [one, one] });
      assert.equal(res.status, 409);
      assert.match(((await res.json()) as { message: string }).message, /next batch is number 2/);
    }
    assert.equal((await spaces.batchesAfter(WORLD, SCHOOL, 0, 100)).filter((b) => b.stream === stream).length, 2);
    const short = Buffer.from(one, 'base64url').subarray(1).toString('base64url');
    const long = Buffer.concat([Buffer.from(one, 'base64url'), Buffer.from([0])]).toString('base64url');
    for (const body of [
      { stream, first: 9, batches: [short] },
      { stream, first: 9, batches: [long] },
      { stream, first: 9, batches: [`${one.slice(0, -1)}+`] },
      { stream, first: 9, batches: [] },
      { stream, first: 9, batches: Array.from({ length: 129 }, () => one) },
      { stream, first: -1, batches: [one] },
      { stream, first: 1.5, batches: [one] },
      { stream: 'short', first: 9, batches: [one] },
    ]) {
      assert.equal((await call('POST', `/${SCHOOL}/batches`, body)).status, 400);
    }
    assert.equal(
      (await call('POST', '/bm8tc3VjaC1zcGFjZS1oZXJl/batches', { stream, first: 9, batches: [one] })).status,
      404,
    );
    assert.equal((await call('GET', '/bm8tc3VjaC1zcGFjZS1oZXJl/batches')).status, 404);
    assert.equal((await call('GET', `/${SCHOOL}/batches?after=-1`)).status, 400);
    const huge = { stream, first: 2, batches: Array.from({ length: 128 }, () => `${one}${'A'.repeat(3000)}`) };
    assert.equal((await call('POST', `/${SCHOOL}/batches`, huge)).status, 413);
    assert.equal(
      (await call('POST', `/${SCHOOL}/batches`, { stream, first: 9, batches: [one] }, 'x'.repeat(43))).status,
      404,
    );
  });

  it('answers 507 when the server holds as many batches as it may', async () => {
    const small = await createApp(false, { spaces: new MemorySpaceStore(1), starts: OPEN, joins: OPEN, relay: OPEN });
    await small.listen(0, '127.0.0.1');
    const url = await small.getUrl();
    try {
      const json = { 'content-type': 'application/json', 'x-world-pass': PASS };
      const start = { world: WORLD, sealed: 'c2VhbGVk', date: '2026-12-01', announcedDays: [], pass: PASS };
      await fetch(`${url}/worlds`, { method: 'POST', headers: json, body: JSON.stringify(start) });
      await fetch(`${url}/worlds/${WORLD}/spaces/${SCHOOL}`, {
        method: 'PUT',
        headers: json,
        body: '{"kind":"school"}',
      });
      const one = await seal('made-up');
      const upload = (first: number): Promise<Response> =>
        fetch(`${url}/worlds/${WORLD}/spaces/${SCHOOL}/batches`, {
          method: 'POST',
          headers: json,
          body: JSON.stringify({ stream: SCHOOL, first, batches: [one] }),
        });
      assert.equal((await upload(0)).status, 201);
      assert.equal((await upload(1)).status, 507);
    } finally {
      await small.close();
    }
  });

  it('answers 503 with Retry-After when the store is too busy', async () => {
    const busy = new MemorySpaceStore();
    busy.addBatches = () => Promise.reject(new StoreBusy());
    const small = await createApp(false, { spaces: busy, starts: OPEN, joins: OPEN, relay: OPEN });
    await small.listen(0, '127.0.0.1');
    const url = await small.getUrl();
    try {
      const json = { 'content-type': 'application/json', 'x-world-pass': PASS };
      const start = { world: WORLD, sealed: 'c2VhbGVk', date: '2026-12-01', announcedDays: [], pass: PASS };
      await fetch(`${url}/worlds`, { method: 'POST', headers: json, body: JSON.stringify(start) });
      await fetch(`${url}/worlds/${WORLD}/spaces/${SCHOOL}`, {
        method: 'PUT',
        headers: json,
        body: '{"kind":"school"}',
      });
      const res = await fetch(`${url}/worlds/${WORLD}/spaces/${SCHOOL}/batches`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ stream: SCHOOL, first: 0, batches: [await seal('made-up')] }),
      });
      assert.equal(res.status, 503);
      assert.equal(res.headers.get('retry-after'), '5');
      assert.equal(res.headers.get('cache-control'), 'no-store');
    } finally {
      await small.close();
    }
  });

  it('answers 429 past the day’s quota of batches from one address, counting only batches stored', async () => {
    const quota = { perAddress: 3, total: 100, windowMs: 86_400_000 };
    const small = await createApp(false, { starts: OPEN, joins: OPEN, relay: OPEN, uploads: quota });
    await small.listen(0, '127.0.0.1');
    const url = await small.getUrl();
    try {
      const json = { 'content-type': 'application/json', 'x-world-pass': PASS };
      const start = { world: WORLD, sealed: 'c2VhbGVk', date: '2026-12-01', announcedDays: [], pass: PASS };
      await fetch(`${url}/worlds`, { method: 'POST', headers: json, body: JSON.stringify(start) });
      await fetch(`${url}/worlds/${WORLD}/spaces/${SCHOOL}`, {
        method: 'PUT',
        headers: json,
        body: '{"kind":"school"}',
      });
      const one = await seal('made-up');
      const upload = (first: number, count: number): Promise<Response> =>
        fetch(`${url}/worlds/${WORLD}/spaces/${SCHOOL}/batches`, {
          method: 'POST',
          headers: json,
          body: JSON.stringify({ stream: SCHOOL, first, batches: Array<string>(count).fill(one) }),
        });
      assert.equal((await upload(0, 2)).status, 201);
      assert.equal((await upload(2, 2)).status, 429);
      assert.equal((await upload(0, 1)).status, 409);
      assert.equal((await upload(2, 1)).status, 201);
      assert.equal((await upload(3, 1)).status, 429);
    } finally {
      await small.close();
    }
  });

  it('reads batches in pages of 128, in the order they arrived', async () => {
    const page = 'cGFnZXMtb2YtYmF0Y2hlcy1kZW1v';
    await call('PUT', `/${page}`, { kind: 'directorate' });
    const one = await seal('made-up');
    for (const first of [0, 100]) {
      const batches = Array.from({ length: first === 0 ? 100 : 30 }, () => one);
      assert.equal((await call('POST', `/${page}/batches`, { stream: page, first, batches })).status, 201);
    }
    const first = (await (await call('GET', `/${page}/batches`)).json()) as {
      batches: { seq: number }[];
      more: boolean;
    };
    assert.equal(first.batches.length, 128);
    assert.equal(first.more, true);
    const rest = (await (await call('GET', `/${page}/batches?after=128`)).json()) as {
      batches: { seq: number }[];
      more: boolean;
    };
    assert.deepEqual(
      rest.batches.map((batch) => batch.seq),
      [129, 130],
    );
    assert.equal(rest.more, false);
  });
});
