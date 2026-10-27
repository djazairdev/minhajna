// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC's history and the pilot's timings (#250, part 2). Each entry is
// sealed with the history's key and kept by its sequence number, and the
// count and last sequence number are sealed beside them, so a row changed,
// moved or dropped from the end refuses to open. The timings are one sealed
// row. Erasing content seals everything again under a new key, the PC's
// signing pair included (answer 510); the browser may keep the old rows and
// the old sealed key in its files until it compacts them. A write checks,
// in its own transaction, that the sealed key is still the one this page
// opened, and the end, the timings and the signing pair still the ones it
// read, so another tab's write in between fails it rather than mixing two
// keys or losing a write. These steps need the history open, and reject
// with E_LOCKED otherwise.

import { transact } from './database.ts';
import { HEAD, KEY, SIGNING, coded, newSealedKey, noSpace, openedKey, openedStamp, takeKey } from './lock.ts';
import { isSealed, seal, unseal, type Sealed } from './seal.ts';
import { readSigning, resealSigning } from './signing.ts';
import { ALL, MOVED, TIMINGS, checked, rowStamp, stamp, type Stamp } from './stamp.ts';

/** An entry row as the app gives it: a sequence number and an id, and the rest kept as given. */
type Row = { readonly seq: number; readonly id: string } & Readonly<Record<string, unknown>>;

/** How many entries there are, and the last one's sequence number, or -1. */
interface Head {
  readonly count: number;
  readonly last: number;
}

function place(seq: number): string {
  return `entry:${seq}`;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw coded('Not JSON', 'E_HISTORY');
  }
}

function parseRow(value: unknown): Row {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw coded('An entry is not an object', 'E_HISTORY');
  }
  const { seq, id } = value as { seq?: unknown; id?: unknown };
  if (typeof seq !== 'number' || !Number.isSafeInteger(seq) || seq < 0 || typeof id !== 'string') {
    throw coded('An entry has no sequence number or id', 'E_HISTORY');
  }
  return value as Row;
}

async function opened(key: CryptoKey, value: unknown, where: string): Promise<string> {
  if (!isSealed(value)) throw coded('A row cannot be read', 'E_HISTORY');
  try {
    return await unseal(key, value, where);
  } catch {
    throw coded('A row was changed or moved', 'E_HISTORY');
  }
}

async function readHead(key: CryptoKey, value: unknown): Promise<Head> {
  if (value === undefined) return { count: 0, last: -1 };
  const { count, last } = parseJson(await opened(key, value, HEAD)) as Partial<Head>;
  if (!Number.isSafeInteger(count) || !Number.isSafeInteger(last)) throw coded('The end is unreadable', 'E_HISTORY');
  return { count: count ?? 0, last: last ?? -1 };
}

function sealHead(key: CryptoKey, head: Head): Promise<Sealed> {
  return seal(key, JSON.stringify(head), HEAD);
}

async function readTimings(key: CryptoKey, value: unknown): Promise<unknown[]> {
  if (value === undefined) return [];
  const list = parseJson(await opened(key, value, TIMINGS));
  if (!Array.isArray(list)) throw coded('Timings that are not a list', 'E_HISTORY');
  return list as unknown[];
}

/** Every entry and the timings, checked against the sealed end, with what a write must find unchanged. */
async function readAll(key: CryptoKey): Promise<{ rows: Row[]; timings: unknown[] | null; read: Stamp }> {
  const read = await transact(['entries', 'meta', 'timings'], 'readonly', (transaction) => {
    const store = transaction.objectStore('entries');
    const keys = store.getAllKeys();
    const values = store.getAll();
    const head = transaction.objectStore('meta').get(HEAD);
    const timings = transaction.objectStore(TIMINGS).get(ALL);
    return () => ({
      keys: keys.result,
      values: values.result as unknown[],
      head: head.result as unknown,
      timings: timings.result as unknown,
    });
  });
  const rows = await Promise.all(
    read.keys.map(async (seq, index) => {
      if (typeof seq !== 'number') throw coded('An entry is kept under no sequence number', 'E_HISTORY');
      const row = parseRow(parseJson(await opened(key, read.values[index], place(seq))));
      if (row.seq !== seq) throw coded('An entry is out of place', 'E_HISTORY');
      return row;
    }),
  );
  const head = await readHead(key, read.head);
  if (head.count !== rows.length || head.last !== (rows.at(-1)?.seq ?? -1)) {
    throw coded('The history does not end where it was left', 'E_HISTORY');
  }
  const timings = read.timings === undefined ? null : await readTimings(key, read.timings);
  return { rows, timings, read: stamp(read.head, read.timings) };
}

function write(stores: readonly ('entries' | 'meta' | 'timings')[], work: (transaction: IDBTransaction) => void) {
  return transact(stores, 'readwrite', (transaction) => {
    work(transaction);
    return () => undefined;
  }).catch((error: unknown) => {
    throw noSpace(error);
  });
}

/** Every entry, by sequence, as a JSON array. */
export async function loadHistory(): Promise<string> {
  return JSON.stringify((await readAll(openedKey())).rows);
}

/** Adds entries after the last, all or none; one already kept at its sequence number refuses them. */
async function appendRows(rows: readonly Row[]): Promise<void> {
  const key = openedKey();
  const first = rows[0];
  if (first === undefined) return;
  if (rows.some((row, index) => row.seq !== first.seq + index)) throw coded('The entries do not follow', 'E_HISTORY');
  const kept = await transact(['meta'], 'readonly', (transaction) => {
    const head = transaction.objectStore('meta').get(HEAD);
    return () => ({ head: head.result as unknown });
  });
  const { count, last } = await readHead(key, kept.head);
  if (first.seq <= last) throw coded('An entry is already kept at this sequence number', 'E_HISTORY');
  if (first.seq !== last + 1) throw coded('The entries do not follow the last one', 'E_HISTORY');
  const sealed = await Promise.all(
    rows.map(async (row) => ({ seq: row.seq, sealed: await seal(key, JSON.stringify(row), place(row.seq)) })),
  );
  const head = await sealHead(key, { count: count + rows.length, last: first.seq + rows.length - 1 });
  let moved = false;
  await write(['entries', 'meta'], (transaction) =>
    checked(
      transaction,
      stamp(kept.head, null),
      null,
      () => {
        const store = transaction.objectStore('entries');
        for (const row of sealed) store.add(row.sealed, row.seq);
        transaction.objectStore('meta').put(head, HEAD);
      },
      () => (moved = true),
    ),
  ).catch((error: unknown) => {
    throw moved ? coded(MOVED, 'E_HISTORY') : error;
  });
}

/** Adds one entry, given as JSON, after the last. */
export async function appendEntry(entry: string): Promise<void> {
  await appendRows([parseRow(parseJson(entry))]);
}

/** Adds entries, given as a JSON array, after the last, all or none: a copy taken back (#250). */
export async function appendEntries(entries: string): Promise<void> {
  const list = parseJson(entries);
  if (!Array.isArray(list)) throw coded('The entries are not a list', 'E_HISTORY');
  await appendRows(list.map(parseRow));
}

/** Removes the content and salt of the given entries, and seals everything again under a new key, all at once. */
export async function eraseContent(ids: readonly string[]): Promise<void> {
  const wanted = new Set(ids);
  const { rows, timings, read } = await readAll(openedKey());
  if (!rows.some((row) => wanted.has(row.id))) return;
  const next = await newSealedKey();
  const resealed = await Promise.all(
    rows.map(async (row) => {
      const kept = wanted.has(row.id) ? { ...row, salt: null, body: null } : row;
      return { seq: row.seq, sealed: await seal(next.key, JSON.stringify(kept), place(row.seq)) };
    }),
  );
  const head = await sealHead(next.key, { count: rows.length, last: rows.at(-1)?.seq ?? -1 });
  const timed = timings === null ? null : await seal(next.key, JSON.stringify(timings), TIMINGS);
  const signing = await readSigning();
  const signed = await resealSigning(openedKey(), next.key, signing);
  let moved = false;
  await write(['entries', 'meta', 'timings'], (transaction) => {
    const keptSigning = transaction.objectStore('meta').get(SIGNING);
    checked(
      transaction,
      read,
      rows.length,
      () => {
        if (rowStamp(keptSigning.result) !== rowStamp(signing)) {
          moved = true;
          transaction.abort();
          return;
        }
        const store = transaction.objectStore('entries');
        for (const { seq, sealed } of resealed) store.put(sealed, seq);
        transaction.objectStore('meta').put(next.sealed, KEY);
        transaction.objectStore('meta').put(head, HEAD);
        if (timed !== null) transaction.objectStore(TIMINGS).put(timed, ALL);
        if (signed !== null) transaction.objectStore('meta').put(signed, SIGNING);
        else if (signing !== undefined) transaction.objectStore('meta').delete(SIGNING);
      },
      () => (moved = true),
    );
  }).catch((error: unknown) => {
    throw moved ? coded(MOVED, 'E_HISTORY') : error;
  });
  takeKey(next.key, next.sealed);
}

/** Stores a restored history, a JSON array of entries, into this empty one, all or none (#247). */
export async function restoreHistory(entries: string): Promise<void> {
  const key = openedKey();
  const list = parseJson(entries);
  if (!Array.isArray(list)) throw coded('The entries are not a list', 'E_HISTORY');
  const rows = list.map(parseRow).sort((a, b) => a.seq - b.seq);
  const sealed = await Promise.all(
    rows.map(async (row) => ({ seq: row.seq, sealed: await seal(key, JSON.stringify(row), place(row.seq)) })),
  );
  const head = await sealHead(key, { count: rows.length, last: rows.at(-1)?.seq ?? -1 });
  let kept = false;
  await write(['entries', 'meta'], (transaction) =>
    checked(
      transaction,
      stamp(undefined, null),
      0,
      () => {
        const store = transaction.objectStore('entries');
        for (const row of sealed) store.add(row.sealed, row.seq);
        transaction.objectStore('meta').put(head, HEAD);
      },
      () => (kept = true),
    ),
  ).catch((error: unknown) => {
    throw kept ? coded('The history is not empty, or changed in another tab', 'E_HISTORY') : error;
  });
}

async function keptTimings(key: CryptoKey): Promise<{ list: unknown[]; row: unknown }> {
  const row = await transact([TIMINGS], 'readonly', (transaction) => {
    const kept = transaction.objectStore(TIMINGS).get(ALL);
    return () => kept.result as unknown;
  });
  return { list: await readTimings(key, row), row };
}

/** The pilot's timings, as one JSON array. */
export async function loadTimings(): Promise<string> {
  return JSON.stringify((await keptTimings(openedKey())).list);
}

/** Adds timings, given as a JSON array, all or none. */
export async function addTimings(timings: string): Promise<void> {
  const key = openedKey();
  const added = parseJson(timings);
  if (!Array.isArray(added)) throw coded('The timings are not a list', 'E_HISTORY');
  const { list, row } = await keptTimings(key);
  const sealed = await seal(key, JSON.stringify([...list, ...(added as unknown[])]), TIMINGS);
  let moved = false;
  await write([TIMINGS, 'meta', 'entries'], (transaction) =>
    checked(
      transaction,
      { key: openedStamp(), head: null, timings: rowStamp(row) },
      null,
      () => transaction.objectStore(TIMINGS).put(sealed, ALL),
      () => (moved = true),
    ),
  ).catch((error: unknown) => {
    throw moved ? coded(MOVED, 'E_HISTORY') : error;
  });
}

/** Deletes every timing. */
export async function clearTimings(): Promise<void> {
  await write([TIMINGS], (transaction) => transaction.objectStore(TIMINGS).clear());
}
