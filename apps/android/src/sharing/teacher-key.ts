// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import signature from '../native/NativeMinhajnaSignature';

/**
 * A 128-bit display abbreviation of SHA-256 over decoded SPKI, as for the
 * reference-data keys (#437). It is not an identity or trust decision:
 * verification and key continuity must use the complete public key.
 */
export async function teacherKeyFingerprint(spki: string): Promise<string> {
  const hash = await signature.keyFingerprint(spki);
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('Invalid public-key fingerprint');
  return hash.slice(0, 32);
}
