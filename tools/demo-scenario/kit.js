// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The cryptography a demo scenario's devices use (#629): Node's own Web
// Crypto, as the PC's world kit (apps/web/src/native/world-kit.ts) uses the
// browser's: PBKDF2-SHA256 and HMAC-SHA256 for a world's pass and sealing key,
// AES-256-GCM with a fresh random 12-byte nonce first for its sealed keys, and
// an ECDSA P-256 pair for its stand-in signing key, with its fingerprint the
// SHA-256 of its SPKI. Signatures stay in Web Crypto's own form, since a
// scenario seals and opens a world but never hands a signed file to the app.

import { Buffer } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';

const { subtle } = webcrypto;
const P256 = { name: 'ECDSA', namedCurve: 'P-256' };
const ECDSA_SHA256 = { name: 'ECDSA', hash: 'SHA-256' };
const NONCE = 12;
const base64 = (bytes) => Buffer.from(bytes).toString('base64');

/** An AES-256 key for one use. */
function aes(key, use) {
  if (key.length !== 32) return Promise.reject(new RangeError('Not a 256-bit key'));
  return subtle.importKey('raw', key, 'AES-GCM', false, [use]);
}

export const worldKit = {
  random: (length) => webcrypto.getRandomValues(new Uint8Array(length)),
  async kdf(secret, salt, rounds) {
    const base = await subtle.importKey('raw', secret, 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(
      await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, base, 256),
    );
  },
  async mac(key, data) {
    const imported = await subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await subtle.sign('HMAC', imported, data));
  },
  cipher: {
    async seal(key, plain, additional) {
      const nonce = webcrypto.getRandomValues(new Uint8Array(NONCE));
      const sealed = await subtle.encrypt(
        { name: 'AES-GCM', iv: nonce, additionalData: additional },
        await aes(key, 'encrypt'),
        plain,
      );
      return new Uint8Array([...nonce, ...new Uint8Array(sealed)]);
    },
    async open(key, sealed, additional) {
      if (sealed.length <= NONCE) return null;
      try {
        const iv = sealed.subarray(0, NONCE);
        const plain = await subtle.decrypt(
          { name: 'AES-GCM', iv, additionalData: additional },
          await aes(key, 'decrypt'),
          sealed.subarray(NONCE),
        );
        return new Uint8Array(plain);
      } catch {
        return null;
      }
    },
  },
  async sign(pkcs8, text) {
    const key = await subtle.importKey('pkcs8', Buffer.from(pkcs8, 'base64'), P256, false, ['sign']);
    return base64(await subtle.sign(ECDSA_SHA256, key, new TextEncoder().encode(text)));
  },
  async verify(spki, payload, signature) {
    const key = await subtle.importKey('spki', Buffer.from(spki, 'base64'), P256, false, ['verify']);
    return subtle.verify(ECDSA_SHA256, key, Buffer.from(signature, 'base64'), new TextEncoder().encode(payload));
  },
  async newPair() {
    const pair = await subtle.generateKey(P256, true, ['sign', 'verify']);
    const spki = await subtle.exportKey('spki', pair.publicKey);
    const fingerprint = Buffer.from(await subtle.digest('SHA-256', spki)).toString('hex');
    return { spki: base64(spki), pkcs8: base64(await subtle.exportKey('pkcs8', pair.privateKey)), fingerprint };
  },
};
