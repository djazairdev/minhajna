// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school key's device cryptography inside a demo world (#570, answer 595),
// over the test kit's P-256: a key sealed to a device opens on that device
// under the same info only, each seal with a fresh pair, never on another
// device, under another info, or once a byte is changed, and a sealed key too
// short or with a point off the curve answers null, while sealing to a key of
// the wrong length throws; only an uncompressed point on the curve is a device
// key, and a kit that fails is thrown, never read as a device removed; a
// device's public half is the 65-byte uncompressed point; and the core's
// keyring starts on a director's device, opens there, takes another device that
// opens it too, and refuses a device it does not hold. Every school and device
// is made up.

import { addHolder, newId, openKeyring, startKeyring, type Holder } from '@minhajna/core';
import { isPoint, newDevicePair, worldKeyCrypto } from '../src/demo/world-key-crypto';
import { nodeKit } from '../jest/world-server';

const SCHOOL = 'made-up-school-of-the-demo';
const key = new Uint8Array(32).fill(7);

/** A made-up device of the world: its ID, pair, crypto and holder. */
async function device() {
  const pair = await newDevicePair(nodeKit);
  const crypto = worldKeyCrypto(nodeKit, pair);
  const holder: Holder = { id: newId(nodeKit.random), publicKey: pair.publicKey };
  return { pair, crypto, holder };
}

test('a key sealed to a device opens there under its info only', async () => {
  const [one, other] = [await device(), await device()];
  expect(one.pair.publicKey).toMatch(/^04[0-9a-f]{128}$/u);
  const to = Uint8Array.from(Buffer.from(one.pair.publicKey, 'hex'));
  const sealed = await other.crypto.seal(key, to, 'minhajna/test/info');
  expect(await one.crypto.open(sealed, 'minhajna/test/info')).toEqual(key);
  expect(await one.crypto.open(sealed, 'minhajna/test/other')).toBeNull();
  expect(await other.crypto.open(sealed, 'minhajna/test/info')).toBeNull();
  const changed = sealed.slice();
  changed[changed.length - 1] ^= 1;
  expect(await one.crypto.open(changed, 'minhajna/test/info')).toBeNull();
  expect(await one.crypto.open(sealed.subarray(0, 90), 'minhajna/test/info')).toBeNull();
  const offCurve = sealed.slice();
  offCurve.fill(1, 1, 65);
  expect(await one.crypto.open(offCurve, 'minhajna/test/info')).toBeNull();
  await expect(other.crypto.seal(key, to.subarray(1), 'minhajna/test/info')).rejects.toThrow(RangeError);
  const again = await other.crypto.seal(key, to, 'minhajna/test/info');
  expect(again.subarray(0, 65)).not.toEqual(sealed.subarray(0, 65));
  expect(await one.crypto.open(again, 'minhajna/test/info')).toEqual(key);
});

test('only a point on the curve is a device key, and a failing kit is thrown, never read as removed', async () => {
  const one = await device();
  const point = Uint8Array.from(Buffer.from(one.pair.publicKey, 'hex'));
  expect(isPoint(point)).toBe(true);
  expect(isPoint(Uint8Array.from([2, ...point.subarray(1, 33)]))).toBe(false);
  expect(isPoint(Uint8Array.from([4, ...point.subarray(1, 64), point[64] ^ 1]))).toBe(false);
  expect(isPoint(Uint8Array.from([4, ...new Uint8Array(32).fill(255), ...point.subarray(33)]))).toBe(false);
  const sealed = await one.crypto.seal(key, point, 'minhajna/test/info');
  const closed = worldKeyCrypto({ ...nodeKit, agree: () => Promise.reject(new Error('made-up closed kit')) }, one.pair);
  await expect(closed.open(sealed, 'minhajna/test/info')).rejects.toThrow('made-up closed kit');
});

test("the core's keyring starts, opens and takes another device over this crypto", async () => {
  const [director, deputy, stranger] = [await device(), await device(), await device()];
  const started = await startKeyring(SCHOOL, director.holder, director.crypto, nodeKit.random);
  const opened = await openKeyring(started.ring, director.holder.id, director.crypto);
  expect(opened).toEqual(started);
  const added = await addHolder(started, deputy.holder, director.holder.id, director.crypto);
  const there = await openKeyring(added.ring, deputy.holder.id, deputy.crypto);
  expect(typeof there === 'string' ? there : there.keys).toEqual(started.keys);
  expect(await openKeyring(added.ring, stranger.holder.id, stranger.crypto)).toBe('removed');
});
