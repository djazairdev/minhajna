// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the demo world tests read and write on the made-up IndexedDB as
// another tab would, straight to a database: its rows, a row put or
// deleted, the databases the browser keeps, and whether a sealed row holds
// a mark in the clear. Every value is made up.

/** A connection to the database, opened as another tab would, which ignores a request to close. */
export function opened(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(name);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('open'));
  });
}

export async function raw(name: string, store: string): Promise<Map<IDBValidKey, unknown>> {
  const db = await opened(name);
  return new Promise((resolve) => {
    const transaction = db.transaction(store, 'readonly');
    const keys = transaction.objectStore(store).getAllKeys();
    const values = transaction.objectStore(store).getAll();
    transaction.oncomplete = () => {
      db.close();
      resolve(new Map(keys.result.map((key, at) => [key, values.result[at]])));
    };
  });
}

export async function put(name: string, store: string, key: IDBValidKey, value: unknown): Promise<void> {
  const db = await opened(name);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readwrite');
    if (value === undefined) transaction.objectStore(store).delete(key);
    else transaction.objectStore(store).put(value, key);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onabort = () => reject(transaction.error ?? new Error('abort'));
  });
}

export async function databases(): Promise<string[]> {
  return (await indexedDB.databases()).map(({ name }) => name ?? '').sort();
}

/** Whether any sealed row holds the mark in the clear. */
export function readable(values: Iterable<unknown>, mark: string): boolean {
  return [...values].some((value) => Buffer.from((value as { data: ArrayBuffer }).data).includes(mark));
}
