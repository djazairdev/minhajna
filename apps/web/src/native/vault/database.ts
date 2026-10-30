// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where the PC keeps the history (#250, part 2): one IndexedDB database in
// this browser, with three stores. `meta` holds the sealed key, the count
// of wrong passphrases and the history's sealed end; `entries` the history,
// one sealed row per sequence number; `timings` the pilot's timings, sealed
// too (#220). Each step runs in one transaction and resolves only once it
// is committed to disk; a transaction that fails keeps nothing, so a step
// is all or none, as on the phone. A connection the browser closes, as
// when its data is cleared, is opened again by the next step.

export const STORES = ['meta', 'entries', 'timings'] as const;
export type StoreName = (typeof STORES)[number];

export const NAME = 'minhajna';
const VERSION = 1;

let opening: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store);
        }
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      db.onclose = () => {
        opening = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('The browser did not open its database'));
    request.onblocked = () => reject(new Error('Another tab holds an older database open'));
  });
}

/** The open database, opened once per page. */
export function database(): Promise<IDBDatabase> {
  opening ??= openDatabase().catch((error: unknown) => {
    opening = null;
    throw error;
  });
  return opening;
}

/**
 * Runs `work` in one transaction over `stores`. `work` queues its requests
 * at once, and returns how to read its result, which is read once the
 * transaction is committed. A throw from `work`, or a failed request,
 * aborts the transaction and rejects.
 */
export async function transact<T>(
  stores: readonly StoreName[],
  mode: IDBTransactionMode,
  work: (transaction: IDBTransaction) => () => T,
): Promise<T> {
  return inTransaction(await database(), stores, mode, work);
}

/** As `transact`, in another of the app's databases, such as a demo world's. */
export function inTransaction<T>(
  db: IDBDatabase,
  stores: readonly StoreName[],
  mode: IDBTransactionMode,
  work: (transaction: IDBTransaction) => () => T,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(stores, mode, { durability: 'strict' });
    let result: (() => T) | null = null;
    transaction.oncomplete = () => {
      try {
        if (result === null) throw new Error('The transaction ended before its work was queued');
        resolve(result());
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    transaction.onabort = () => reject(transaction.error ?? new Error('The transaction was aborted'));
    try {
      result = work(transaction);
    } catch (error) {
      transaction.abort();
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/** Closes the page's database, so that the tests can start each one from nothing. */
export async function closeDatabase(): Promise<void> {
  const db = opening;
  opening = null;
  if (db !== null) (await db.catch(() => null))?.close();
}
