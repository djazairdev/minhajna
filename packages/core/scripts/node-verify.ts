// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Node's check of a signed file, shared by the signing tools and the tests:
// it checks a signature as Android's platform crypto does on the phone, and
// refuses any key that is not on P-256, the only curve the phone checks.

import { createPublicKey, verify, type KeyObject } from 'node:crypto';
import type { Verifier } from '../src/index.ts';

/** Whether a key is an EC key on P-256, the only kind the phone checks with. */
export function isP256(key: KeyObject): boolean {
  return key.asymmetricKeyType === 'ec' && key.asymmetricKeyDetails?.namedCurve === 'prime256v1';
}

/** Checks a signature with Node's crypto, as the app's native module does with Android's. */
export const nodeVerifier: Verifier = (spki, payload, signature) => {
  const key = createPublicKey({ key: Buffer.from(spki, 'base64'), format: 'der', type: 'spki' });
  if (!isP256(key)) return Promise.resolve(false);
  return Promise.resolve(verify('sha256', Buffer.from(payload, 'utf8'), key, Buffer.from(signature, 'base64')));
};
