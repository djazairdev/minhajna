// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Records carried on one stream of a space, each sealed in batches of the
// relay's one size under a key only the record's readers derive (#571 and #572,
// answers 600 and 602): the stream's name and its sealing key both come from
// one secret under a MAC with the record's own name, so the relay sees neither.
// A record is canonical JSON, with every character past ASCII escaped, so its
// bytes are ASCII whatever language its names are in. Reading opens each batch
// once, in number order, and keeps a record only when its batches follow one
// another from its first to its last, within the most batches a record of its
// kind may take; what does not open or parse is left out, and a number given
// twice counts only the first time.

import { joinPieces, keyedCipher, openPiece, sealBatches, SYNC_BATCH_BYTES, type SealedBatch } from './batches.ts';
import { canonicalJson } from './canonical.ts';
import { toHex } from './id.ts';
import { ascii } from './school-key-shape.ts';
import type { WorldCipher, WorldMac } from './world-keys.ts';

/** Where records of one kind go: a stream and its sealing key. */
export interface Place {
  readonly stream: string;
  readonly sealing: Uint8Array;
}

/** The place a secret names for records of a kind, such as 'keyring' or 'holder-drop'. */
export async function placeOf(key: Uint8Array, name: string, mac: WorldMac): Promise<Place> {
  const stream = toHex((await mac(key, ascii(`minhajna/${name}/stream`))).subarray(0, 16));
  return { stream, sealing: await mac(key, ascii(`minhajna/${name}/seal`)) };
}

/** Canonical JSON with every character past ASCII written as a \u escape, which JSON reads back as it was. */
export function asciiJson(value: unknown): string {
  return canonicalJson(value).replace(/[^\n\x20-\x7e]/gu, (one) =>
    one
      .split('')
      .map((unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, '0')}`)
      .join(''),
  );
}

/** The JSON value of ASCII bytes, or null when they hold none. */
export function parsedAscii(bytes: Uint8Array): unknown {
  let text = '';
  for (let at = 0; at < bytes.length; at += 4096) text += String.fromCharCode(...bytes.subarray(at, at + 4096));
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** A record's batches at a place, numbered from `first`; a record longer than `most` batches is refused. */
export async function sealRecord(
  place: Place,
  value: unknown,
  first: number,
  most: number,
  cipher: WorldCipher,
): Promise<SealedBatch[]> {
  if (!Number.isSafeInteger(first) || first < 0) throw new RangeError('A batch is numbered from 0');
  const bytes = ascii(asciiJson(value));
  const batches = await sealBatches(keyedCipher(place.sealing, cipher), place.stream, first, bytes, SYNC_BATCH_BYTES);
  if (batches.length > most) throw new RangeError('A record this long cannot travel');
  return batches;
}

/**
 * The records of a place's batches, in their order, each batch opened once,
 * and a number given twice only the first time: a batch that does not open, a
 * gap, or a record longer than `most` batches drops what was gathered, and a
 * record that starts again before it ends keeps only the new start.
 */
export async function openRecords(
  place: Place,
  batches: readonly SealedBatch[],
  most: number,
  cipher: WorldCipher,
): Promise<unknown[]> {
  const opener = keyedCipher(place.sealing, cipher);
  const found: unknown[] = [];
  let pending: Uint8Array[] = [];
  let previous = -1;
  for (const batch of [...batches].sort((a, b) => a.number - b.number)) {
    if (batch.number === previous) continue;
    const piece = await openPiece(opener, place.stream, batch).catch(() => null);
    const follows = batch.number === previous + 1;
    previous = batch.number;
    if (piece === null || (!piece.first && (!follows || pending.length === 0))) {
      pending = [];
      continue;
    }
    pending = piece.first ? [piece.bytes] : [...pending, piece.bytes];
    if (piece.last) {
      found.push(parsedAscii(joinPieces(pending)));
      pending = [];
    } else if (pending.length >= most) pending = [];
  }
  return found;
}
