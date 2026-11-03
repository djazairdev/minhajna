// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Seeding a world's certificates, and what every seeding request counts
// (#548, answer 625): with the starter token alone, up to 128 certificates at
// once for requests the core makes, which the core's checks take, a refusal
// naming the request; each request counted once against its limit, and a
// seeding's batches against the daily quota before anything is opened or
// added, a stream refused costing nothing. The server does not depend on the
// core, so the test loads its certify.ts at run time, as Node strips its types.
// Every world, device and batch here is made up.

import assert from 'node:assert/strict';
import { createPublicKey, generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';
import { batches, message, OPEN, PASS, read, SCHOOLS, seed, start, STREAMS } from './seed-kit.js';

interface Signer {
  readonly publicKey: string;
  readonly sign: (text: string) => Promise<string>;
}

/** The parts of packages/core/src/certify.ts the test calls. */
interface Core {
  certificateRequest(world: string, subject: string, signer: Signer): Promise<Record<string, string>>;
  checkCertificate(value: unknown, world: string, caKey: string, checker: unknown): Promise<boolean>;
}

function signer(): Signer {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
    sign: (text) => Promise.resolve(sign('sha256', Buffer.from(text, 'utf8'), privateKey).toString('base64')),
  };
}

/** Checks a text's ECDSA P-256 signature under a key, as the core's KeyChecker does. */
const checker = {
  verify: (key: string, text: string, signature: string) => {
    try {
      const pub = createPublicKey({ key: Buffer.from(key, 'base64'), format: 'der', type: 'spki' });
      return Promise.resolve(verify('sha256', Buffer.from(text, 'utf8'), pub, Buffer.from(signature, 'base64')));
    } catch {
      return Promise.resolve(false);
    }
  },
};

describe('seeding a world', () => {
  let app: NestNodeApplication;
  let base: string;
  let core: Core;

  before(async () => {
    const certifyTs = new URL('../../../../packages/core/src/certify.ts', import.meta.url);
    core = (await import(certifyTs.href)) as Core;
    app = await createApp(false, { starts: OPEN, joins: OPEN, relay: OPEN });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  it("certifies up to 128 requests the core makes, in order, on the world's date, with the starter token", async () => {
    const { world, starter } = await start(base);
    const keys = Array.from({ length: 128 }, signer);
    const subjects = keys.map(() => randomBytes(16).toString('hex'));
    const requests = await Promise.all(keys.map((key, at) => core.certificateRequest(world, subjects[at]!, key)));
    const res = await seed(base, world, 'certificates', { requests }, `Bearer ${starter}`);
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const { certificates } = (await res.json()) as { certificates: Record<string, unknown>[] };
    assert.deepEqual(
      certificates.map((one) => [one['subject'], one['issued'], one['standIn']]),
      subjects.map((subject) => [subject, '2026-11-22', true]),
    );
    const ca = (await (await fetch(`${base}/worlds/${world}/ca`, { headers: { 'x-world-pass': PASS } })).json()) as {
      publicKey: string;
    };
    assert.equal(await core.checkCertificate(certificates[127], world, ca.publicKey, checker), true);
    const one = { requests: requests.slice(0, 1) };
    const other = (await start(base)).starter;
    for (const authorization of [null, `Bearer ${other}`, starter, `Basic ${starter}`]) {
      assert.equal((await seed(base, world, 'certificates', one, authorization)).status, 403);
    }
    const wrong = await fetch(`${base}/worlds/${world}/seed/certificates`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-world-pass': PASS.replace(/^c/, 'd') },
      body: JSON.stringify(one),
    });
    assert.equal(wrong.status, 404);
  });

  it('refuses no request, more than 128, anything else, or one the CA refuses, naming it', async () => {
    const { world, starter } = await start(base);
    const request = await core.certificateRequest(world, randomBytes(16).toString('hex'), signer());
    const messages = [];
    for (const body of [
      { requests: [] },
      { requests: Array.from({ length: 129 }, () => request) },
      { requests: [request], extra: 1 },
      [request],
      { requests: [request, { ...request, world: 'S9999' }] },
    ]) {
      const res = await seed(base, world, 'certificates', body, `Bearer ${starter}`);
      assert.equal(res.status, 400);
      messages.push(await message(res));
    }
    assert.equal(messages[4], 'request 1: a request names the world it is sent to');
  });

  it('counts each request once against its limit, and its batches against the daily quota', async () => {
    const limited = await createApp(false, {
      starts: OPEN,
      joins: { perAddress: 1, total: 1000, windowMs: 60_000 },
      relay: { perAddress: 4, total: 1000, windowMs: 60_000 },
      uploads: { perAddress: 3, total: 1000, windowMs: 60_000 },
    });
    await limited.listen(0, '127.0.0.1');
    try {
      const url = await limited.getUrl();
      const { world, starter } = await start(url);
      const bearer = `Bearer ${starter}`;
      const request = await core.certificateRequest(world, randomBytes(16).toString('hex'), signer());
      const requests = Array.from({ length: 128 }, () => request);
      assert.equal((await seed(url, world, 'certificates', { requests }, bearer)).status, 201);
      assert.equal((await seed(url, world, 'certificates', { requests }, bearer)).status, 429);
      const spaces = [{ space: SCHOOLS[0], kind: 'school' }];
      const stream = (first: number, count: number) => ({
        space: SCHOOLS[0],
        stream: STREAMS[0],
        first,
        batches: batches(count),
      });
      assert.equal((await seed(url, world, 'batches', { spaces, streams: [stream(0, 4)] }, bearer)).status, 429);
      assert.equal(await read(url, world, SCHOOLS[0]!), 404);
      const refused = await seed(url, world, 'batches', { spaces, streams: [stream(1, 3)] }, bearer);
      assert.equal(refused.status, 409);
      assert.equal((await seed(url, world, 'batches', { spaces: [], streams: [stream(0, 3)] }, bearer)).status, 201);
      assert.equal(await read(url, world, SCHOOLS[0]!), 429);
    } finally {
      await limited.close();
    }
  });
});
