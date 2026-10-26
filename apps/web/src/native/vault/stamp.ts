// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a write to the PC's history checks before it keeps anything (#250,
// part 2): that the sealed key on disk is still the one this page opened,
// and that the history's end and the timings are still the ones the write
// read. Another tab's write in between fails it, rather than mixing two
// keys or losing a write. Each row's stamp is its nonce, which changes
// with every sealing.

import { HEAD, KEY, openedStamp } from './lock.ts';
import { isSealed, isSealedKey, stampOf } from './seal.ts';

/** Where the timings are kept: one sealed row in their own store. */
export const TIMINGS = 'timings';
export const ALL = 'all';

/** What a refused write says. */
export const MOVED = 'The history changed in another tab';

/** The stamps of the sealed key this page opened and, unless null, of the end and the timings it read. */
export interface Stamp {
  readonly key: string;
  readonly head: string | null;
  readonly timings: string | null;
}

/** A sealed row's nonce as text, or nothing when there is no row. */
export function rowStamp(value: unknown): string {
  return isSealed(value) ? Array.from(value.nonce, (byte) => byte.toString(16).padStart(2, '0')).join('') : '';
}

/** This page's key stamp, with the stamps of the end and the timings as read; null leaves one unchecked. */
export function stamp(head: unknown, timings: unknown): Stamp {
  return {
    key: openedStamp(),
    head: head === null ? null : rowStamp(head),
    timings: timings === null ? null : rowStamp(timings),
  };
}

/**
 * Queues, in the write's transaction, a check that the key, the end and the
 * timings are as read and that the entries number `count` when given, then
 * `work`; any change aborts the write.
 */
export function checked(
  transaction: IDBTransaction,
  read: Stamp,
  count: number | null,
  work: () => void,
  moved: () => void,
) {
  const meta = transaction.objectStore('meta');
  const key = meta.get(KEY);
  const head = meta.get(HEAD);
  const timings = read.timings === null ? null : transaction.objectStore(TIMINGS).get(ALL);
  const kept = transaction.objectStore('entries').count();
  kept.onsuccess = () => {
    const keyMoved = !isSealedKey(key.result) || stampOf(key.result) !== read.key;
    const headMoved = read.head !== null && rowStamp(head.result) !== read.head;
    const timingsMoved = timings !== null && rowStamp(timings.result) !== read.timings;
    if (keyMoved || headMoved || timingsMoved || (count !== null && kept.result !== count)) {
      moved();
      transaction.abort();
      return;
    }
    work();
  };
}
