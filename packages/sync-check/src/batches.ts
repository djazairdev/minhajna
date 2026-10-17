// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Fixed batches (PRD §5.8). The changes since the last sync are compressed,
// cut into pieces and sealed one by one with AES-256-GCM under the
// teacher's key, every piece padded to the same size. The server sees only
// sealed batches of one size, numbered in order. A batch's stream and number
// are bound into its seal, so a batch moved, swapped or replayed elsewhere
// fails to open. Node's Web Crypto does the cryptography: the project writes
// none of its own (PRD §6.5).

import type { webcrypto } from 'node:crypto';
import type { Entry } from '@minhajna/core';

const IV_BYTES = 12;
const TAG_BYTES = 16;
/** A piece's head: a flag for the last piece of a change set, then the bytes used. */
const HEAD_BYTES = 5;
const LAST = 1;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface SealedBatch {
  readonly number: number;
  readonly bytes: Uint8Array;
}

/** What a sealed batch of the given size takes on the wire, before any request overhead. */
export function sealedSize(size: number): number {
  return IV_BYTES + size + TAG_BYTES;
}

/** The bytes of a change set that one batch of the given size holds. */
export function pieceRoom(size: number): number {
  return size - HEAD_BYTES;
}

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const piped = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

/** The entries as they travel: JSON, then raw deflate. */
export async function encodeChanges(entries: readonly Entry[]): Promise<Uint8Array> {
  return through(encoder.encode(JSON.stringify(entries)), new CompressionStream('deflate-raw'));
}

/** The entries back from what travelled. */
export async function decodeChanges(bytes: Uint8Array): Promise<Entry[]> {
  const parsed: unknown = JSON.parse(decoder.decode(await through(bytes, new DecompressionStream('deflate-raw'))));
  if (!Array.isArray(parsed)) throw new TypeError('A change set is a list of entries');
  return parsed as Entry[];
}

function additional(stream: string, number: number): Uint8Array {
  return encoder.encode(`minhajna/sync/1\n${stream}\n${number}`);
}

/** A fresh teacher's key for the check; the app's keys come from its own design (PRD §6.5). */
export async function makeKey(): Promise<webcrypto.CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/**
 * Seals a change set into batches of `size` bytes each, numbered from
 * `first`. An empty change set still makes one batch, as a batch sent at a
 * set time with nothing new.
 */
export async function sealBatches(
  key: webcrypto.CryptoKey,
  stream: string,
  first: number,
  changes: Uint8Array,
  size: number,
): Promise<SealedBatch[]> {
  const room = pieceRoom(size);
  if (room < 1) throw new RangeError('A batch must hold more than its head');
  const count = Math.max(1, Math.ceil(changes.length / room));
  const batches: SealedBatch[] = [];
  for (let index = 0; index < count; index++) {
    const part = changes.subarray(index * room, (index + 1) * room);
    const plain = new Uint8Array(size);
    const view = new DataView(plain.buffer);
    view.setUint8(0, index === count - 1 ? LAST : 0);
    view.setUint32(1, part.length);
    plain.set(part, HEAD_BYTES);
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const number = first + index;
    const sealed = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: additional(stream, number) }, key, plain),
    );
    const bytes = new Uint8Array(IV_BYTES + sealed.length);
    bytes.set(iv);
    bytes.set(sealed, IV_BYTES);
    batches.push({ number, bytes });
  }
  return batches;
}

/**
 * Opens batches in order and joins their pieces back into change sets. It
 * fails if any batch was changed, sealed for another place, or is missing
 * the end of its change set. Empty change sets are left out.
 */
export async function openBatches(
  key: webcrypto.CryptoKey,
  stream: string,
  batches: readonly SealedBatch[],
): Promise<Uint8Array[]> {
  const sets: Uint8Array[] = [];
  let pending: Uint8Array[] = [];
  for (const batch of batches) {
    const iv = batch.bytes.subarray(0, IV_BYTES);
    const plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData: additional(stream, batch.number) },
        key,
        batch.bytes.subarray(IV_BYTES),
      ),
    );
    const view = new DataView(plain.buffer);
    const used = view.getUint32(1);
    if (used > plain.length - HEAD_BYTES) throw new RangeError('A batch claims more bytes than it holds');
    pending.push(plain.slice(HEAD_BYTES, HEAD_BYTES + used));
    if (view.getUint8(0) === LAST) {
      const set = new Uint8Array(pending.reduce((total, part) => total + part.length, 0));
      let offset = 0;
      for (const part of pending) {
        set.set(part, offset);
        offset += part.length;
      }
      if (set.length > 0) sets.push(set);
      pending = [];
    }
  }
  if (pending.length > 0) throw new RangeError('The last change set is cut short');
  return sets;
}
