// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The stand-in CA (#554): each world's own CA key, and certificates for the
// signing keys of requests the core makes, which the core's own checks
// take, in that world only. The server does not depend on the core, so the
// test loads its certify.ts at run time, as Node strips its types. Every
// world, device and week here is made up.

import assert from 'node:assert/strict';
import { createPublicKey, generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';
import { MemoryWorldStore } from '../src/worlds/world-store.js';

const OPEN = { perAddress: 1000, total: 1000, windowMs: 60_000 };
const PASS = 'cGFzcy1mb3ItYS1tYWRlLXVwLWRlbW8td29ybGQtMDE';
const WITH_PASS = { 'x-world-pass': PASS };
const WEEK = JSON.stringify({ course: 'made-up course', week: '2026-11-29', lesson: 'درس مختلق' });

interface Signer {
  readonly publicKey: string;
  readonly sign: (text: string) => Promise<string>;
  readonly verify: (publicKey: string, text: string, signature: string) => Promise<boolean>;
}

type Request = Record<string, string>;

/** The parts of packages/core/src/certify.ts the test calls. */
interface Core {
  certificateRequest(world: string, subject: string, signer: Signer): Promise<Request>;
  checkCertificate(value: unknown, world: string, caKey: string, checker: Signer): Promise<boolean>;
  signWeek(text: string, certificate: unknown, signer: Signer): Promise<unknown>;
  checkSignedWeek(value: unknown, world: string, caKey: string, checker: Signer): Promise<unknown>;
}

/** A made-up device's Ed25519 key, signing and checking a text's UTF-8 bytes in hex. */
function signer(): Signer {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    publicKey: Buffer.from(publicKey.export({ format: 'jwk' }).x!, 'base64url').toString('hex'),
    sign: (text) => Promise.resolve(sign(null, Buffer.from(text, 'utf8'), privateKey).toString('hex')),
    verify: (key, text, signature) => {
      try {
        const jwk = { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(key, 'hex').toString('base64url') };
        const pub = createPublicKey({ key: jwk, format: 'jwk' });
        return Promise.resolve(verify(null, Buffer.from(text, 'utf8'), pub, Buffer.from(signature, 'hex')));
      } catch {
        return Promise.resolve(false);
      }
    },
  };
}

let ids = 0;
function freshId(): string {
  ids += 1;
  return `C${String(ids).padStart(4, '0')}`;
}

describe('the stand-in CA', () => {
  let app: NestNodeApplication;
  let base: string;
  let core: Core;
  const teacher = signer();

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

  async function caKey(world: string, headers: Record<string, string> = WITH_PASS): Promise<Response> {
    return fetch(`${base}/worlds/${world}/ca`, { headers });
  }

  async function certify(world: string, body: unknown, headers: Record<string, string> = WITH_PASS) {
    return fetch(`${base}/worlds/${world}/certificates`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }

  before(async () => {
    const certifyTs = new URL('../../../../packages/core/src/certify.ts', import.meta.url);
    core = (await import(certifyTs.href)) as Core;
    app = await createApp(false, { store: new MemoryWorldStore(), starts: OPEN, joins: OPEN });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  it('gives each world its own CA key, the same at every asking, only with the pass', async () => {
    const [one, two] = [await start(), await start()];
    const res = await caKey(one);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const { publicKey } = (await res.json()) as { publicKey: string };
    assert.match(publicKey, /^[0-9a-f]{64}$/);
    assert.deepEqual(await (await caKey(one)).json(), { publicKey });
    assert.notDeepEqual(await (await caKey(two)).json(), { publicKey });
    assert.equal((await caKey(one, { 'x-world-pass': PASS.replace(/^c/, 'd') })).status, 404);
    assert.equal((await caKey('ZZZZZ')).status, 404);
    assert.equal((await caKey(one, {})).status, 404);
  });

  it('certifies a request the core makes, as the core checks it, in its world only', async () => {
    const world = await start();
    const subject = randomBytes(16).toString('hex');
    const res = await certify(world, await core.certificateRequest(world, subject, teacher));
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const certificate = (await res.json()) as Record<string, unknown>;
    assert.deepEqual(
      [certificate['standIn'], certificate['world'], certificate['subject'], certificate['issued']],
      [true, world, subject, '2026-12-01'],
    );
    const { publicKey } = (await (await caKey(world)).json()) as { publicKey: string };
    assert.equal(await core.checkCertificate(certificate, world, publicKey, teacher), true);
    const elsewhere = await start();
    const theirs = ((await (await caKey(elsewhere)).json()) as { publicKey: string }).publicKey;
    assert.equal(await core.checkCertificate(certificate, elsewhere, theirs, teacher), false);

    const week = await core.signWeek(WEEK, certificate, teacher);
    assert.deepEqual(await core.checkSignedWeek(week, world, publicKey, teacher), week);
    assert.equal(await core.checkSignedWeek(week, elsewhere, theirs, teacher), 'uncertified');
  });

  it('refuses a request that is not signed by the key it names, or names another world', async () => {
    const world = await start();
    const request = await core.certificateRequest(world, randomBytes(16).toString('hex'), teacher);
    const thief = signer();
    for (const body of [
      { ...request, publicKey: thief.publicKey },
      { ...request, subject: randomBytes(16).toString('hex') },
      { ...request, signature: await thief.sign('anything') },
      { ...request, world: await start() },
      { ...request, extra: 1 },
      { ...request, subject: 'not an id' },
      [request],
      'a request',
    ]) {
      assert.equal((await certify(world, body)).status, 400, JSON.stringify(body));
    }
    assert.equal((await certify(world, request, { 'x-world-pass': PASS.replace(/^c/, 'd') })).status, 404);
    assert.equal((await certify(world, request, {})).status, 404);
    const serials = [];
    for (let made = 0; made < 2; made += 1) {
      const res = await certify(world, request);
      assert.equal(res.status, 201);
      serials.push(((await res.json()) as { serial: string }).serial);
    }
    assert.notEqual(serials[0], serials[1]);
  });

  it('counts its requests with the other world requests', async () => {
    const limited = await createApp(false, { joins: { perAddress: 2, total: 1000, windowMs: 60_000 } });
    await limited.listen(0, '127.0.0.1');
    try {
      const url = await limited.getUrl();
      const answers = [];
      for (const path of ['ca', 'ca', 'ca', 'certificates']) {
        const method = path === 'ca' ? 'GET' : 'POST';
        answers.push((await fetch(`${url}/worlds/C9999/${path}`, { method, headers: WITH_PASS })).status);
      }
      assert.deepEqual(answers, [404, 404, 429, 429]);
    } finally {
      await limited.close();
    }
  });
});
