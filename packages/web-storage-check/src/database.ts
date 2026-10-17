// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One dedicated synthetic database. No teacher database is ever opened.

import type { DemoLevel } from '../../core/test/demo-year.ts';
import { ITERATIONS, type SealedEntry } from './crypto.ts';

/** Constant scope for every read, replacement and deletion in this diagnostic. */
export const DATABASE = 'minhajna-synthetic-storage-check-v1';

/** Non-secret test parameters; no passphrase, key, pupil or clock time. */
export interface RunMeta {
  readonly format: 1;
  readonly runId: string;
  readonly level: DemoLevel;
  readonly count: number;
  readonly plainBytes: number;
  readonly salt: Uint8Array<ArrayBuffer>;
  readonly iterations: number;
}

/** A single-transaction snapshot prevents mixing records from different runs. */
export interface Snapshot {
  readonly meta: RunMeta;
  readonly rows: SealedEntry[];
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let abandoned = false;
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('entries', { keyPath: 'seq' });
      request.result.createObjectStore('meta');
    };
    request.onblocked = () => {
      abandoned = true;
      reject(new Error('blocked'));
    };
    request.onerror = () => reject(new Error(request.error?.name ?? 'database'));
    request.onsuccess = () => {
      if (abandoned) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

/** A request's success is not a commit: resolve only on transaction completion. */
export function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(new Error(transaction.error?.name ?? 'transaction-aborted'));
    transaction.onerror = () => reject(new Error(transaction.error?.name ?? 'transaction-error'));
  });
}

/** A synchronous cloning/queue error must abort too, leaving the old run intact. */
export async function writeTransaction(tx: IDBTransaction, snapshot: Snapshot): Promise<void> {
  const done = completed(tx);
  try {
    const entries = tx.objectStore('entries');
    entries.clear();
    for (const row of snapshot.rows) entries.put(row);
    tx.objectStore('meta').put(snapshot.meta, 'run');
  } catch (error) {
    tx.abort();
    await done.catch(() => undefined);
    throw error;
  }
  await done;
}

/** Encryption finishes before starting this transaction, avoiding auto-close. */
export async function replace(snapshot: Snapshot): Promise<void> {
  const db = await open();
  try {
    const tx = db.transaction(['entries', 'meta'], 'readwrite');
    await writeTransaction(tx, snapshot);
  } finally {
    db.close();
  }
}

/** Read through a new connection, never the writer's in-memory cache. */
export async function read(): Promise<Snapshot | null> {
  const db = await open();
  try {
    const tx = db.transaction(['entries', 'meta'], 'readonly');
    const done = completed(tx);
    const meta = tx.objectStore('meta').get('run');
    const rows = tx.objectStore('entries').getAll();
    await done;
    const value: unknown = meta.result;
    if (value === undefined) return null;
    if (typeof value !== 'object' || value === null || !('format' in value) || value.format !== 1)
      throw new Error('metadata');
    const run = value as RunMeta;
    if (
      !['cem', 'primary'].includes(run.level) ||
      run.iterations !== ITERATIONS ||
      !(run.salt instanceof Uint8Array) ||
      run.salt.length !== 16 ||
      typeof run.runId !== 'string' ||
      !/^[0-9a-f]{32}$/.test(run.runId) ||
      !Number.isSafeInteger(run.count) ||
      run.count < 1 ||
      run.count > 2000 ||
      !Number.isSafeInteger(run.plainBytes) ||
      run.plainBytes < 1
    )
      throw new Error('metadata');
    const saved = rows.result as SealedEntry[];
    if (saved.length !== run.count) throw new Error('count');
    return { meta: run, rows: saved };
  } finally {
    db.close();
  }
}

/** Deletes only this diagnostic's database; close other diagnostic tabs if blocked. */
export function clear(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('delete-failed'));
    request.onblocked = () => reject(new Error('blocked'));
  });
}
