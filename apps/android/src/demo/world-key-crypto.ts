// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school key's device cryptography (KeyCrypto) inside a demo world (#570,
// answer 595), the same on the phone and the PC, over the world kit: each
// device has an agreement pair on P-256, to be made once for each world and
// kept in its store, its public half the 65-byte uncompressed point the keyring
// names it by. Sealing a key to a device makes a fresh pair, agrees a secret
// with the device's public half, derives an AES-256-GCM key from it by
// HKDF-SHA256 over the kit's HMAC, salted with the fresh and the device's
// public halves and bound to the core's info string, and seals the key under it
// with the info as additional data: the sealed bytes are the fresh public half,
// then the kit's cipher output. Opening does the same with the device's own
// private half. A fresh half that is not a point on the curve, checked here
// whatever the platform's import checks, and what does not open answer null,
// while any other failure, such as a broken private half or a kit that is
// closed, is thrown, so it never reads as a device removed from the keyring.
// The MAC is the kit's. The same sealing seals a term's marks for the state's
// stand-in receiving system (#591), to its public half.

import { toHex, type KeyCrypto } from '@minhajna/core';
import { fromHex } from '../storage/history';
import type { WorldKit } from './world-session';

/** A device's agreement pair for a world: the public half in hex, the private half as PKCS #8 in base64. */
export interface DevicePair {
  readonly publicKey: string;
  readonly pkcs8: string;
}

/** The length of an uncompressed P-256 point. */
const POINT = 65;
/** P-256's prime and the curve's b; its a is -3. */
export const PRIME = BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff');
export const B = BigInt('0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b');
/** The shortest sealed key: the point, the cipher's nonce and its tag. */
const SHORTEST = POINT + 12 + 16;
const encoder = new TextEncoder();

const join = (...parts: readonly Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  parts.reduce((at, part) => (out.set(part, at), at + part.length), 0);
  return out;
};

/** Whether bytes are an uncompressed P-256 point: 04, then x and y below the prime, on y² = x³ - 3x + b. */
export function isPoint(point: Uint8Array): boolean {
  if (point.length !== POINT || point[0] !== 4) return false;
  const [x, y] = [BigInt(`0x${toHex(point.subarray(1, 33))}`), BigInt(`0x${toHex(point.subarray(33))}`)];
  const mod = (value: bigint) => ((value % PRIME) + PRIME) % PRIME;
  return x < PRIME && y < PRIME && mod(y * y) === mod(x * x * x - BigInt(3) * x + B);
}

/** A new agreement pair for this device in a world. */
export async function newDevicePair(kit: WorldKit): Promise<DevicePair> {
  const pair = await kit.newAgreement();
  return { publicKey: toHex(pair.publicKey), pkcs8: pair.pkcs8 };
}

/** HKDF-SHA256 to 32 bytes over the kit's HMAC: one extract, one block of expand. */
async function hkdf(kit: WorldKit, secret: Uint8Array, salt: Uint8Array, info: string): Promise<Uint8Array> {
  const pseudo = await kit.mac(salt, secret);
  return kit.mac(pseudo, join(encoder.encode(info), new Uint8Array([1])));
}

/** Seals bytes to a P-256 public half under `info`: the fresh public half, then the kit's cipher output. */
export async function sealTo(kit: WorldKit, plain: Uint8Array, publicKey: Uint8Array, info: string) {
  if (!isPoint(publicKey)) throw new RangeError('Not a device’s public key');
  const fresh = await kit.newAgreement();
  const secret = await kit.agree(fresh.pkcs8, publicKey);
  const sealing = await hkdf(kit, secret, join(fresh.publicKey, publicKey), info);
  return join(fresh.publicKey, await kit.cipher.seal(sealing, plain, encoder.encode(info)));
}

/** The device's KeyCrypto in a world, from the world kit and the device's own pair. */
export function worldKeyCrypto(kit: WorldKit, own: DevicePair): KeyCrypto {
  const mine = fromHex(own.publicKey);
  return {
    publicKeyBytes: POINT,
    mac: (key, data) => kit.mac(key, data),
    seal: (key, publicKey, info) => sealTo(kit, key, publicKey, info),
    async open(sealed, info) {
      if (sealed.length < SHORTEST) return null;
      const fresh = sealed.subarray(0, POINT);
      if (!isPoint(fresh)) return null;
      const secret = await kit.agree(own.pkcs8, fresh);
      const sealing = await hkdf(kit, secret, join(fresh, mine), info);
      return kit.cipher.open(sealing, sealed.subarray(POINT), encoder.encode(info));
    },
  };
}
