// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LAYERS, RecordBook, isDay, type Entry, type HistoryDeps, type HistoryStore, type Layer } from '@minhajna/core';
import type { Spec } from '../native/NativeMinhajnaStorage';

// The core keeps the history; the app gives it storage, SHA-256 and random
// bytes (#19). All three come from the app's native module, which uses
// SQLCipher and the platform's own primitives (#75).

/** An entry as the native module stores it: the content's JSON as text, or null once erased. */
interface EntryRow {
  readonly seq: number;
  readonly id: string;
  readonly day: string;
  readonly layer: string;
  readonly kind: string;
  readonly digest: string;
  readonly previous: string;
  readonly hash: string;
  readonly salt: string | null;
  readonly body: string | null;
}

export function toRow(entry: Entry): EntryRow {
  const { seq, id, day, layer, kind, digest, previous, hash, content } = entry;
  return {
    seq,
    id,
    day,
    layer,
    kind,
    digest,
    previous,
    hash,
    salt: content === null ? null : content.salt,
    body: content === null ? null : JSON.stringify(content.body),
  };
}

export function fromRow(row: EntryRow): Entry {
  if (!isDay(row.day)) throw new RangeError(`Entry ${row.seq} has no valid day`);
  if (!(LAYERS as readonly string[]).includes(row.layer)) throw new RangeError(`Entry ${row.seq} has no valid layer`);
  const { seq, id, kind, digest, previous, hash } = row;
  return {
    seq,
    id,
    day: row.day,
    layer: row.layer as Layer,
    kind,
    digest,
    previous,
    hash,
    content: row.salt === null || row.body === null ? null : { salt: row.salt, body: JSON.parse(row.body) as unknown },
  };
}

export function fromHex(text: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})*$/.test(text)) throw new RangeError('Not lowercase hex');
  const bytes = new Uint8Array(text.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** The calls the history needs, without the lock's: the debug checks send them to throwaway histories. */
export type HistorySpec = Pick<
  Spec,
  'randomBytes' | 'digest' | 'openHistory' | 'loadHistory' | 'appendEntry' | 'eraseContent'
>;

export function nativeDeps(native: Pick<HistorySpec, 'digest' | 'randomBytes'>): HistoryDeps {
  return {
    digest: async (text) => {
      const [hash] = await native.digest([text]);
      if (hash === undefined) throw new Error('SHA-256 returned nothing');
      return hash;
    },
    random: (length) => fromHex(native.randomBytes(length)),
  };
}

export function nativeStore(native: HistorySpec): HistoryStore {
  return {
    load: async () => (JSON.parse(await native.loadHistory()) as EntryRow[]).map(fromRow),
    append: (entry) => native.appendEntry(JSON.stringify(toRow(entry))),
    eraseContent: (ids) => native.eraseContent(ids),
  };
}

/** Opens the teacher's history, but only one that verifies (`RecordBook.open`). */
export async function openRecordBook(native: HistorySpec): Promise<RecordBook> {
  await native.openHistory();
  return RecordBook.open(nativeStore(native), nativeDeps(native));
}
