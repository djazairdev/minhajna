// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The directory over HTTP (answers 802 to 809): the list a phone reads, the
// Ministry's draft and versions, and what every route answers and counts. Every
// list, school and code here is made up.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, beforeEach, describe, it } from 'node:test';
import { BATCH_BODY } from '../src/body-guard.js';
import { MemoryDirectoryStore } from '../src/directory/directory-store.js';
import { DirectoryServer, DRAFT, LIST_CODE, OPEN, SCHOOL, SCHOOL_CODE } from './directory-kit.js';

describe('the directory over HTTP', () => {
  const server = new DirectoryServer();
  const { ask, published } = server;

  beforeEach(() => server.open());

  after(() => server.close());

  it('runs on the core’s own files, byte for byte but for their imports', () => {
    const read = (path: string) =>
      readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^import [^;]+;\n/gmu, '');
    for (const file of ['directory.ts', 'directory-book.ts', 'directory-read.ts']) {
      assert.equal(read(`../../src/directory/core/${file}`), read(`../../../../packages/core/src/${file}`), file);
    }
  });

  it('claims the list once, and changes its code only with the old one', async () => {
    assert.deepEqual((await ask('GET', 'reference/claimed')).body, { claimed: false });
    assert.equal((await ask('POST', 'reference/code', { code: 'short' })).status, 400);
    assert.equal((await ask('POST', 'reference/code', { code: 'with a space' })).status, 400);
    assert.equal((await ask('POST', 'reference/code', { code: 'كلمة-سر-عربية' })).status, 400);
    assert.equal((await ask('POST', 'reference/code', { code: 'x'.repeat(65) })).status, 400);
    assert.equal((await ask('POST', 'reference/code', { code: LIST_CODE, old: 1 })).status, 400);
    const set = await ask('POST', 'reference/code', { code: LIST_CODE });
    assert.deepEqual([set.status, set.body], [200, { claimed: true }]);
    assert.deepEqual((await ask('GET', 'reference/claimed')).body, { claimed: true });
    assert.equal((await ask('POST', 'reference/code', { code: 'another-code' })).status, 403);
    assert.equal((await ask('POST', 'reference/code', { code: 'another-code', old: 'wrong-code' })).status, 403);
    assert.equal((await ask('POST', 'reference/code', { code: 'another-code', old: LIST_CODE })).status, 200);
    assert.equal((await ask('GET', 'reference/state', undefined, LIST_CODE)).status, 403);
    assert.equal((await ask('GET', 'reference/state', undefined, 'another-code')).status, 200);
  });

  it('guards the list’s state, draft and publishing with its code', async () => {
    assert.equal((await ask('GET', 'reference/state', undefined, LIST_CODE)).status, 403);
    await ask('POST', 'reference/code', { code: LIST_CODE });
    assert.equal((await ask('GET', 'reference/state')).status, 403);
    assert.equal((await ask('GET', 'reference/state', undefined, 'wrong-code')).status, 403);
    assert.equal((await ask('PUT', 'reference/draft', { expected: 0, draft: DRAFT }, 'wrong-code')).status, 403);
    assert.equal((await ask('POST', 'reference/publish', { expected: 0 }, 'wrong-code')).status, 403);
    assert.equal((await ask('POST', 'reference/republish', { version: '2026.1' }, 'wrong-code')).status, 403);
  });

  it('takes a draft, publishes it on the server’s date, and serves it to anyone', async () => {
    assert.equal((await ask('GET', 'reference')).status, 404);
    await ask('POST', 'reference/code', { code: LIST_CODE });
    assert.deepEqual((await ask('GET', 'reference/state', undefined, LIST_CODE)).body, {
      revision: 0,
      draft: null,
      published: null,
      versions: [],
    });
    assert.equal((await ask('POST', 'reference/publish', { expected: 0 }, LIST_CODE)).status, 400);
    const bad = await ask('PUT', 'reference/draft', { expected: 0, draft: { levels: [] } }, LIST_CODE);
    assert.deepEqual([bad.status, bad.body['message']], [400, 'a reference list needs levels and schools']);
    assert.equal((await ask('PUT', 'reference/draft', { expected: -1, draft: DRAFT }, LIST_CODE)).status, 400);
    assert.deepEqual((await ask('PUT', 'reference/draft', { expected: 0, draft: DRAFT }, LIST_CODE)).body, {
      revision: 1,
    });
    assert.equal((await ask('PUT', 'reference/draft', { expected: 0, draft: DRAFT }, LIST_CODE)).status, 409);
    assert.equal((await ask('POST', 'reference/publish', { expected: 0 }, LIST_CODE)).status, 409);
    const done = await ask('POST', 'reference/publish', { expected: 1 }, LIST_CODE);
    assert.deepEqual([done.status, done.body], [200, { version: '2026.1', published: '2026-11-07' }]);
    assert.deepEqual((await ask('GET', 'reference')).body, {
      format: 1,
      version: '2026.1',
      published: '2026-11-07',
      ...DRAFT,
    });
    await ask('POST', 'reference/publish', { expected: 1 }, LIST_CODE);
    assert.deepEqual((await ask('GET', 'reference/state', undefined, LIST_CODE)).body, {
      revision: 1,
      draft: DRAFT,
      published: '2026.2',
      versions: [
        { version: '2026.2', published: '2026-11-07' },
        { version: '2026.1', published: '2026-11-07' },
      ],
    });
  });

  it('republishes an old version as a new one, and as the draft', async () => {
    await published();
    const smaller = { levels: DRAFT.levels, schools: DRAFT.schools.slice(0, 1) };
    await ask('PUT', 'reference/draft', { expected: 1, draft: smaller }, LIST_CODE);
    await ask('POST', 'reference/publish', { expected: 2 }, LIST_CODE);
    assert.equal((await ask('POST', 'reference/republish', {}, LIST_CODE)).status, 400);
    assert.equal((await ask('POST', 'reference/republish', { version: '1999.1' }, LIST_CODE)).status, 404);
    const again = await ask('POST', 'reference/republish', { version: '2026.1' }, LIST_CODE);
    assert.deepEqual(again.body, { version: '2026.3', published: '2026-11-07' });
    const state = (await ask('GET', 'reference/state', undefined, LIST_CODE)).body;
    assert.deepEqual([state['revision'], state['draft'], state['published']], [3, DRAFT, '2026.3']);
    assert.equal(((await ask('GET', 'reference')).body['schools'] as unknown[]).length, 2);
  });

  it('ignores the query a phone’s fetch adds to a read', async () => {
    await published();
    assert.equal((await ask('GET', 'reference?_=1762560000000')).body['version'], '2026.1');
    assert.deepEqual((await ask('GET', 'reference/claimed?_=1')).body, { claimed: true });
    assert.equal((await ask('GET', 'reference/state?_=1', undefined, LIST_CODE)).status, 200);
    assert.deepEqual((await ask('GET', `schools/${SCHOOL}/claimed?_=1`)).body, { claimed: true });
    assert.equal((await ask('GET', `schools/${SCHOOL}/book?_=1`, undefined, SCHOOL_CODE)).body['revision'], 0);
    assert.equal((await ask('GET', 'reference?_=1')).noStore, true);
  });

  it('marks every answer no-store, refusals too', async () => {
    await published();
    const answers = await Promise.all([
      ask('GET', 'reference'),
      ask('GET', 'reference/claimed'),
      ask('GET', 'reference/state', undefined, 'wrong-code'),
      ask('GET', 'nothing/here'),
      ask('PUT', 'reference/draft', { expected: 0 }, LIST_CODE),
      ask('POST', 'join', { code: 'nobody' }),
      ask('GET', 'schools/sch-99/claimed'),
    ]);
    for (const answer of answers) assert.equal(answer.noStore, true, JSON.stringify(answer.body));
  });

  it('answers 507 for a school’s first book past the cap', async () => {
    await server.open({ directory: new MemoryDirectoryStore(0) });
    await published();
    const book = await ask(
      'PUT',
      `schools/${SCHOOL}/book`,
      { expected: 0, book: { format: 1, teachers: [], classes: [], week: [] } },
      SCHOOL_CODE,
    );
    assert.deepEqual([book.status, book.noStore], [507, true]);
  });

  it('counts saves against the daily quota of uploads, by their bytes', async () => {
    await server.open({ uploads: { perAddress: 4, total: 100, windowMs: 60_000 } });
    await published();
    assert.equal((await ask('PUT', 'reference/draft', { expected: 1, draft: DRAFT }, LIST_CODE)).status, 200);
    assert.equal((await ask('PUT', 'reference/draft', { expected: 2, draft: DRAFT }, LIST_CODE)).status, 200);
    assert.equal((await ask('PUT', 'reference/draft', { expected: 2, draft: DRAFT }, LIST_CODE)).status, 409);
    assert.equal((await ask('PUT', 'reference/draft', { expected: 3, draft: DRAFT }, LIST_CODE)).status, 200);
    const over = await ask('PUT', 'reference/draft', { expected: 4, draft: DRAFT }, LIST_CODE);
    assert.deepEqual([over.status, over.noStore], [429, true]);
  });

  it('answers a revision PostgreSQL cannot hold 400, and a malformed body no-store', async () => {
    await published();
    const huge = await ask('PUT', 'reference/draft', { expected: 3_000_000_000, draft: DRAFT }, LIST_CODE);
    assert.equal(huge.status, 400);
    const res = await fetch(`${server.base}/directory/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"code":',
    });
    assert.deepEqual([res.status, res.headers.get('cache-control')], [400, 'no-store']);
  });

  it('counts a refused code with the joins, and a holder’s requests with the relay', async () => {
    await server.open({ joins: { perAddress: 3, total: 100, windowMs: 60_000 }, relay: OPEN });
    await ask('POST', 'reference/code', { code: LIST_CODE });
    for (let at = 0; at < 10; at += 1) {
      assert.equal((await ask('GET', 'reference/state', undefined, LIST_CODE)).status, 200);
    }
    assert.equal((await ask('GET', 'reference/state', undefined, 'wrong-code')).status, 403);
    assert.equal((await ask('GET', 'reference/state')).status, 403);
    assert.equal((await ask('GET', 'reference/state', undefined, 'wrong-code')).status, 429);
    assert.equal((await ask('GET', 'reference/state', undefined, LIST_CODE)).status, 429);
    assert.equal((await ask('POST', 'join', { code: 'nobody' })).status, 429);
  });

  it('counts reads with the relay', async () => {
    await server.open({ joins: OPEN, relay: { perAddress: 2, total: 100, windowMs: 60_000 } });
    assert.equal((await ask('GET', 'reference/claimed')).status, 200);
    assert.equal((await ask('GET', 'reference')).status, 404);
    assert.equal((await ask('GET', 'reference/claimed')).status, 429);
  });

  it('takes a draft and a book of up to 1 MB, and refuses more before reading it', async () => {
    await published();
    const text = (size: number) => JSON.stringify({ expected: 1, draft: DRAFT, padding: 'x'.repeat(size) });
    const put = (path: string, body: string) =>
      fetch(`${server.base}/directory/${path}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${LIST_CODE}` },
        body,
      });
    const large = text(BATCH_BODY - 2000);
    assert.equal((await put('reference/draft', large)).status, 200);
    assert.equal((await put('reference/draft', text(BATCH_BODY))).status, 413);
    assert.equal((await put(`schools/${SCHOOL}/book`, large)).status, 403);
    assert.equal((await put(`schools/${SCHOOL}/book`, text(BATCH_BODY))).status, 413);
    const posted = await fetch(`${server.base}/directory/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: large,
    });
    assert.equal(posted.status, 413);
  });
});
