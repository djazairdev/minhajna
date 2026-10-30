// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A demo world on a PC (#560, answer 572): the phone app's world session,
// bundled as the web build bundles it, with the PC's own Web Crypto kit at
// the full derivation, against a made-up demo server. A world started on the
// PC opens again with its code alone; what the server keeps is the world's ID,
// its pass and keys sealed; the stand-in signing key's private half seals, and
// its signatures check both on the PC and with Node's own P-256; a seal
// changed by one byte does not open. Nothing connects, and the world is
// made up.

import assert from 'node:assert/strict';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { resolvePlugin } from '../scripts/resolve.ts';
import { worldKit } from '../src/native/world-kit.ts';

type Session = typeof import('../../android/src/demo/world-session.ts') &
  typeof import('../../android/src/network/world-network.ts') &
  typeof import('../../android/src/reference.ts');

const out = join(tmpdir(), `minhajna-world-session-${process.pid}.mjs`);
after(() => rmSync(out, { force: true }));

async function bundled(): Promise<Session> {
  await build({
    stdin: {
      contents: [
        `export * from './demo/world-session.ts';`,
        `export * from './network/world-network.ts';`,
        `export * from './reference.ts';`,
      ].join('\n'),
      resolveDir: fileURLToPath(new URL('../../android/src/', import.meta.url)),
      loader: 'ts',
    },
    outfile: out,
    bundle: true,
    format: 'esm',
    platform: 'node',
    resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.json'],
    define: { __DEV__: 'false' },
    plugins: [resolvePlugin],
    logLevel: 'error',
  });
  return (await import(out)) as Session;
}

const kept = new Map<string, { sealed: string; date: string; pass: string }>();

interface Started {
  readonly world: string;
  readonly sealed: string;
  readonly date: string;
  readonly pass: string;
}

function route(address: string, init: RequestInit): Response {
  const path = new URL(address).pathname;
  const headers = init.headers as Record<string, string>;
  if (path === '/worlds') {
    const { world, sealed, date, pass } = JSON.parse(init.body as string) as Started;
    kept.set(world, { sealed, date, pass });
    return new Response(JSON.stringify({ starter: 'made-up-starter-token-0123456789' }), { status: 201 });
  }
  const world = kept.get(path.split('/')[2]);
  if (world === undefined || world.pass !== headers['X-World-Pass']) return new Response('{}', { status: 404 });
  return new Response(JSON.stringify({ sealed: world.sealed, date: world.date }), { status: 200 });
}

const server = (address: string, init: RequestInit) => Promise.resolve().then(() => route(address, init));

describe('a demo world on a PC', () => {
  it('starts with the PC’s Web Crypto and opens again with its code alone', async () => {
    const session = await bundled();
    const read = session.readReference(session.bundledReference);
    assert.ok(read.ok);
    const send: Parameters<Session['startWorld']>[3] = (request) => session.worldRequest(request, server);
    const started = await session.startWorld('national', read.calendar, worldKit, send);
    const world = kept.get(started.keys.world)!;
    assert.equal(world.date, started.date);
    assert.match(world.pass, /^[A-Za-z0-9_-]{43}$/u);
    assert.equal(world.sealed.includes(started.keys.private[session.WORLD_SIGNER]), false);
    session.leaveWorldNetwork();

    const joined = await session.joinWorld(started.code, worldKit, send);
    assert.deepEqual(joined, { keys: started.keys, date: started.date });
    session.leaveWorldNetwork();

    const [key] = started.keys.trusted;
    const signature = await worldKit.sign(started.keys.private[key.id], 'minhajna/world/1\nmade-up');
    assert.equal(await worldKit.verify(key.spki, 'minhajna/world/1\nmade-up', signature), true);
    const spki = createPublicKey({ key: Buffer.from(key.spki, 'base64'), format: 'der', type: 'spki' });
    assert.equal(
      verify('sha256', Buffer.from('minhajna/world/1\nmade-up'), spki, Buffer.from(signature, 'base64')),
      true,
    );
    assert.equal(createHash('sha256').update(Buffer.from(key.spki, 'base64')).digest('hex'), key.fingerprint);

    const changed = world.sealed.startsWith('A') ? `B${world.sealed.slice(1)}` : `A${world.sealed.slice(1)}`;
    world.sealed = changed;
    await assert.rejects(session.joinWorld(started.code, worldKit, send), { code: 'E_WORLD_SERVER' });
    assert.equal(session.worldNetworkOpen(), null);
  });

  it('opens nothing sealed under another key, too short, or for another use', async () => {
    const key = worldKit.random(32);
    const additional = new TextEncoder().encode('minhajna/world-keys/1\nABCDE');
    const sealed = await worldKit.cipher.seal(key, new TextEncoder().encode('made-up'), additional);
    assert.equal(new TextDecoder().decode((await worldKit.cipher.open(key, sealed, additional))!), 'made-up');
    assert.equal(await worldKit.cipher.open(worldKit.random(32), sealed, additional), null);
    assert.equal(await worldKit.cipher.open(key, sealed, new TextEncoder().encode('another')), null);
    assert.equal(await worldKit.cipher.open(key, sealed.subarray(0, 12), additional), null);
    const again = await worldKit.cipher.seal(key, new TextEncoder().encode('made-up'), additional);
    assert.notDeepEqual(again.subarray(0, 12), sealed.subarray(0, 12));
    await assert.rejects(worldKit.sign('not base64!', 'made-up'), RangeError);
  });
});
