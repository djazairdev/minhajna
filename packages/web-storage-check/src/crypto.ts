// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Test-only Web Crypto envelope, not a production archive or key design.
// Keys/passphrases are never stored; only salt, IVs and ciphertext persist.

import { toHex, type Entry, type HistoryDeps } from '../../core/src/index.ts';

/** Fixed diagnostic parameters; performance results identify this workload. */
export const ITERATIONS = 600_000;

/** What every row is bound to: its run, its workload and how many rows the run has. */
export interface RunBinding {
  readonly runId: string;
  readonly level: string;
  readonly count: number;
}

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

/** Binding the row count stops a truncated run, with its count lowered to match, from verifying. */
function envelope(run: RunBinding, seq: number, iv: Uint8Array<ArrayBuffer>): AesGcmParams {
  return {
    name: 'AES-GCM',
    iv,
    tagLength: 128,
    additionalData: new TextEncoder().encode(`demo-check/2/${run.runId}/${run.level}/${run.count}/${seq}`),
  };
}

/** Each entry gets a fresh 96-bit IV under a fresh per-run salted key. */
export async function seal(entries: readonly Entry[], key: CryptoKey, run: RunBinding): Promise<SealedEntry[]> {
  if (run.count !== entries.length) throw new Error('count');
  const rows: SealedEntry[] = [];
  for (const entry of entries) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(entry));
    rows.push({
      seq: entry.seq,
      iv,
      ciphertext: await crypto.subtle.encrypt(envelope(run, entry.seq, iv), key, plaintext),
    });
  }
  return rows;
}

/** Authentication rejects a wrong key, changed body, row order, another run or another row count. */
export async function unseal(rows: readonly SealedEntry[], key: CryptoKey, run: RunBinding): Promise<Entry[]> {
  if (rows.length !== run.count) throw new Error('count');
  const entries: Entry[] = [];
  for (const [index, row] of rows.entries()) {
    if (row.seq !== index) throw new Error('row-order');
    const bytes = await crypto.subtle.decrypt(envelope(run, row.seq, row.iv), key, row.ciphertext);
    const entry = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as Entry;
    if (entry.seq !== row.seq) throw new Error('entry-order');
    entries.push(entry);
  }
  return entries;
}
