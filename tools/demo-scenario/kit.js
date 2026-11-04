// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The cryptography a demo scenario's devices use (#629, #630): Node's own Web
// Crypto, as the PC's world kit (apps/web/src/native/world-kit.ts) uses the
// browser's: PBKDF2-SHA256 and HMAC-SHA256 for a world's pass and sealing key,
// AES-256-GCM with a fresh random 12-byte nonce first for its sealed keys, ECDH
// P-256 for the key agreement that seals a school's key to a device, with its
// public half as its uncompressed point, and an ECDSA P-256 pair for its
// signing keys, with its fingerprint the SHA-256 of its SPKI and signatures in
// the phone's DER form, as the app's checks and the server's CA read them. A
// kit made for a seed draws its random bytes from it (seededKit), so a scenario
// draws the same world each time on an empty server.

import { Buffer } from 'node:buffer';
import { createHash, createPrivateKey, createPublicKey, sign, verify, webcrypto } from 'node:crypto';

const { subtle } = webcrypto;
const P256 = { name: 'ECDSA', namedCurve: 'P-256' };
const ECDH = { name: 'ECDH', namedCurve: 'P-256' };
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
    const key = createPrivateKey({ key: Buffer.from(pkcs8, 'base64'), format: 'der', type: 'pkcs8' });
    return sign('sha256', Buffer.from(text), key).toString('base64');
  },
  async verify(spki, payload, signature) {
    const key = createPublicKey({ key: Buffer.from(spki, 'base64'), format: 'der', type: 'spki' });
    return verify('sha256', Buffer.from(payload), key, Buffer.from(signature, 'base64'));
  },
  async newPair() {
    const pair = await subtle.generateKey(P256, true, ['sign', 'verify']);
    const spki = await subtle.exportKey('spki', pair.publicKey);
    const fingerprint = Buffer.from(await subtle.digest('SHA-256', spki)).toString('hex');
    return { spki: base64(spki), pkcs8: base64(await subtle.exportKey('pkcs8', pair.privateKey)), fingerprint };
  },
  async newAgreement() {
    const pair = await subtle.generateKey(ECDH, true, ['deriveBits']);
    const publicKey = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
    return { publicKey, pkcs8: base64(await subtle.exportKey('pkcs8', pair.privateKey)) };
  },
  async agree(pkcs8, publicKey) {
    if (publicKey.length !== 65) throw new RangeError('Not a P-256 point');
    const own = await subtle.importKey('pkcs8', Buffer.from(pkcs8, 'base64'), ECDH, false, ['deriveBits']);
    const theirs = await subtle.importKey('raw', publicKey, ECDH, false, []);
    return new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: theirs }, own, 256));
  },
};

/** The kit with its random bytes drawn from a seed: each draw the SHA-256 of the seed and a count, in turn. */
export function seededKit(seed) {
  let count = 0;
  const block = () =>
    createHash('sha256')
      .update(`${seed}\n${(count += 1)}`)
      .digest();
  const random = (length) => {
    const drawn = [];
    while (drawn.length < length) drawn.push(...block());
    return new Uint8Array(drawn.slice(0, length));
  };
  return { ...worldKit, random };
}
