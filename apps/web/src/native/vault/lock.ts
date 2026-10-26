// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC's lock (#250, answer 502), as the phone's (#210) but with a
// passphrase: setting it seals a new history key under it, trying it
// counts the try first, and changing it seals the same key again. While
// the history is open, this page holds its key and the sealing key in
// memory only, with the stamp of the sealed key on disk that they belong
// to; locking forgets them. Every step runs after the one before,
// and a try is counted in the same transaction that reads the count, so
// neither two steps nor two tabs race over it. Errors carry the phone's
// codes, and E_PASSPHRASE for a passphrase that does not fit.

import type { LockStatus, PinResult } from '../../../../android/src/native/NativeMinhajnaStorage';
import { failed, readAttempts, waitLeft } from './attempts.ts';
import { transact } from './database.ts';
import {
  historyKey,
  isSealedKey,
  newKeyBytes,
  openKey,
  passphraseFits,
  sealKey,
  stampOf,
  wrapping,
  type SealedKey,
  type Wrapping,
} from './seal.ts';

/** Where `meta` keeps the sealed key, the count of wrong tries, and the history's sealed end. */
export const KEY = 'key';
const ATTEMPTS = 'attempts';
export const HEAD = 'head';

/** The open history's key, the key that seals it, and the stamp of its sealed copy on disk. */
interface Open {
  readonly key: CryptoKey;
  readonly wrap: Wrapping;
  readonly stamp: string;
}

let opened: Open | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** An error with the native module's code. */
export function coded(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

/** A browser out of room for the write becomes E_NO_SPACE; any other error stays as it is. */
export function noSpace(error: unknown): unknown {
  return error instanceof Error && error.name === 'QuotaExceededError'
    ? coded('The browser has no room for the write', 'E_NO_SPACE')
    : error;
}

/** Runs the step once the ones before it are done, whether they kept or failed. */
export function serial<T>(step: () => Promise<T>): Promise<T> {
  const next = queue.then(step, step);
  queue = next.catch(() => undefined);
  return next;
}

function openedVault(): Open {
  if (opened === null) throw coded('The history is locked', 'E_LOCKED');
  return opened;
}

/** The history's key, while the history is open. */
export function openedKey(): CryptoKey {
  return openedVault().key;
}

/** The stamp of the sealed key this page opened; a write finds it on disk, or another tab changed the key. */
export function openedStamp(): string {
  return openedVault().stamp;
}

/** A new history key, sealed for disk with the open sealing key, and the key itself for this page. */
export async function newSealedKey(): Promise<{ sealed: SealedKey; key: CryptoKey }> {
  const raw = newKeyBytes();
  try {
    const sealed = await sealKey(raw, openedVault().wrap);
    return { sealed, key: await historyKey(raw) };
  } finally {
    raw.fill(0);
  }
}

/** Uses the new history key once its sealed copy is on disk. */
export function takeKey(key: CryptoKey, sealed: SealedKey): void {
  if (opened !== null) opened = { ...opened, key, stamp: stampOf(sealed) };
}

function status(state: LockStatus['state'], waitSeconds: number): LockStatus {
  return { state, biometric: false, biometricAvailable: false, waitSeconds, hasHistory: false };
}

function writeMeta(key: string, value: unknown): Promise<void> {
  return transact(['meta'], 'readwrite', (transaction) => {
    const store = transaction.objectStore('meta');
    if (value === null) store.delete(key);
    else store.put(value, key);
    return () => undefined;
  }).catch((error: unknown) => {
    throw noSpace(error);
  });
}

/** Where the lock stands; a wait is read from the kept count, which a clock moved back carries forward. */
export function lockStatus(): Promise<LockStatus> {
  return serial(async () => {
    const now = Date.now();
    const { sealed, kept } = await transact(['meta'], 'readonly', (transaction) => {
      const store = transaction.objectStore('meta');
      const key = store.get(KEY);
      const attempts = store.get(ATTEMPTS);
      return () => ({ sealed: key.result as unknown, kept: attempts.result as unknown });
    });
    if (sealed === undefined) return status('setup', 0);
    if (opened !== null) return status('open', 0);
    const { attempts, carried } = readAttempts(kept, now);
    if (carried) await writeMeta(ATTEMPTS, attempts).catch(() => undefined);
    return status('locked', waitLeft(attempts, now));
  });
}

/**
 * Seals a new history key under the first passphrase and opens the history.
 * Rows left from a key that is gone cannot be read, so they refuse it with
 * E_KEY_LOST; old timings are dropped.
 */
export function createLock(passphrase: string): Promise<void> {
  return serial(async () => {
    if (!passphraseFits(passphrase)) throw coded('The passphrase does not fit', 'E_PASSPHRASE');
    const wrap = await wrapping(passphrase);
    const raw = newKeyBytes();
    let sealed: SealedKey;
    try {
      sealed = await sealKey(raw, wrap);
    } catch (error) {
      raw.fill(0);
      throw error;
    }
    const key = await historyKey(raw);
    let lost = false;
    await transact(['meta', 'entries', 'timings'], 'readwrite', (transaction) => {
      const meta = transaction.objectStore('meta');
      const count = transaction.objectStore('entries').count();
      count.onsuccess = () => {
        if (count.result > 0) {
          lost = true;
          transaction.abort();
          return;
        }
        meta.add(sealed, KEY);
        meta.delete(ATTEMPTS);
        meta.delete(HEAD);
        transaction.objectStore('timings').clear();
      };
      return () => undefined;
    }).catch((error: unknown) => {
      if (lost) throw coded('The history is kept, but its key is gone', 'E_KEY_LOST');
      throw noSpace(error);
    });
    opened = { key, wrap, stamp: stampOf(sealed) };
  });
}

/**
 * Reads the count and, unless a wait is running, counts this try, in one
 * transaction; then opens the sealed key. Gives its bytes and the sealing
 * key, or null and the wait the try brought.
 */
async function tryPassphrase(passphrase: string) {
  const now = Date.now();
  const { sealed, wait, next } = await transact(['meta'], 'readwrite', (transaction) => {
    const store = transaction.objectStore('meta');
    const key = store.get(KEY);
    const kept = store.get(ATTEMPTS);
    let left = 0;
    let counted: ReturnType<typeof failed> | null = null;
    kept.onsuccess = () => {
      const { attempts, carried } = readAttempts(kept.result, now);
      left = waitLeft(attempts, now);
      if (left > 0) {
        if (carried) store.put(attempts, ATTEMPTS);
      } else if (key.result !== undefined) {
        counted = failed(attempts, now);
        store.put(counted, ATTEMPTS);
      }
    };
    return () => ({ sealed: key.result as unknown, wait: left, next: counted });
  }).catch((error: unknown) => {
    throw noSpace(error);
  });
  if (sealed === undefined) throw coded('No passphrase is set', 'E_HISTORY');
  if (!isSealedKey(sealed)) throw coded('The sealed key cannot be read', 'E_KEY_LOST');
  if (wait > 0 || next === null) return { found: null, wait, sealed };
  const found = passphrase.isWellFormed() ? await openKey(sealed, passphrase) : null;
  if (found === null) return { found: null, wait: waitLeft(next, now), sealed };
  try {
    await writeMeta(ATTEMPTS, null);
  } catch (error) {
    found.raw.fill(0);
    throw error;
  }
  return { found, wait: 0, sealed };
}

/** Opens the history with the passphrase, unless a wait is running. A wrong one is counted. */
export function unlock(passphrase: string): Promise<PinResult> {
  return serial(async () => {
    const { found, wait, sealed } = await tryPassphrase(passphrase);
    if (found === null) return { opened: false, waitSeconds: wait };
    opened = { key: await historyKey(found.raw), wrap: found.wrap, stamp: stampOf(sealed) };
    return { opened: true, waitSeconds: 0 };
  });
}

/**
 * Seals the same key under a new passphrase, once the current one is right,
 * while the history is open, as on the phone; the history stays as it was.
 */
export function changePassphrase(current: string, next: string): Promise<PinResult> {
  return serial(async () => {
    openedVault();
    if (!passphraseFits(next)) throw coded('The passphrase does not fit', 'E_PASSPHRASE');
    const { found, wait } = await tryPassphrase(current);
    if (found === null) return { opened: false, waitSeconds: wait };
    try {
      const wrap = await wrapping(next);
      const sealed = await sealKey(found.raw, wrap);
      await writeMeta(KEY, sealed);
      if (opened !== null) opened = { ...opened, wrap, stamp: stampOf(sealed) };
    } finally {
      found.raw.fill(0);
    }
    return { opened: true, waitSeconds: 0 };
  });
}

/** Forgets the history's key and its sealing key; only the passphrase opens it again. */
export function lockHistory(): Promise<void> {
  return serial(() => {
    opened = null;
    return Promise.resolve();
  });
}
