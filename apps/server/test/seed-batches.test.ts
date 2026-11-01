// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Seeding a world's spaces and streams (#548, answer 625): with the starter
// token alone, up to 128 spaces opened and 128 batches added over many streams
// in one request of up to 1 MB, in order, each stream all or none; a refusal
// names the space or stream refused and keeps what came before, a world or a
// server full included. Every world and batch here is made up.

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';
import { MemorySpaceStore } from '../src/spaces/space-store.js';
import { batches, message, OPEN, read, SCHOOLS, seed, start, STREAMS } from './seed-kit.js';

describe('seeding spaces and streams', () => {
  let app: NestNodeApplication;
  let base: string;

  before(async () => {
    app = await createApp(false, { starts: OPEN, joins: OPEN, relay: OPEN });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  it('opens spaces and adds to streams across them in one request, read back as the relay keeps them', async () => {
    const { world, starter } = await start(base);
    const spaces = [...SCHOOLS.map((space) => ({ space, kind: 'school' })), { space: 'national', kind: 'national' }];
    const streams = [
      { space: SCHOOLS[0], stream: STREAMS[0], first: 0, batches: batches(2) },
      { space: SCHOOLS[0], stream: STREAMS[1], first: 0, batches: batches(1) },
      { space: 'national', stream: STREAMS[0], first: 0, batches: batches(125) },
    ];
    const res = await seed(base, world, 'batches', { spaces, streams }, `Bearer ${starter}`);
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await res.json(), { opened: 3, added: 128 });
    assert.deepEqual(await read(base, world, SCHOOLS[0]!), [
      { stream: STREAMS[0], number: 0 },
      { stream: STREAMS[0], number: 1 },
      { stream: STREAMS[1], number: 0 },
    ]);
    assert.deepEqual(await read(base, world, SCHOOLS[1]!), []);
    const more = { spaces: [], streams: [{ space: SCHOOLS[1], stream: STREAMS[0], first: 0, batches: batches(1) }] };
    assert.equal((await seed(base, world, 'batches', more, `Bearer ${starter}`)).status, 201);
    for (const authorization of [null, `Bearer ${(await start(base)).starter}`, starter]) {
      assert.equal((await seed(base, world, 'batches', more, authorization)).status, 403);
    }
  });

  it('takes the largest request: 128 spaces, 128 streams and 128 batches', async () => {
    const { world, starter } = await start(base);
    const ids = Array.from({ length: 128 }, () => randomBytes(32).toString('base64url').slice(0, 43));
    const spaces = ids.map((space) => ({ space, kind: 'school' }));
    const streams = ids.map((space) => ({ space, stream: STREAMS[0], first: 0, batches: batches(1) }));
    const res = await seed(base, world, 'batches', { spaces, streams }, `Bearer ${starter}`);
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { opened: 128, added: 128 });
  });

  it('stops at a space or a stream it refuses, keeping what came before, and names it', async () => {
    const { world, starter } = await start(base);
    const bearer = `Bearer ${starter}`;
    const school = (space: string) => ({ space, kind: 'school' });
    await seed(base, world, 'batches', { spaces: [school(SCHOOLS[1]!)], streams: [] }, bearer);
    const kinds = { spaces: [school(SCHOOLS[0]!), { space: SCHOOLS[1], kind: 'directorate' }], streams: [] };
    const other = await seed(base, world, 'batches', kinds, bearer);
    assert.deepEqual([other.status, await message(other)], [409, 'space 1: it exists with another kind']);
    assert.deepEqual(await read(base, world, SCHOOLS[0]!), []);
    const streams = [
      { space: SCHOOLS[0], stream: STREAMS[0], first: 0, batches: batches(1) },
      { space: SCHOOLS[0], stream: STREAMS[1], first: 1, batches: batches(1) },
      { space: SCHOOLS[0], stream: STREAMS[1], first: 0, batches: batches(1) },
    ];
    const res = await seed(base, world, 'batches', { spaces: [], streams }, bearer);
    assert.deepEqual([res.status, await message(res)], [409, "stream 1: the stream's next batch is number 0"]);
    assert.deepEqual(await read(base, world, SCHOOLS[0]!), [{ stream: STREAMS[0], number: 0 }]);
  });

  it('refuses what the relay refuses, more than 128 batches or spaces, and a space not opened, naming it', async () => {
    const { world, starter } = await start(base);
    const school = { space: SCHOOLS[0], kind: 'school' };
    const stream = { space: SCHOOLS[0], stream: STREAMS[0], first: 0, batches: batches(1) };
    const answers = [];
    for (const body of [
      { spaces: [], streams: [] },
      { spaces: [school] },
      { spaces: school, streams: [] },
      { spaces: [school], streams: stream },
      { spaces: [school, { ...school, kind: 'national' }], streams: [] },
      { spaces: [{ space: 'not a space', kind: 'school' }], streams: [] },
      { spaces: Array.from({ length: 129 }, () => school), streams: [] },
      {
        spaces: [school],
        streams: [
          { ...stream, batches: batches(65) },
          { ...stream, batches: batches(64) },
        ],
      },
      { spaces: [school], streams: Array.from({ length: 129 }, () => stream) },
      { spaces: [school], streams: [stream, { ...stream, batches: ['c2hvcnQ'] }] },
      { spaces: [school], streams: [{ ...stream, extra: 1 }] },
      { spaces: [], streams: [{ ...stream, space: SCHOOLS[1] }] },
    ]) {
      const res = await seed(base, world, 'batches', body, `Bearer ${starter}`);
      answers.push([res.status, (await message(res)).split(':')[0]]);
    }
    assert.deepEqual(
      answers.map(([status]) => status),
      Array.from({ length: 12 }, () => 400),
    );
    assert.deepEqual([answers[4]![1], answers[9]![1], answers[11]![1]], ['space 1', 'stream 1', 'stream 0']);
  });

  it('says where a full world or a full server stopped it', async () => {
    const spaces = new MemorySpaceStore(1);
    const full = await createApp(false, { starts: OPEN, joins: OPEN, relay: OPEN, spaces });
    await full.listen(0, '127.0.0.1');
    try {
      const url = await full.getUrl();
      const { world, starter } = await start(url);
      const stream = (name: string) => ({ space: SCHOOLS[0], stream: name, first: 0, batches: batches(1) });
      const body = {
        spaces: [{ space: SCHOOLS[0], kind: 'school' }],
        streams: [stream(STREAMS[0]!), stream(STREAMS[1]!)],
      };
      const res = await seed(url, world, 'batches', body, `Bearer ${starter}`);
      assert.deepEqual([res.status, await message(res)], [507, 'stream 1: the server holds as many batches as it may']);
      spaces.addBatches = () => Promise.resolve('full');
      spaces.addSpace = () => Promise.resolve('full');
      const again = await seed(url, world, 'batches', body, `Bearer ${starter}`);
      assert.deepEqual(
        [again.status, await message(again)],
        [409, 'space 0: the world holds as many spaces as it may'],
      );
      const added = await seed(
        url,
        world,
        'batches',
        { spaces: [], streams: [stream(STREAMS[1]!)] },
        `Bearer ${starter}`,
      );
      assert.deepEqual(
        [added.status, await message(added)],
        [409, 'stream 0: the world holds as many batches as it may'],
      );
    } finally {
      await full.close();
    }
  });
});
