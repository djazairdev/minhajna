// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Signing for tests: a fresh P-256 key made each run and never written
// down, so no private key ever sits in the repository. Node checks the
// signatures the way Android's platform crypto does on the phone, refusing
// any key that is not on P-256.

import { createHash, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto';
import { SIGNED_FORMAT, type TrustedKey, type Verifier } from '../src/index.ts';

export interface TestKey {
  readonly trusted: TrustedKey;
  /** Signs a payload as the key's holder would, with the private half kept in memory only. */
  readonly sign: (payload: string) => string;
}

/** A key pair made for one test run. */
export function makeTestKey(id = 'example-ministry'): TestKey {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return {
    trusted: {
      id,
      holder: { en: 'Example holder' },
      spki: der.toString('base64'),
      fingerprint: createHash('sha256').update(der).digest('hex'),
    },
    sign: (payload) => sign('sha256', Buffer.from(payload, 'utf8'), privateKey).toString('base64'),
  };
}

/** Checks a signature with Node's crypto, as the app's native module does with Android's. */
export const nodeVerifier: Verifier = (spki, payload, signature) => {
  const key = createPublicKey({ key: Buffer.from(spki, 'base64'), format: 'der', type: 'spki' });
  if (!isP256(key)) return Promise.resolve(false);
  return Promise.resolve(verify('sha256', Buffer.from(payload, 'utf8'), key, Buffer.from(signature, 'base64')));
};

/** Whether a key is an EC key on P-256, the only kind the phone checks with. */
export function isP256(key: KeyObject): boolean {
  return key.asymmetricKeyType === 'ec' && key.asymmetricKeyDetails?.namedCurve === 'prime256v1';
}

/** A signed file holding `payload`, as the founder's signing tool writes it. */
export function signedFile(key: TestKey, payload: unknown, minor = 0): string {
  const text = JSON.stringify(payload);
  return JSON.stringify({
    format: SIGNED_FORMAT,
    version: { major: 1, minor },
    key: key.trusted.id,
    payload: text,
    signature: key.sign(text),
  });
}
