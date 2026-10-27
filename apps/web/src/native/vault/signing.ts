// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC's signing pair, sealed in the vault (#250, answers 508 and 510).
// The pair is made once, while the history is open, and its private half is
// sealed with the history's key, like every record, so a copy of the
// browser's files signs nothing without the passphrase. It is opened once
// per unlock, imported as a key the page cannot read back, and held only
// until the history locks. Erasing content reseals it under the new key in
// the same step; one that no longer opens is dropped then, and a new pair
// is made at next use. A new passphrase over an empty history drops it too.

import { fromBase64, toBase64 } from '../signing/der.ts';
import { transact } from './database.ts';
import { KEY, SIGNING, coded, forgetOnLock, noSpace, openedKey, openedStamp, serial } from './lock.ts';
import { isSealed, isSealedKey, seal, stampOf, unseal, type Sealed } from './seal.ts';
import { MOVED, rowStamp } from './stamp.ts';

const P256 = { name: 'ECDSA', namedCurve: 'P-256' } as const;

/** The pair as the page uses it: the private half unreadable, the public half as SPKI. */
export interface SigningPair {
  readonly privateKey: CryptoKey;
  readonly spki: Uint8Array;
}

/** The pair opened since the last unlock, with the key stamp and the sealed row it came from. */
let held: { stamp: string; row: string; pair: SigningPair } | null = null;
forgetOnLock(() => (held = null));

function failed(): Error {
  return coded('Signing failed', 'E_SIGNING');
}

/** The sealed pair as kept, or undefined when none was made. */
export function readSigning(): Promise<unknown> {
  return transact(['meta'], 'readonly', (transaction) => {
    const kept = transaction.objectStore('meta').get(SIGNING);
    return () => kept.result as unknown;
  });
}

/** A new pair sealed under `key`, kept only while the sealed key on disk is still the one this page opened. */
async function makePair(key: CryptoKey, stamp: string): Promise<void> {
  const made = await crypto.subtle.generateKey(P256, true, ['sign', 'verify']);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', made.privateKey));
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', made.publicKey));
  let sealed: Sealed;
  try {
    sealed = await seal(key, JSON.stringify({ spki: toBase64(spki), pkcs8: toBase64(pkcs8) }), SIGNING);
  } finally {
    pkcs8.fill(0);
  }
  let moved = false;
  await transact(['meta'], 'readwrite', (transaction) => {
    const meta = transaction.objectStore('meta');
    const current = meta.get(KEY);
    current.onsuccess = () => {
      if (isSealedKey(current.result) && stampOf(current.result) === stamp) {
        const added = meta.add(sealed, SIGNING);
        added.onerror = (event) => {
          if (added.error?.name === 'ConstraintError') event.preventDefault();
        };
      } else {
        moved = true;
        transaction.abort();
      }
    };
    return () => undefined;
  }).catch((error: unknown) => {
    if (moved) throw coded(MOVED, 'E_HISTORY');
    throw noSpace(error);
  });
}

/** The pair kept in `row`, opened with `key`. */
export async function openPair(key: CryptoKey, row: unknown): Promise<SigningPair> {
  if (!isSealed(row)) throw failed();
  const kept: unknown = JSON.parse(await unseal(key, row, SIGNING));
  const { spki, pkcs8 } = (typeof kept === 'object' && kept !== null ? kept : {}) as Record<string, unknown>;
  const publicBytes = typeof spki === 'string' ? fromBase64(spki) : null;
  const privateBytes = typeof pkcs8 === 'string' ? fromBase64(pkcs8) : null;
  if (publicBytes === null || privateBytes === null) throw failed();
  try {
    await crypto.subtle.importKey('spki', publicBytes, P256, false, ['verify']);
    return {
      privateKey: await crypto.subtle.importKey('pkcs8', privateBytes, P256, false, ['sign']),
      spki: publicBytes,
    };
  } finally {
    privateBytes.fill(0);
  }
}

/** This PC's pair, made on first use; it needs the history open, and one kept that does not open fails. */
export function signingPair(): Promise<SigningPair> {
  return serial(async () => {
    const stamp = openedStamp();
    let row = await readSigning();
    if (row === undefined) {
      await makePair(openedKey(), stamp);
      row = await readSigning();
    }
    const nonce = rowStamp(row);
    if (held !== null && held.stamp === stamp && held.row === nonce) return held.pair;
    try {
      const pair = await openPair(openedKey(), row);
      held = { stamp, row: nonce, pair };
      return pair;
    } catch {
      throw failed();
    }
  });
}

/** The kept pair sealed again under `next`, or null when there is none or it no longer opens. */
export async function resealSigning(old: CryptoKey, next: CryptoKey, row: unknown): Promise<Sealed | null> {
  if (!isSealed(row)) return null;
  try {
    return await seal(next, await unseal(old, row, SIGNING), SIGNING);
  } catch {
    return null;
  }
}
