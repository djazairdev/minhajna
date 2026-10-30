// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up devices for the school key's tests (#550): each with its own ID
// and X25519 keypair, and its crypto from Node's X25519, HKDF, AES-GCM and
// HMAC, as a platform would give it; and records sealed under a key.

import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { newId, toHex, type Holder, type KeyCrypto, type OpenedKeyring } from '../src/index.ts';

const { subtle } = webcrypto;
type CryptoKey = webcrypto.CryptoKey;
type CryptoKeyPair = webcrypto.CryptoKeyPair;
const encoder = new TextEncoder();
export const random = (length: number): Uint8Array => webcrypto.getRandomValues(new Uint8Array(length));
export const SCHOOL = 'made-up-school-of-the-demo';

async function aesFor(mine: CryptoKey, theirs: CryptoKey, salt: Uint8Array, info: string): Promise<CryptoKey> {
  const bits = await subtle.deriveBits({ name: 'X25519', public: theirs }, mine, 256);
  const base = await subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  const params = { name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode(info) };
  return subtle.deriveKey(params, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** A made-up device: its ID, its public key, and its crypto, which opens only what was sealed for it. */
export async function device(): Promise<{ holder: Holder; crypto: KeyCrypto }> {
  const pair = (await subtle.generateKey({ name: 'X25519' }, true, ['deriveBits'])) as CryptoKeyPair;
  const mine = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
  const crypto: KeyCrypto = {
    seal: async (key, publicKey, info) => {
      const once = (await subtle.generateKey({ name: 'X25519' }, true, ['deriveBits'])) as CryptoKeyPair;
      const sent = new Uint8Array(await subtle.exportKey('raw', once.publicKey));
      const to = await subtle.importKey('raw', publicKey, { name: 'X25519' }, false, []);
      const aes = await aesFor(once.privateKey, to, new Uint8Array([...sent, ...publicKey]), info);
      const iv = random(12);
      const sealed = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, aes, key));
      return new Uint8Array([...sent, ...iv, ...sealed]);
    },
    open: async (sealed, info) => {
      try {
        const from = await subtle.importKey('raw', sealed.subarray(0, 32), { name: 'X25519' }, false, []);
        const aes = await aesFor(pair.privateKey, from, new Uint8Array([...sealed.subarray(0, 32), ...mine]), info);
        const iv = sealed.subarray(32, 44);
        return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv }, aes, sealed.subarray(44)));
      } catch {
        return null;
      }
    },
    mac: async (key, data) => {
      const hmac = await subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      return new Uint8Array(await subtle.sign('HMAC', hmac, data));
    },
    publicKeyBytes: 32,
  };
  return { holder: { id: newId(random), publicKey: toHex(mine) }, crypto };
}

/** A record sealed under a key, and whether a key opens it. */
export async function sealRecord(key: Uint8Array): Promise<Uint8Array> {
  const aes = await subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt']);
  const iv = random(12);
  return new Uint8Array([...iv, ...new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, aes, random(64)))]);
}

export async function opensRecord(key: Uint8Array, sealed: Uint8Array): Promise<boolean> {
  const aes = await subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);
  return subtle.decrypt({ name: 'AES-GCM', iv: sealed.subarray(0, 12) }, aes, sealed.subarray(12)).then(
    () => true,
    () => false,
  );
}

export function opened(result: OpenedKeyring | string): OpenedKeyring {
  assert.notEqual(typeof result, 'string', typeof result === 'string' ? result : '');
  return result as OpenedKeyring;
}
