// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school key's recovery as a P-256 holder (#571, answer 599): a seed gives
// the same pair each time, and another seed another; Node imports its PKCS #8
// and finds the same public point; a seed of zeros or of the order's bytes
// still gives a scalar inside it; and with the world kit's crypto the
// recovery made from two parts holds the keyring and recovers it, while one
// part alone does not. Every school and device is made up.

import { createPrivateKey, createPublicKey } from 'node:crypto';
import {
  addRecovery,
  makeRecoveryParts,
  recoverKeyring,
  startKeyring,
  toHex,
  type RecoveryParts,
} from '@minhajna/core';
import { nodeKit } from '../jest/world-server';
import { recoveryDevice, seededPair } from '../src/demo/recovery-device';
import { newDevicePair, worldKeyCrypto } from '../src/demo/world-key-crypto';
import { fromHex } from '../src/storage/history';

const SCHOOL = 'made-up-school-of-the-demo';

const nodePublic = (pkcs8: string) =>
  toHex(
    new Uint8Array(
      createPublicKey(createPrivateKey({ key: Buffer.from(pkcs8, 'base64'), format: 'der', type: 'pkcs8' })).export({
        format: 'der',
        type: 'spki',
      }),
    ).subarray(-65),
  );

test('a seed gives the same pair each time, which Node reads as the same point', () => {
  const seed = nodeKit.random(32);
  const pair = seededPair(seed);
  expect(seededPair(seed)).toEqual(pair);
  expect(seededPair(nodeKit.random(32))).not.toEqual(pair);
  expect(pair.publicKey).toMatch(/^04[0-9a-f]{128}$/u);
  expect(nodePublic(pair.pkcs8)).toBe(pair.publicKey);
  const order = fromHex('ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
  for (const edge of [new Uint8Array(32), order, new Uint8Array(32).fill(0xff)]) {
    const one = seededPair(edge);
    expect(nodePublic(one.pkcs8)).toBe(one.publicKey);
  }
});

test('the recovery made from both parts holds the keyring and recovers it, one part alone does not', async () => {
  const pair = await newDevicePair(nodeKit);
  const crypto = worldKeyCrypto(nodeKit, pair);
  const director = { id: 'a'.repeat(32), publicKey: pair.publicKey };
  const one = await startKeyring(SCHOOL, director, crypto, nodeKit.random);
  const parts = makeRecoveryParts(nodeKit.random);
  const device = recoveryDevice(nodeKit);
  const two = await addRecovery(one, parts, director.id, crypto, device);
  const rings = [null, one.ring, two.ring];
  const recovered = await recoverKeyring(SCHOOL, rings, parts, crypto, device);
  expect(typeof recovered).toBe('object');
  if (typeof recovered === 'string') return;
  expect(recovered.opened.keys).toEqual(two.keys);
  const other = makeRecoveryParts(nodeKit.random);
  const half: RecoveryParts = { school: parts.school, directorate: other.directorate };
  expect(await recoverKeyring(SCHOOL, rings, half, crypto, device)).toBe('wrong');
});
