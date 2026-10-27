// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The signature module on a PC (#250, part 3, answers 508 and 510): signed
// updates and colleagues' statements are checked with Web Crypto's ECDSA
// P-256, as the phone checks them, and anything malformed is a signature
// that does not check. The PC signs with a pair of its own, sealed in the
// vault under the passphrase (vault/signing.ts), so it signs only while the
// history is open; its public half and fingerprint show, so colleagues see
// it as the teacher's second key. Erasing the PC removes it (part 4). QR
// codes come from the same encoder as the phone's.

import type { QrMatrix, Spec } from '../../../android/src/native/NativeMinhajnaSignature';
import { refused } from './files/picked.ts';
import { boundedBytes, statementRows } from './files/qr.ts';
import { derOf, fromBase64, rawOf, toBase64 } from './signing/der.ts';
import { signingPair } from './vault/signing.ts';

const P256 = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SHA256 = { name: 'ECDSA', hash: 'SHA-256' } as const;

function failed(): Error {
  return refused('E_SIGNING', 'Signing failed');
}

/** A locked history, a full browser or another tab's change keeps its own code; anything else is E_SIGNING. */
function signingError(error: unknown): unknown {
  const code: unknown = error instanceof Error ? Reflect.get(error, 'code') : undefined;
  return code === 'E_LOCKED' || code === 'E_NO_SPACE' || code === 'E_HISTORY' ? error : failed();
}

async function importSpki(spki: string): Promise<{ key: CryptoKey; bytes: Uint8Array<ArrayBuffer> } | null> {
  const bytes = spki.length >= 1 && spki.length <= 200 ? fromBase64(spki) : null;
  if (bytes === null) return null;
  try {
    return { key: await crypto.subtle.importKey('spki', bytes, P256, true, ['verify']), bytes };
  } catch {
    return null;
  }
}

const Signature: Spec = {
  async verify(spki, payload, signature) {
    try {
      const imported = await importSpki(spki);
      const der = fromBase64(signature);
      const raw = der === null ? null : rawOf(der);
      if (imported === null || raw === null || !payload.isWellFormed()) return false;
      return await crypto.subtle.verify(SHA256, imported.key, raw, new TextEncoder().encode(payload));
    } catch {
      return false;
    }
  },
  async teacherKey() {
    try {
      return toBase64((await signingPair()).spki);
    } catch (error) {
      throw signingError(error);
    }
  },
  async sign(payload) {
    try {
      const bytes = boundedBytes(payload, 65_536);
      const raw = await crypto.subtle.sign(SHA256, (await signingPair()).privateKey, bytes);
      return toBase64(derOf(new Uint8Array(raw)));
    } catch (error) {
      throw signingError(error);
    }
  },
  async keyFingerprint(spki) {
    const imported = await importSpki(spki);
    if (imported === null) throw failed();
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', imported.bytes));
    return Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
  },
  qrMatrix(text): Promise<QrMatrix> {
    try {
      const rows = statementRows(text);
      return Promise.resolve({ size: rows.length, rows });
    } catch {
      return Promise.reject(refused('E_QR', 'QR encoding failed'));
    }
  },
};

export default Signature;
