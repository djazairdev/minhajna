// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Fixed batches (PRD §5.8) as the check runs them. The core cuts and pads
// change sets into batches (#541); here they are compressed first and each
// piece is sealed with AES-256-GCM under the teacher's key, by Node's Web
// Crypto: the project writes no cryptography of its own (PRD §6.5).

import type { webcrypto } from 'node:crypto';
import {
  openBatches as openCoreBatches,
  sealBatches as sealCoreBatches,
  type BatchCipher,
  type Entry,
  type SealedBatch,
} from '@minhajna/core';

export { pieceRoom, type SealedBatch } from '@minhajna/core';

const IV_BYTES = 12;
const TAG_BYTES = 16;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** What a sealed batch of the given size takes on the wire, before any request overhead. */
export function sealedSize(size: number): number {
  return IV_BYTES + size + TAG_BYTES;
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

/** A fresh teacher's key for the check; the app's keys come from its own design (PRD §6.5). */
export async function makeKey(): Promise<webcrypto.CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** AES-256-GCM under the key, with a fresh 12-byte IV before each sealed piece. */
export function aesGcm(key: webcrypto.CryptoKey): BatchCipher {
  return {
    async seal(plain, additionalData) {
      const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
      const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, plain));
      const bytes = new Uint8Array(IV_BYTES + sealed.length);
      bytes.set(iv);
      bytes.set(sealed, IV_BYTES);
      return bytes;
    },
    async open(bytes, additionalData) {
      const iv = bytes.subarray(0, IV_BYTES);
      const sealed = bytes.subarray(IV_BYTES);
      return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData }, key, sealed));
    },
  };
}

/** Seals a change set into batches of `size` bytes each under the key, numbered from `first`. */
export async function sealBatches(
  key: webcrypto.CryptoKey,
  stream: string,
  first: number,
  changes: Uint8Array,
  size: number,
): Promise<SealedBatch[]> {
  return sealCoreBatches(aesGcm(key), stream, first, changes, size);
}

/** Opens batches under the key in order and joins them back into change sets. */
export async function openBatches(
  key: webcrypto.CryptoKey,
  stream: string,
  batches: readonly SealedBatch[],
): Promise<Uint8Array[]> {
  return openCoreBatches(aesGcm(key), stream, batches);
}
