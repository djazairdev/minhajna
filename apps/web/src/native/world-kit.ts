// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The cryptography a demo world needs on a PC (#560, answers 568 and 572),
// all the browser's own Web Crypto, as the PC's vault and signatures use it:
// PBKDF2-SHA256 and HMAC-SHA256 for the world's pass and sealing key,
// AES-256-GCM with a fresh random 12-byte nonce first for its sealed keys,
// and ECDSA P-256 for its stand-in signing key, made extractable only so its
// private half can be sealed for the world, with signatures in the phone's
// DER form, and its fingerprint the SHA-256 of its SPKI. A seal that does not
// open answers null; nothing here keeps a key.

import type { WorldKit } from '../../../android/src/demo/world-session';
import Signature from './Signature.ts';
import { derOf, fromBase64, toBase64 } from './signing/der.ts';

const P256 = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SHA256 = { name: 'ECDSA', hash: 'SHA-256' } as const;
const NONCE = 12;

/** The bytes as a buffer Web Crypto takes. */
function buffer(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function aes(key: Uint8Array, use: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', buffer(key), 'AES-GCM', false, [use]);
}

export const worldKit: WorldKit = {
  random: (length) => crypto.getRandomValues(new Uint8Array(length)),
  async kdf(secret, salt, rounds) {
    const base = await crypto.subtle.importKey('raw', buffer(secret), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: buffer(salt), iterations: rounds },
      base,
      256,
    );
    return new Uint8Array(bits);
  },
  async mac(key, data) {
    const imported = await crypto.subtle.importKey('raw', buffer(key), { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
    ]);
    return new Uint8Array(await crypto.subtle.sign('HMAC', imported, buffer(data)));
  },
  cipher: {
    async seal(key, plain, additional) {
      const nonce = crypto.getRandomValues(new Uint8Array(NONCE));
      const sealed = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce, additionalData: buffer(additional) },
        await aes(key, 'encrypt'),
        buffer(plain),
      );
      const out = new Uint8Array(NONCE + sealed.byteLength);
      out.set(nonce);
      out.set(new Uint8Array(sealed), NONCE);
      return out;
    },
    async open(key, sealed, additional) {
      if (sealed.length <= NONCE) return null;
      try {
        const plain = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: buffer(sealed.subarray(0, NONCE)), additionalData: buffer(additional) },
          await aes(key, 'decrypt'),
          buffer(sealed.subarray(NONCE)),
        );
        return new Uint8Array(plain);
      } catch {
        return null;
      }
    },
  },
  async sign(pkcs8, text) {
    const der = fromBase64(pkcs8);
    if (der === null) throw new RangeError('Not a private key');
    const key = await crypto.subtle.importKey('pkcs8', der, P256, false, ['sign']);
    const raw = await crypto.subtle.sign(SHA256, key, new TextEncoder().encode(text));
    return toBase64(derOf(new Uint8Array(raw)));
  },
  verify: (spki, payload, signature) => Signature.verify(spki, payload, signature),
  async newPair() {
    const pair = await crypto.subtle.generateKey(P256, true, ['sign', 'verify']);
    const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
    return {
      spki: toBase64(new Uint8Array(spki)),
      pkcs8: toBase64(new Uint8Array(pkcs8)),
      fingerprint: hex(await crypto.subtle.digest('SHA-256', spki)),
    };
  },
};
