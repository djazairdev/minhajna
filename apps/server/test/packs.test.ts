// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pack desk (#612, R-4.3-09, R-6.7-02): accounts only the world's starter
// makes, a release's steps under the account's role, each signed by the world's
// stand-in CA. Every world, pack and token here is made up.

import assert from 'node:assert/strict';
import { createPublicKey, verify } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';
import { packStepText, type PackStep } from '../src/packs/pack-rules.js';
import { MemoryWorldStore } from '../src/worlds/world-store.js';

const OPEN = { perAddress: 1000, total: 1000, windowMs: 60_000 };
const PASS = 'cGFzcy1mb3ItYS1tYWRlLXVwLWRlbW8td29ybGQtMDE';
const PACK = 'dz.cem.4am.arabic.made-up';
const DIGEST = 'A'.repeat(43);
const DATE = '2026-12-01';

let ids = 0;
function freshId(): string {
  ids += 1;
  return `P${String(ids).padStart(4, '0')}`;
}

describe('the pack desk over HTTP', () => {
  let app: NestNodeApplication;
  let base: string;

  async function start() {
    const world = freshId();
    const res = await fetch(`${base}/worlds`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        world,
        sealed: 'c2VhbGVkLXdvcmxk',
        date: DATE,
        announcedDays: ['2026-12-20'],
        pass: PASS,
      }),
    });
    const { starter } = (await res.json()) as { starter: string };
    return { world, starter };
  }

  const ask = (world: string, path: string, token?: string, body?: unknown) =>
    fetch(`${base}/worlds/${world}/packs/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'x-world-pass': PASS,
        ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  async function account(world: string, starter: string, role: string): Promise<string> {
    const res = await ask(world, 'accounts', starter, { role });
    assert.equal(res.status, 201);
    return ((await res.json()) as { token: string }).token;
  }

  async function world() {
    read.clear();
    const { world: id, starter } = await start();
    return {
      id,
      starter,
      curator: await account(id, starter, 'curator'),
      ministry: await account(id, starter, 'ministry'),
    };
  }

  /** The steps the test's world has taken, by release and revision, as a device reads them from the stream. */
  const read = new Map<string, Omit<PackStep, 'id'>>();
  const keyOf = (release: unknown, revision: unknown) => `${String(release)}#${String(revision)}`;

  const step = (fields: Record<string, unknown>) => {
    const release = fields['release'] ?? '2026.1';
    const expected = fields['expected'] ?? 0;
    const by = fields['by'] ?? null;
    const newest = [...read.entries()]
      .filter(([key]) => key.startsWith(`${by as string}#`))
      .map(([, one]) => one)
      .sort((a, b) => b.revision - a.revision)[0];
    return {
      id: PACK,
      release,
      expected,
      stage: 'draft',
      status: 'community',
      digest: DIGEST,
      by,
      day: DATE,
      previous: read.get(keyOf(release, expected)) ?? null,
      successor: by === null ? null : (newest ?? null),
      ...fields,
    };
  };

  async function taken(id: string, token: string, fields: Record<string, unknown>): Promise<PackStep> {
    const res = await ask(id, 'steps', token, step(fields));
    assert.equal(res.status, 201);
    const done = (await res.json()) as PackStep;
    const shown = Object.fromEntries(Object.entries(done).filter(([field]) => field !== 'id'));
    read.set(keyOf(done.release, done.revision), shown as Omit<PackStep, 'id'>);
    return done;
  }

  async function underReview(id: string, token: string, release = '2026.1') {
    await taken(id, token, { release });
    await taken(id, token, { release, expected: 1, stage: 'under-review' });
  }

  before(async () => {
    app = await createApp(false, { store: new MemoryWorldStore(), starts: OPEN, joins: OPEN, relay: OPEN });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  it('only the starter token makes an account, and the token signs in as its role', async () => {
    const { world: id, starter } = await start();
    assert.equal((await ask(id, 'accounts', 'not-the-starter-token', { role: 'curator' })).status, 403);
    assert.equal((await ask(id, 'accounts', starter, { role: 'teacher' })).status, 400);
    const token = await account(id, starter, 'ministry');
    const answer = await ask(id, 'account', token);
    assert.deepEqual(await answer.json(), { role: 'ministry' });
    assert.equal(answer.headers.get('cache-control'), 'no-store');
    assert.equal((await ask(id, 'account', 'no-such-account-token')).status, 403);
    assert.equal((await ask(id, 'account')).status, 403);
  });

  it('a second account for a role replaces the first, and other worlds never take it', async () => {
    const { world: id, starter } = await start();
    const first = await account(id, starter, 'curator');
    const second = await account(id, starter, 'curator');
    assert.equal((await ask(id, 'account', first)).status, 403);
    assert.equal((await ask(id, 'account', second)).status, 200);
    const other = await start();
    assert.equal((await ask(other.world, 'account', second)).status, 403);
  });

  it('a wrong pass answers as if no world had the id', async () => {
    const { id, curator } = await world();
    const res = await fetch(`${base}/worlds/${id}/packs/account`, {
      headers: { 'x-world-pass': 'd3JvbmctcGFzcy1mb3ItYS1tYWRlLXVwLXdvcmxkLTAx', authorization: `Bearer ${curator}` },
    });
    assert.equal(res.status, 404);
  });

  it('a step needs an account, and is signed by the world’s CA over its text', async () => {
    const { id, curator } = await world();
    assert.equal((await ask(id, 'steps', undefined, step({}))).status, 403);
    const done = await taken(id, curator, {});
    assert.equal(done.revision, 1);
    assert.equal(done.role, 'curator');
    const res = await fetch(`${base}/worlds/${id}/ca`, { headers: { 'x-world-pass': PASS } });
    const { publicKey } = (await res.json()) as { publicKey: string };
    const key = createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' });
    const { signature, ...unsigned } = done;
    const text = Buffer.from(packStepText(id, unsigned), 'utf8');
    assert.equal(verify('sha256', text, key, Buffer.from(signature, 'base64')), true);
    const other = Buffer.from(packStepText('P9999', unsigned), 'utf8');
    assert.equal(verify('sha256', other, key, Buffer.from(signature, 'base64')), false);
  });

  it('a release moves through its stages, and no step skips one', async () => {
    const { id, curator } = await world();
    assert.equal((await ask(id, 'steps', curator, step({ stage: 'published' }))).status, 403);
    await taken(id, curator, {});
    assert.equal((await ask(id, 'steps', curator, step({ expected: 1, stage: 'published' }))).status, 403);
    await taken(id, curator, { expected: 1, stage: 'under-review' });
    await taken(id, curator, { expected: 2 });
    await taken(id, curator, { expected: 3, stage: 'under-review' });
    const published = await taken(id, curator, { expected: 4, stage: 'published' });
    assert.equal(published.revision, 5);
    assert.equal((await ask(id, 'steps', curator, step({ expected: 5 }))).status, 403);
    await taken(id, curator, { expected: 5, stage: 'withdrawn' });
    assert.equal((await ask(id, 'steps', curator, step({ expected: 6, stage: 'published' }))).status, 403);
  });

  it('only the Ministry’s account has Official packs, and what it publishes is Official', async () => {
    const { id, curator, ministry } = await world();
    assert.equal((await ask(id, 'steps', curator, step({ status: 'official' }))).status, 403);
    await underReview(id, curator);
    const asOfficial = step({ expected: 2, stage: 'published', status: 'official' });
    assert.equal((await ask(id, 'steps', curator, asOfficial)).status, 403);
    const unofficial = step({ expected: 2, stage: 'published', status: 'community' });
    assert.equal((await ask(id, 'steps', ministry, unofficial)).status, 403);
    const published = await taken(id, ministry, { expected: 2, stage: 'published', status: 'official' });
    assert.equal(published.role, 'ministry');
    assert.equal(published.status, 'official');
  });

  it('an account holds its own: no other account edits it or sends it to review', async () => {
    const { id, curator, ministry } = await world();
    await taken(id, curator, {});
    assert.equal((await ask(id, 'steps', ministry, step({ expected: 1 }))).status, 403);
    assert.equal((await ask(id, 'steps', ministry, step({ expected: 1, stage: 'under-review' }))).status, 403);
    await taken(id, curator, { expected: 1, stage: 'under-review' });
    await taken(id, curator, { expected: 2, stage: 'published' });
    assert.equal((await ask(id, 'steps', ministry, step({ expected: 3, stage: 'withdrawn' }))).status, 403);
  });

  it('a release is superseded only by a later published one of the same account', async () => {
    const { id, curator } = await world();
    await underReview(id, curator);
    await taken(id, curator, { expected: 2, stage: 'published' });
    const by = (release: string) => step({ expected: 3, stage: 'superseded', by: release });
    assert.equal((await ask(id, 'steps', curator, by('2026.2'))).status, 403);
    await underReview(id, curator, '2026.2');
    assert.equal((await ask(id, 'steps', curator, by('2026.2'))).status, 403);
    await taken(id, curator, { release: '2026.2', expected: 2, stage: 'published' });
    assert.equal((await ask(id, 'steps', curator, by('2026.1'))).status, 403);
    const superseded = await taken(id, curator, { expected: 3, stage: 'superseded', by: '2026.2' });
    assert.equal(superseded.by, '2026.2');
  });

  it('a step of a revision never taken, or on an old date, is told apart', async () => {
    const { id, curator } = await world();
    const stale = await ask(id, 'steps', curator, step({ expected: 4 }));
    assert.equal(stale.status, 409);
    assert.equal(((await stale.json()) as { problem: string }).problem, 'revision');
    const late = await ask(id, 'steps', curator, step({ day: '2026-11-30' }));
    assert.equal(late.status, 409);
    assert.equal(((await late.json()) as { problem: string }).problem, 'date');
  });

  it('a step taken again replaces what followed, so one left unused holds nothing back', async () => {
    const { id, curator } = await world();
    await underReview(id, curator);
    const again = await taken(id, curator, { expected: 1, digest: 'B'.repeat(43) });
    assert.equal(again.revision, 2);
    const answer = (await (await ask(id, 'steps')).json()) as { steps: PackStep[] };
    assert.equal(answer.steps.length, 1);
    assert.equal(answer.steps[0]!.revision, 2);
    assert.equal(answer.steps[0]!.stage, 'draft');
  });

  it('a step left unused holds nothing back, whichever account took it', async () => {
    const { id, curator, ministry } = await world();
    await underReview(id, curator);
    const review = read.get(keyOf('2026.1', 2))!;
    await taken(id, curator, { expected: 2, digest: 'C'.repeat(43) });
    const published = await taken(id, ministry, {
      expected: 2,
      stage: 'published',
      status: 'official',
      previous: review,
    });
    assert.equal(published.revision, 3);
    assert.equal(published.role, 'ministry');
  });

  it('a step it was not signed for, or another world’s, shows nothing', async () => {
    const { id, curator } = await world();
    await taken(id, curator, {});
    const shown = read.get(keyOf('2026.1', 1))!;
    const askWith = async (previous: unknown) => {
      const res = await ask(id, 'steps', curator, step({ expected: 1, stage: 'under-review', previous }));
      return { status: res.status, problem: ((await res.json()) as { problem?: string }).problem };
    };
    const refused = { status: 409, problem: 'revision' };
    assert.deepEqual(await askWith({ ...shown, stage: 'under-review' }), refused);
    assert.deepEqual(await askWith({ ...shown, role: 'ministry' }), refused);
    assert.deepEqual(await askWith(null), refused);
    const other = await world();
    await taken(other.id, other.curator, {});
    const theirs = read.get(keyOf('2026.1', 1))!;
    const res = await ask(id, 'steps', curator, step({ expected: 1, stage: 'under-review', previous: theirs }));
    assert.equal(res.status, 409);
  });

  it('refuses a step that is not shaped as one', async () => {
    const { id, curator } = await world();
    const first = [{ id: 'not a pack' }, { release: '2026' }, { expected: -1 }, { stage: 'gone' }, { status: 'own' }];
    const more = [{ digest: 'short' }, { by: '2026.2' }, { day: 'tomorrow' }, { extra: true }];
    const steps = [{ previous: { revision: 1 } }, { successor: 'none' }];
    for (const bad of [...first, ...more, ...steps]) {
      assert.equal((await ask(id, 'steps', curator, step(bad))).status, 400);
    }
  });

  it('the server keeps no name, and no token in clear', async () => {
    const { id, curator } = await world();
    const done = await taken(id, curator, {});
    const said = JSON.stringify(done);
    assert.equal(said.includes(curator), false);
    const kept = Object.keys(done).sort().join();
    assert.equal(kept, 'by,day,digest,id,release,revision,role,signature,stage,status');
  });
});
