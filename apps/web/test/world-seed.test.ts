// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Starting a seeded national world on a PC (#548, answer 625): the phone app's
// seeded start, bundled as the web build bundles it, with the PC's own Web
// Crypto kit at the full derivation, against a made-up demo server whose
// stand-in CA certifies with the core's own code. Every school's key and every
// teacher's signing key are made, certified and sent in about a dozen requests
// under the starter token, the world's made-up closure is published on its
// national space (answer 626), and the whole start takes under a minute.
// Nothing connects, and the world is made up.

import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { resolvePlugin } from '../scripts/resolve.ts';
import { worldKit } from '../src/native/world-kit.ts';

type Seeding = typeof import('../../android/src/demo/world-seed.ts') &
  typeof import('../../android/src/network/world-network.ts') &
  typeof import('../../android/src/reference.ts') &
  Pick<typeof import('../../../packages/core/src/index.ts'), 'issueCertificate'>;

const out = join(tmpdir(), `minhajna-world-seed-${process.pid}.mjs`);
after(() => rmSync(out, { force: true }));

async function bundled(): Promise<Seeding> {
  await build({
    stdin: {
      contents: [
        `export * from './demo/world-seed.ts';`,
        `export * from './network/world-network.ts';`,
        `export * from './reference.ts';`,
        `export { issueCertificate } from '@minhajna/core';`,
      ].join('\n'),
      resolveDir: fileURLToPath(new URL('../../android/src/', import.meta.url)),
      loader: 'ts',
    },
    outfile: out,
    bundle: true,
    format: 'esm',
    platform: 'node',
    resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.json'],
    define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' },
    plugins: [resolvePlugin],
    logLevel: 'error',
  });
  return (await import(out)) as Seeding;
}

const STARTER = 'made-up-starter-token-0123456789';
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const ca = {
  publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
  sign: (text: string) => Promise.resolve(sign('sha256', Buffer.from(text, 'utf8'), privateKey).toString('base64')),
  verify: (key: string, text: string, signature: string) => worldKit.verify(key, text, signature),
};

describe('a seeded world on a PC', () => {
  it('starts with the PC’s Web Crypto in under a minute, in about a dozen requests', async () => {
    const seeding = await bundled();
    const read = seeding.readReference(seeding.bundledReference);
    assert.ok(read.ok);
    const kept = new Map<string, { date: string; pass: string }>();
    const stored: { seq: number; stream: string; number: number; bytes: string }[] = [];
    const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
    const nationalAnswer = (
      path: string,
      method: string,
      query: URLSearchParams,
      body: unknown,
      world: { date: string },
    ) => {
      if (path === 'spaces/national' && method === 'PUT') return answer(201, {});
      if (path === 'date' && method === 'GET') return answer(200, { date: world.date });
      if (path === 'announced-days' && method === 'PUT') return answer(200, {});
      if (path !== 'spaces/national/batches') return null;
      if (method === 'GET') {
        const after = Number(query.get('after') ?? '0');
        return answer(200, { batches: stored.filter((one) => one.seq > after), more: false });
      }
      const { stream, first, batches } = body as { stream: string; first: number; batches: string[] };
      batches.forEach((bytes, at) => stored.push({ seq: stored.length + 1, stream, number: first + at, bytes }));
      return answer(201, { added: batches.length });
    };
    const seeds: string[] = [];
    let serial = 0;
    const route = async (address: string, init: RequestInit): Promise<Response> => {
      const path = new URL(address).pathname;
      const headers = init.headers as Record<string, string>;
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      if (path === '/worlds') {
        const { world, date, pass } = body as { world: string; date: string; pass: string };
        kept.set(world, { date, pass });
        return new Response(JSON.stringify({ starter: STARTER }), { status: 201 });
      }
      const [, , id, ...rest] = path.split('/');
      const world = kept.get(id);
      if (world === undefined || world.pass !== headers['X-World-Pass']) return new Response('{}', { status: 404 });
      if (rest.join('/') === 'ca') return new Response(JSON.stringify({ publicKey: ca.publicKey }), { status: 200 });
      const national = nationalAnswer(rest.join('/'), init.method ?? 'GET', new URL(address).searchParams, body, world);
      if (national !== null) return national;
      if (rest[0] !== 'seed' || headers.Authorization !== `Bearer ${STARTER}`)
        return new Response('{}', { status: 403 });
      seeds.push(rest[1]);
      if (rest[1] === 'batches') return new Response(JSON.stringify({}), { status: 201 });
      const { requests } = body as { requests: Parameters<Seeding['issueCertificate']>[0][] };
      const certificates = await Promise.all(
        requests.map((one) =>
          seeding.issueCertificate(one, world.date as never, (serial += 1).toString(16).padStart(32, '0'), ca),
        ),
      );
      return new Response(JSON.stringify({ certificates }), { status: 201 });
    };
    const send: Parameters<Seeding['startSeededWorld']>[4] = (request) => seeding.worldRequest(request, route);
    const began = performance.now();
    const started = await seeding.startSeededWorld('national', read.calendar, read, worldKit, send);
    const took = performance.now() - began;
    assert.ok(took < 60_000, `the start took ${Math.round(took)} ms`);
    assert.deepEqual(seeds, [...Array<string>(4).fill('certificates'), ...Array<string>(5).fill('batches')]);
    assert.ok(stored.length > 0);
    assert.equal(seeding.worldNetworkOpen(), started.keys.world);
    seeding.leaveWorldNetwork();
  });
});
