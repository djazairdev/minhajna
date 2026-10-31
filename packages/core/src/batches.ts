// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Fixed batches (PRD §5.8, #541). A change set is cut into pieces, every
// piece padded to the same size behind a head that marks the first and last
// pieces of its set and the bytes it uses, and each piece is sealed on its
// own. The server sees only sealed batches of one size, numbered in order,
// so their arrival says nothing of what changed. A batch's stream and
// number are bound into its seal, so a batch moved, swapped or replayed
// elsewhere fails to open. The cipher comes in from the app, which takes it
// from the platform's own cryptography: the project writes none of its own
// (§6.5). The relay takes batches of one size, SYNC_BATCH_BYTES before they
// are sealed, and a stream sealed under a key of its own, such as a
// teacher's channel to the school (#564), seals with the world's AES-GCM.

import type { WorldCipher } from './world-keys.ts';

export interface SealedBatch {
  readonly number: number;
  readonly bytes: Uint8Array;
}

/** Seals and opens one padded piece, binding the given bytes into the seal. */
export interface BatchCipher {
  readonly seal: (plain: Uint8Array, additional: Uint8Array) => Promise<Uint8Array>;
  readonly open: (sealed: Uint8Array, additional: Uint8Array) => Promise<Uint8Array>;
}

/** The one size of the relay's batches before sealing: 4096 bytes, which AES-GCM's nonce and tag bring to 4124. */
export const SYNC_BATCH_BYTES = 4096;

/** A batch cipher under one key, from the platform's AES-GCM; a batch that does not open throws. */
export function keyedCipher(key: Uint8Array, cipher: WorldCipher): BatchCipher {
  return {
    seal: (plain, additional) => cipher.seal(key, plain, additional),
    async open(sealed, additional) {
      const plain = await cipher.open(key, sealed, additional);
      if (plain === null) throw new RangeError('A batch does not open under this key');
      return plain;
    },
  };
}

/** A piece's head: flags for the first and last pieces of a change set, then the bytes used. */
export const BATCH_HEAD_BYTES = 5;
const LAST = 1;
const FIRST = 2;

/** The bytes of a change set that one batch of the given size holds. */
export function pieceRoom(size: number): number {
  return size - BATCH_HEAD_BYTES;
}

/** What a batch's seal binds: the format, its stream and its number. Streams are ASCII ids. */
export function batchAdditional(stream: string, number: number): Uint8Array {
  const text = `minhajna/sync/1\n${stream}\n${number}`;
  if (!/^[\x20-\x7e\n]*$/.test(text)) throw new RangeError('A stream is named in printable ASCII');
  return Uint8Array.from(text, (one) => one.charCodeAt(0));
}

/**
 * Seals a change set into batches of `size` bytes each, numbered from
 * `first`. An empty change set still makes one batch, as a batch sent at a
 * set time with nothing new.
 */
export async function sealBatches(
  cipher: BatchCipher,
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
    view.setUint8(0, (index === 0 ? FIRST : 0) | (index === count - 1 ? LAST : 0));
    view.setUint32(1, part.length);
    plain.set(part, BATCH_HEAD_BYTES);
    const number = first + index;
    batches.push({ number, bytes: await cipher.seal(plain, batchAdditional(stream, number)) });
  }
  return batches;
}

/**
 * Opens batches in order and joins their pieces back into change sets. The
 * list begins at a change set's first piece. It fails if any batch was
 * changed or sealed for another place, if the numbers do not follow one
 * another, or if a change set's start or end is missing. Empty change sets
 * are left out.
 */
export async function openBatches(
  cipher: BatchCipher,
  stream: string,
  batches: readonly SealedBatch[],
): Promise<Uint8Array[]> {
  const sets: Uint8Array[] = [];
  let pending: Uint8Array[] = [];
  let previous: number | undefined;
  for (const batch of batches) {
    if (previous !== undefined && batch.number !== previous + 1) {
      throw new RangeError('Batches are opened in order, with none missing');
    }
    previous = batch.number;
    const plain = await cipher.open(batch.bytes, batchAdditional(stream, batch.number));
    if (plain.length < BATCH_HEAD_BYTES) throw new RangeError('A batch is shorter than its head');
    const view = new DataView(plain.buffer, plain.byteOffset, plain.byteLength);
    const flags = view.getUint8(0);
    if (flags > (FIRST | LAST)) throw new RangeError('A batch carries flags no batch has');
    if ((flags & FIRST) !== 0 ? pending.length > 0 : pending.length === 0) {
      throw new RangeError('A change set is missing its start');
    }
    const used = view.getUint32(1);
    if (used > plain.length - BATCH_HEAD_BYTES) throw new RangeError('A batch claims more bytes than it holds');
    pending.push(plain.slice(BATCH_HEAD_BYTES, BATCH_HEAD_BYTES + used));
    if ((flags & LAST) !== 0) {
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
