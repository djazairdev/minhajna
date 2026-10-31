// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school key's recovery as a P-256 holder (#571, answer 599): the seed
// both parts give (school-recovery.ts), read as a big-endian number, gives the
// private scalar seed mod (n - 1) + 1, so never zero; its public point is
// worked out here over BigInt in Jacobian coordinates, with one inversion at
// the end, since browsers differ on importing a private key without its public
// point; and the pair is kept as a full PKCS #8, which the phone, the PC and
// Node all import, its crypto the world kit's as any device's. It is worked
// out only when the recovery is made or used. The arithmetic is not constant
// time: it serves the demo's made-up schools, never the real mode.

import { toBase64Url, toHex, type RecoveryDevice } from '@minhajna/core';
import { fromHex } from '../storage/history';
import { B, PRIME, worldKeyCrypto, type DevicePair } from './world-key-crypto';
import type { WorldKit } from './world-session';

/** P-256's order and its base point. */
const ORDER = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
const GX = BigInt('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296');
const GY = BigInt('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5');
/** PKCS #8 for a P-256 key, before its scalar, and between the scalar and its point. */
const HEAD = '308187020100301306072a8648ce3d020106082a8648ce3d030107046d306b0201010420';
const MIDDLE = 'a144034200';

type Point = readonly [bigint, bigint, bigint];

const [ZERO, ONE, TWO, THREE, FOUR, EIGHT] = [0, 1, 2, 3, 4, 8].map(BigInt);
const NOWHERE: Point = [ONE, ONE, ZERO];
const mod = (value: bigint) => ((value % PRIME) + PRIME) % PRIME;

function power(base: bigint, exponent: bigint): bigint {
  let result = ONE;
  for (let at = mod(base), left = exponent; left > ZERO; left >>= ONE, at = mod(at * at)) {
    if (left & ONE) result = mod(result * at);
  }
  return result;
}

/** A point doubled, with a = -3 (dbl-2001-b). */
function double([x, y, z]: Point): Point {
  if (z === ZERO || y === ZERO) return NOWHERE;
  const delta = mod(z * z);
  const gamma = mod(y * y);
  const beta = mod(x * gamma);
  const alpha = mod(THREE * (x - delta) * (x + delta));
  const x3 = mod(alpha * alpha - EIGHT * beta);
  return [x3, mod(alpha * (FOUR * beta - x3) - EIGHT * gamma * gamma), mod((y + z) * (y + z) - gamma - delta)];
}

/** A point plus the base point (madd-2007-bl). */
function addBase(one: Point): Point {
  const [x1, y1, z1] = one;
  if (z1 === ZERO) return [GX, GY, ONE];
  const zz = mod(z1 * z1);
  const h = mod(GX * zz - x1);
  const r = mod(TWO * (GY * z1 * zz - y1));
  if (h === ZERO) return r === ZERO ? double(one) : NOWHERE;
  const hh = mod(h * h);
  const j = mod(h * FOUR * hh);
  const v = mod(x1 * FOUR * hh);
  const x3 = mod(r * r - j - TWO * v);
  return [x3, mod(r * (v - x3) - TWO * y1 * j), mod((z1 + h) * (z1 + h) - zz - hh)];
}

const hex32 = (value: bigint) => value.toString(16).padStart(64, '0');

/**
 * The P-256 pair a seed gives: the scalar seed mod (n - 1) + 1 and its public
 * point. The PKCS #8 is always 138 bytes, so its base64 needs no padding.
 */
export function seededPair(seed: Uint8Array): DevicePair {
  const scalar = (BigInt(`0x${toHex(seed)}`) % (ORDER - ONE)) + ONE;
  let point = NOWHERE;
  for (const bit of scalar.toString(2)) point = bit === '1' ? addBase(double(point)) : double(point);
  const [jx, jy, jz] = point;
  const inverse = power(jz, PRIME - TWO);
  const x = mod(jx * inverse * inverse);
  const y = mod(jy * inverse * inverse * inverse);
  if (jz === ZERO || mod(y * y) !== mod(x * x * x - THREE * x + B)) throw new RangeError('Not a point of the curve');
  const publicKey = `04${hex32(x)}${hex32(y)}`;
  const der = fromHex(`${HEAD}${hex32(scalar)}${MIDDLE}${publicKey}`);
  return { publicKey, pkcs8: toBase64Url(der).replace(/-/gu, '+').replace(/_/gu, '/') };
}

/** The recovery's holder as the world kit makes it from its seed. */
export function recoveryDevice(kit: WorldKit): RecoveryDevice {
  return (seed) => {
    const pair = seededPair(seed);
    return Promise.resolve({ crypto: worldKeyCrypto(kit, pair), publicKey: fromHex(pair.publicKey) });
  };
}
