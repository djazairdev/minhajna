// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The keys the app trusts (data/dz/keys.json) and the signature vector the
// phone's own check is tested with. A key must be on P-256, the only curve
// the phone checks with, and its published fingerprint the SHA-256 of it,
// so a wrong or mistyped key never ships; the vector, signed by Node with a
// key thrown away, must check here as it does on Android.

import assert from 'node:assert/strict';
import { createHash, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseTrustedKeys } from '../src/index.ts';
import { isP256, nodeVerifier } from './signed-fixtures.ts';
import vector from './signature-vector.json' with { type: 'json' };

const keys = JSON.parse(readFileSync(new URL('../../../data/dz/keys.json', import.meta.url), 'utf8')) as unknown;

test('every trusted key reads, and its fingerprint is the SHA-256 of its public half', () => {
  const read = parseTrustedKeys(keys);
  assert.deepEqual(read.ok ? [] : read.problems, []);
  assert.ok(read.ok);
  for (const key of read.value) {
    const der = Buffer.from(key.spki, 'base64');
    assert.equal(der.toString('base64'), key.spki, `${key.id}: the public half is not canonical base64`);
    assert.equal(createHash('sha256').update(der).digest('hex'), key.fingerprint, `${key.id}: fingerprint`);
    assert.ok(isP256(createPublicKey({ key: der, format: 'der', type: 'spki' })), `${key.id}: not a P-256 key`);
  }
});

test('Node, like the phone, trusts only P-256 keys', () => {
  assert.equal(isP256(generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey), true);
  assert.equal(isP256(generateKeyPairSync('ec', { namedCurve: 'P-384' }).publicKey), false);
  assert.equal(isP256(generateKeyPairSync('ec', { namedCurve: 'secp256k1' }).publicKey), false);
  assert.equal(isP256(generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey), false);
});

test('the shared vector checks, and a changed payload does not', async () => {
  assert.equal(await nodeVerifier(vector.spki, vector.payload, vector.signature), true);
  assert.equal(await nodeVerifier(vector.spki, `${vector.payload} `, vector.signature), false);
});
