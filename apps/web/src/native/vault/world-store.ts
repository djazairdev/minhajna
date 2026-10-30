// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A demo world's own history on a PC (#558, part 2, choice D4 of the 0.7.0
// demo, answer 569). Each world keeps its records in its own IndexedDB
// database, named after the world, apart from the teacher's, with its own
// key: an AES-GCM key the browser makes and keeps in that database as one
// the page cannot read back, the stand-in for the phone's Keystore key. A
// copy of the browser's files opens it, which a world's made-up records
// allow; no passphrase guards a world. Entries and the history's end are
// sealed as the teacher's are (history.ts), each row bound to its place.
// Erasing content seals every row again under a new key, kept in the same
// transaction. A write checks in its own transaction that the key and the
// end are still the ones it read, so another tab's write in between fails
// it. One world is open at a time in a tab, and its database closes when
// another tab deletes it. The settings list each world before it is opened,
// so erasing the PC finds them in a browser that cannot list its databases;
// such a browser that cannot keep the list enters no world. Errors carry
// the phone's codes: E_KEY_LOST for a world kept without its key, E_WORLD
// for anything else.

import { inTransaction } from './database.ts';
import { HEAD, coded } from './lock.ts';
import { opened as unsealed, parseJson, parseRow, place, readHead, sealHead } from './history.ts';
import { seal } from './seal.ts';
import { readSetting, writeSetting } from '../web-settings.ts';
import { rowStamp } from './stamp.ts';

const PREFIX = 'minhajna-world-';
const VERSION = 1;
const STORES = ['meta', 'entries'] as const;
/** Where `meta` keeps the world's key, with a stamp that changes with it. */
const KEY = 'key';
const WORLDS = 'worlds';
const WORLD_ID = /^[0-9A-HJKMNP-TV-Z]{5}$/u;

interface WorldKey {
  readonly key: CryptoKey;
  readonly stamp: string;
}

let open: { readonly world: string; readonly db: IDBDatabase } | null = null;

/** The database a world keeps its records in. */
export function worldDatabase(world: string): string {
  return `${PREFIX}${world}`;
}

/** Whether a database of this browser is a world's. */
export function isWorldDatabase(name: string): boolean {
  return name.startsWith(PREFIX);
}

/** The worlds this browser keeps, as the settings list them for a browser that cannot list its databases. */
export function keptWorlds(): string[] {
  return (readSetting(WORLDS) ?? '').split(' ').filter((world) => WORLD_ID.test(world));
}

/** Adds the world to the settings' list, or takes it off; false when the browser refused the write. */
function listWorld(world: string, kept: boolean): boolean {
  const others = keptWorlds().filter((one) => one !== world);
  return writeSetting(WORLDS, (kept ? [...others, world] : others).join(' '));
}

/** The world open in this tab, if any. */
export function storeWorld(): string | null {
  return open?.world ?? null;
}

function failed(message: string): Error {
  return coded(message, 'E_WORLD');
}

function connect(world: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(worldDatabase(world), VERSION);
    request.onupgradeneeded = () => {
      for (const store of STORES) {
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
      }
    };
    let refused = false;
    request.onsuccess = () => {
      const db = request.result;
      if (refused) {
        db.close();
        return;
      }
      const forget = () => {
        db.close();
        if (open?.db === db) open = null;
      };
      db.onversionchange = forget;
      db.onclose = forget;
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? failed('The browser did not open the world'));
    request.onblocked = () => {
      refused = true;
      reject(failed('Another tab holds an older world open'));
    };
  });
}

async function newKey(): Promise<WorldKey> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const stamp = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0'));
  return { key, stamp: stamp.join('') };
}

function worldKey(value: unknown): WorldKey {
  const { key, stamp } = (typeof value === 'object' && value !== null ? value : {}) as Partial<WorldKey>;
  if (!(key instanceof CryptoKey) || typeof stamp !== 'string') {
    throw coded('The world is kept, but its key is gone', 'E_KEY_LOST');
  }
  return { key, stamp };
}

/** Opens a world's history, making it and its key on first use; another open world refuses it. */
export async function openWorldStore(world: string): Promise<void> {
  if (open?.world === world) return;
  if (open !== null) throw failed('Another world is open');
  if (!listWorld(world, true) && typeof indexedDB.databases !== 'function') {
    throw failed('This browser can keep no list of its worlds for erasing the PC');
  }
  const db = await connect(world);
  try {
    const made = await newKey();
    const kept = await inTransaction(db, STORES, 'readwrite', (transaction) => {
      const meta = transaction.objectStore('meta');
      const key = meta.get(KEY);
      const count = transaction.objectStore('entries').count();
      count.onsuccess = () => {
        if (key.result === undefined && count.result === 0) meta.add(made, KEY);
      };
      return () => ({ key: key.result as unknown, count: count.result });
    });
    worldKey(kept.key === undefined && kept.count === 0 ? made : kept.key);
    open = { world, db };
  } catch (error) {
    db.close();
    throw error;
  }
}

/** Closes the open world's history, if any. */
export function closeWorldStore(): void {
  open?.db.close();
  open = null;
}

function openedDb(): IDBDatabase {
  if (open === null) throw failed('No world is open');
  return open.db;
}

/** Every entry, checked against the sealed end, with the key and the end as read. */
async function readAll(db: IDBDatabase) {
  const read = await inTransaction(db, STORES, 'readonly', (transaction) => {
    const store = transaction.objectStore('entries');
    const keys = store.getAllKeys();
    const values = store.getAll();
    const meta = transaction.objectStore('meta');
    const key = meta.get(KEY);
    const head = meta.get(HEAD);
    const result = (request: IDBRequest) => request.result as unknown;
    return () => ({ keys: keys.result, values: values.result as unknown[], key: result(key), head: result(head) });
  });
  const key = worldKey(read.key);
  const rows = await Promise.all(
    read.keys.map(async (seq, index) => {
      if (typeof seq !== 'number') throw failed('An entry is kept under no sequence number');
      const row = parseRow(parseJson(await unsealed(key.key, read.values[index], place(seq))));
      if (row.seq !== seq) throw failed('An entry is out of place');
      return row;
    }),
  );
  const head = await readHead(key.key, read.head);
  if (head.count !== rows.length || head.last !== (rows.at(-1)?.seq ?? -1)) {
    throw failed('The world does not end where it was left');
  }
  return { rows, key, head: rowStamp(read.head) };
}

/**
 * Runs `work` in one write transaction, once it finds the key, the end and
 * the count of entries as read; otherwise keeps nothing and rejects.
 */
async function write(
  db: IDBDatabase,
  read: { key: string; head: string; count: number },
  work: (t: IDBTransaction) => void,
) {
  let moved = false;
  await inTransaction(db, STORES, 'readwrite', (transaction) => {
    const meta = transaction.objectStore('meta');
    const key = meta.get(KEY);
    const head = meta.get(HEAD);
    const count = transaction.objectStore('entries').count();
    count.onsuccess = () => {
      const kept = key.result as Partial<WorldKey> | undefined;
      if (kept?.stamp !== read.key || rowStamp(head.result) !== read.head || count.result !== read.count) {
        moved = true;
        transaction.abort();
        return;
      }
      work(transaction);
    };
    return () => undefined;
  }).catch((error: unknown) => {
    throw moved ? failed('The world changed in another tab') : error;
  });
}

/** Every entry of the open world, by sequence, as a JSON array. */
export async function loadWorld(): Promise<string> {
  return JSON.stringify((await readAll(openedDb())).rows);
}

/** Adds one entry, given as JSON, after the last. */
export async function appendToWorld(entry: string): Promise<void> {
  const db = openedDb();
  const row = parseRow(parseJson(entry));
  const read = await inTransaction(db, ['meta'], 'readonly', (transaction) => {
    const key = transaction.objectStore('meta').get(KEY);
    const head = transaction.objectStore('meta').get(HEAD);
    return () => ({ key: key.result as unknown, head: head.result as unknown });
  });
  const key = worldKey(read.key);
  const { count, last } = await readHead(key.key, read.head);
  if (row.seq <= last) throw failed('An entry is already kept at this sequence number');
  if (row.seq !== last + 1) throw failed('The entry does not follow the last one');
  const sealed = await seal(key.key, JSON.stringify(row), place(row.seq));
  const head = await sealHead(key.key, { count: count + 1, last: row.seq });
  await write(db, { key: key.stamp, head: rowStamp(read.head), count }, (transaction) => {
    transaction.objectStore('entries').add(sealed, row.seq);
    transaction.objectStore('meta').put(head, HEAD);
  });
}

/** Removes the content and salt of the given entries, sealing every row again under a new key, all at once. */
export async function eraseWorldContent(ids: readonly string[]): Promise<void> {
  const db = openedDb();
  const wanted = new Set(ids);
  const { rows, key, head } = await readAll(db);
  if (!rows.some((row) => wanted.has(row.id))) return;
  const next = await newKey();
  const resealed = await Promise.all(
    rows.map(async (row) => {
      const kept = wanted.has(row.id) ? { ...row, salt: null, body: null } : row;
      return { seq: row.seq, sealed: await seal(next.key, JSON.stringify(kept), place(row.seq)) };
    }),
  );
  const end = await sealHead(next.key, { count: rows.length, last: rows.at(-1)?.seq ?? -1 });
  await write(db, { key: key.stamp, head, count: rows.length }, (transaction) => {
    const store = transaction.objectStore('entries');
    for (const { seq, sealed } of resealed) store.put(sealed, seq);
    transaction.objectStore('meta').put(next, KEY);
    transaction.objectStore('meta').put(end, HEAD);
  });
}

/** Deletes a world's database, key and all, closing it first if it is open here; other tabs close theirs. */
export function eraseWorldStore(world: string): Promise<void> {
  if (open?.world === world) closeWorldStore();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(worldDatabase(world));
    request.onsuccess = () => {
      listWorld(world, false);
      resolve();
    };
    request.onerror = () => reject(request.error ?? failed('The browser did not delete the world'));
  });
}
