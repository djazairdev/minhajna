// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up devices' signing keys for the tests of certificates and of what
// they sign (#554, #555): Node's Ed25519, as a platform's would be, over a
// text's UTF-8 bytes, with keys and signatures in hex.

import { createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import type { KeySigner } from '../src/index.ts';

export function keySigner(): KeySigner {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const raw = Buffer.from(publicKey.export({ format: 'jwk' }).x!, 'base64url').toString('hex');
  return {
    publicKey: raw,
    sign: (text) => Promise.resolve(sign(null, Buffer.from(text, 'utf8'), privateKey).toString('hex')),
    verify: (key, text, signature) => {
      try {
        const jwk = { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(key, 'hex').toString('base64url') };
        const pub = createPublicKey({ key: jwk, format: 'jwk' });
        return Promise.resolve(verify(null, Buffer.from(text, 'utf8'), pub, Buffer.from(signature, 'hex')));
      } catch {
        return Promise.resolve(false);
      }
    },
  };
}
