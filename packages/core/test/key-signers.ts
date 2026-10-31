// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up devices' signing keys for the tests of certificates and of what
// they sign (#554, #555, answer 580): Node's ECDSA P-256, as a platform's
// would be, over a text's UTF-8 bytes, with each key's SPKI and each
// signature's DER in base64; and the other signature anyone can make of a
// signed text without the key, (r, n - s).

import { createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import type { KeySigner } from '../src/index.ts';

export function keySigner(): KeySigner {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
    sign: (text) => Promise.resolve(sign('sha256', Buffer.from(text, 'utf8'), privateKey).toString('base64')),
    verify: (key, text, signature) => {
      try {
        const pub = createPublicKey({ key: Buffer.from(key, 'base64'), format: 'der', type: 'spki' });
        return Promise.resolve(verify('sha256', Buffer.from(text, 'utf8'), pub, Buffer.from(signature, 'base64')));
      } catch {
        return Promise.resolve(false);
      }
    },
  };
}

const ORDER = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;

function derInteger(value: bigint): Buffer {
  const hex = value.toString(16).padStart(2, '0');
  const bytes = Buffer.from(hex.length % 2 === 0 ? hex : `0${hex}`, 'hex');
  const body = (bytes[0]! & 0x80) === 0 ? bytes : Buffer.concat([Buffer.from([0]), bytes]);
  return Buffer.concat([Buffer.from([2, body.length]), body]);
}

/** The same signature with s replaced by n - s, which every ECDSA check accepts. */
export function alteredSignature(signature: string): string {
  const der = Buffer.from(signature, 'base64');
  const r = der.subarray(4, 4 + der[3]!);
  const s = der.subarray(6 + r.length, 6 + r.length + der[5 + r.length]!);
  const body = Buffer.concat([
    derInteger(BigInt(`0x${r.toString('hex')}`)),
    derInteger(ORDER - BigInt(`0x${s.toString('hex')}`)),
  ]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]).toString('base64');
}
