// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Test-only Web Crypto envelope, not a production archive or key design.
// Keys/passphrases are never stored; only salt, IVs and ciphertext persist.

import { toHex, type Entry, type HistoryDeps } from '../../core/src/index.ts';

/** Fixed diagnostic parameters; performance results identify this workload. */
export const ITERATIONS = 600_000;

/** The only per-entry data stored in IndexedDB, apart from run metadata. */
export interface SealedEntry {
  readonly seq: number;
  readonly iv: Uint8Array<ArrayBuffer>;
  readonly ciphertext: ArrayBuffer;
}

/** Uses the browser's cryptography for the synthetic core history too. */
export const historyDeps: HistoryDeps = {
  digest: async (text) => toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))),
  random: (length) => crypto.getRandomValues(new Uint8Array(length)),
};

/** A disposable test passphrase; never use a teacher's real credentials here. */
export async function testKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  if (passphrase.length < 12) throw new RangeError('test-passphrase');
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function envelope(runId: string, seq: number, iv: Uint8Array<ArrayBuffer>): AesGcmParams {
  return {
    name: 'AES-GCM',
    iv,
    tagLength: 128,
    additionalData: new TextEncoder().encode(`demo-check/1/${runId}/${seq}`),
  };
}

/** Each entry gets a fresh 96-bit IV under a fresh per-run salted key. */
export async function seal(entries: readonly Entry[], key: CryptoKey, runId: string): Promise<SealedEntry[]> {
  const rows: SealedEntry[] = [];
  for (const entry of entries) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(entry));
    rows.push({
      seq: entry.seq,
      iv,
      ciphertext: await crypto.subtle.encrypt(envelope(runId, entry.seq, iv), key, plaintext),
    });
  }
  return rows;
}

/** Authentication rejects a wrong key, changed body, row order or another run. */
export async function unseal(rows: readonly SealedEntry[], key: CryptoKey, runId: string): Promise<Entry[]> {
  const entries: Entry[] = [];
  for (const [index, row] of rows.entries()) {
    if (row.seq !== index) throw new Error('row-order');
    const bytes = await crypto.subtle.decrypt(envelope(runId, row.seq, row.iv), key, row.ciphertext);
    const entry = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as Entry;
    if (entry.seq !== row.seq) throw new Error('entry-order');
    entries.push(entry);
  }
  return entries;
}
