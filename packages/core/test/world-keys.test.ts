// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A demo world's keys (#556): the pass and the sealing key worked out from
// the code alone, slowly and salted with the world; the world's keys sealed
// so that only its code opens them; and files its keys sign, which name the
// world, so they open only in it, while real mode and other worlds refuse
// them. Node's PBKDF2, HMAC, AES-GCM and P-256 stand in for the platform's.
// Every world, key and file is made up.

import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  makeWorldCode,
  MOST_SEALED_WORLD,
  openSigned,
  openWorldKeys,
  sealWorldKeys,
  SIGNED_BYTES,
  WORLD_KDF_ROUNDS,
  worldCodeSecret,
  worldIdOfCode,
  worldSecrets,
  worldSignedFile,
  type WorldCipher,
  type WorldKdf,
  type WorldSecrets,
} from '../src/index.ts';
import { makeTestKey, nodeVerifier, signedFile } from './signed-fixtures.ts';
import { random } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';
import { signWith, worldKeys } from './world-signing.ts';

const kdf: WorldKdf = (secret, salt, rounds) =>
  Promise.resolve(new Uint8Array(pbkdf2Sync(secret, salt, rounds, 32, 'sha256')));
/** The same derivation in one round, for the tests that do not time it. */
const quick: WorldKdf = (secret, salt) => kdf(secret, salt, 1);

const PAIR = { sign: signWith, verify: nodeVerifier };

describe('a world’s secrets', () => {
  it('derives the pass and the sealing key from the code alone, slowly, salted with the world', async () => {
    const code = makeWorldCode(random);
    const seen: { secret: string; salt: string; rounds: number }[] = [];
    const watched: WorldKdf = (secret, salt, rounds) => {
      seen.push({ secret: Buffer.from(secret).toString(), salt: Buffer.from(salt).toString(), rounds });
      return kdf(secret, salt, rounds);
    };
    const secrets = await worldSecrets(code, watched, mac);
    assert.deepEqual(seen, [
      { secret: worldCodeSecret(code), salt: `minhajna/world/${worldIdOfCode(code)}`, rounds: WORLD_KDF_ROUNDS },
    ]);
    assert.equal(WORLD_KDF_ROUNDS, 600_000);
    assert.equal(secrets.world, worldIdOfCode(code));
    assert.match(secrets.pass, /^[A-Za-z0-9_-]{43}$/u);
    assert.equal(secrets.sealing.length, 32);
    assert.equal(secrets.pass.includes(worldCodeSecret(code)), false);

    const typed = code.toLowerCase().replace(/(.{5})/gu, '$1 ');
    assert.deepEqual(await worldSecrets(typed, quick, mac), await worldSecrets(code, quick, mac));
    await assert.rejects(worldSecrets(code.slice(0, 19), quick, mac), /world code/);
    await assert.rejects(
      worldSecrets(code, () => Promise.resolve(new Uint8Array(16)), mac),
      /32 bytes/,
    );
  });
});

describe('a world’s sealed keys', () => {
  async function sealed() {
    const code = makeWorldCode(random);
    const secrets = await worldSecrets(code, quick, mac);
    const keys = worldKeys(secrets.world);
    return { code, secrets, keys, text: await sealWorldKeys(keys, secrets, cipher, PAIR) };
  }

  it('open with the world’s code only', async () => {
    const { secrets, keys, text } = await sealed();
    assert.match(text, /^[A-Za-z0-9_-]+$/u);
    assert.equal(text.includes(keys.private['world-ministry']!.slice(0, 40)), false);
    assert.deepEqual(await openWorldKeys(text, secrets, cipher), keys);
    const teachers = { ...keys, kind: 'teachers' as const };
    assert.deepEqual(
      await openWorldKeys(await sealWorldKeys(teachers, secrets, cipher, PAIR), secrets, cipher),
      teachers,
    );

    const other = await sealed();
    assert.equal(await openWorldKeys(text, other.secrets, cipher), null);
    const elsewhere: WorldSecrets = { ...secrets, world: other.secrets.world };
    assert.equal(await openWorldKeys(text, elsewhere, cipher), null);
    const flipped = text.slice(0, 10) + (text[10] === 'A' ? 'B' : 'A') + text.slice(11);
    for (const changed of [flipped, text.slice(1), `${text}A`, `${text}AB`, '*', '', `${text}=`]) {
      assert.equal(await openWorldKeys(changed, secrets, cipher), null, changed.slice(-3));
    }
    assert.equal(await openWorldKeys('A'.repeat(MOST_SEALED_WORLD + 4), secrets, cipher), null);
  });

  it('fit the server, or are refused before they reach it', async () => {
    const { secrets, keys } = await sealed();
    const sized = (bytes: number): WorldCipher => ({ ...cipher, seal: () => Promise.resolve(new Uint8Array(bytes)) });
    const most = (MOST_SEALED_WORLD / 4) * 3;
    assert.equal((await sealWorldKeys(keys, secrets, sized(most), PAIR)).length, MOST_SEALED_WORLD);
    await assert.rejects(sealWorldKeys(keys, secrets, sized(most + 1), PAIR), /server/);
  });

  it('are refused unless they are keys of this world', async () => {
    const { secrets, keys } = await sealed();
    const half = keys.private['world-ministry']!;
    for (const changed of [
      { ...keys, world: 'ABCDE' },
      { ...keys, kind: 'school' as never },
      { ...keys, kind: undefined as never },
      { ...keys, private: {} },
      { ...keys, private: { 'world-ministry': half, other: half } },
      { ...keys, private: { 'world-ministry': 'not base64!' } },
      { ...keys, trusted: [{ ...keys.trusted[0]!, signs: ['timetables' as never] }] },
      { ...keys, trusted: [{ ...keys.trusted[0]!, id: 'ministry' }], private: { ministry: half } },
      { ...keys, private: { 'world-ministry': worldKeys(keys.world).private['world-ministry']! } },
    ]) {
      await assert.rejects(
        sealWorldKeys(changed, secrets, cipher, PAIR),
        /this world/,
        JSON.stringify(changed.private),
      );
    }
  });
});

describe('a file a world’s key signs', () => {
  it('names the world, opens only in it, and is refused in real mode and in other worlds', async () => {
    const secrets = await worldSecrets(makeWorldCode(random), quick, mac);
    const keys = worldKeys(secrets.world);
    const payload = JSON.stringify({ calendar: 'made-up', year: '2026-2027' });
    const file = await worldSignedFile(keys, 'world-ministry', payload, signWith);
    const fields = JSON.parse(file) as Record<string, unknown>;
    assert.equal(fields['world'], secrets.world);
    const open = (text: string, world: string | null) =>
      openSigned(text, keys.trusted, nodeVerifier, SIGNED_BYTES, world);

    const opened = await open(file, secrets.world);
    assert.deepEqual(opened.ok ? opened.payload : opened, JSON.parse(payload));
    assert.deepEqual(await open(file, null), { ok: false, problem: 'invalid' });
    assert.deepEqual(await open(file, 'ABCDE'), { ok: false, problem: 'invalid' });

    const unnamed = JSON.stringify({ ...fields, world: undefined });
    assert.deepEqual(await open(unnamed, null), { ok: false, problem: 'unknown-key' });
    const bare = await signWith(keys.private['world-ministry']!, payload);
    const marked = JSON.stringify({ ...fields, signature: bare });
    assert.deepEqual(await open(marked, secrets.world), { ok: false, problem: 'signature', key: keys.trusted[0] });

    const real = makeTestKey('example-calendar');
    const realFile = signedFile(real, { calendar: 'made-up' });
    assert.deepEqual(await openSigned(realFile, [real.trusted], nodeVerifier, SIGNED_BYTES, secrets.world), {
      ok: false,
      problem: 'invalid',
    });
    assert.equal((await openSigned(realFile, [real.trusted], nodeVerifier)).ok, true);
    const posing = makeTestKey('world-ministry');
    assert.deepEqual(await openSigned(signedFile(posing, {}), [posing.trusted], nodeVerifier), {
      ok: false,
      problem: 'unknown-key',
    });
    const named = JSON.stringify({ ...JSON.parse(signedFile(real, {})), world: secrets.world });
    assert.deepEqual(await openSigned(named, [real.trusted], nodeVerifier, SIGNED_BYTES, secrets.world), {
      ok: false,
      problem: 'unknown-key',
    });
    await assert.rejects(worldSignedFile(keys, 'another-key', payload, signWith), /this world/);
    await assert.rejects(worldSignedFile(keys, 'world-ministry', '\ud800', signWith), /payload/);
  });
});
