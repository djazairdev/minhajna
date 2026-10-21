// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Signing for tests: a fresh P-256 key made each run and never written
// down, so no private key ever sits in the repository. Node checks the
// signatures with the signing tools' own check, the way Android's
// platform crypto does on the phone, refusing any key that is not on P-256.

import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { SIGNED_FORMAT, type SignedKind, type TrustedKey } from '../src/index.ts';

export { isP256, nodeVerifier } from '../scripts/node-verify.ts';

export interface TestKey {
  readonly trusted: TrustedKey;
  /** Signs a payload as the key's holder would, with the private half kept in memory only. */
  readonly sign: (payload: string) => string;
}

/** A key pair made for one test run, which signs both kinds unless told otherwise. */
export function makeTestKey(id = 'example-ministry', signs: readonly SignedKind[] = ['calendar', 'packs']): TestKey {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return {
    trusted: {
      id,
      holder: { en: 'Example holder' },
      spki: der.toString('base64'),
      fingerprint: createHash('sha256').update(der).digest('hex'),
      signs,
    },
    sign: (payload) => sign('sha256', Buffer.from(payload, 'utf8'), privateKey).toString('base64'),
  };
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
