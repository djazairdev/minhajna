// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the relay accepts. A space id is 16 to 43 base64url characters the
// clients drew, except the world's one national space, named "national". A
// stream is named the same way. Every batch is exactly SEALED_BATCH_BYTES
// once decoded: the core's 4096-byte batch sealed with AES-256-GCM, a 12-byte
// IV and a 16-byte tag. Anything else is refused, so the server never holds
// a batch whose size says something.

import type { SpaceKind } from './space-store.js';

export const SEALED_BATCH_BYTES = 4096 + 12 + 16;
export const MAX_BATCHES_PER_REQUEST = 128;
export const MAX_PAGE = 128;
export const NATIONAL = 'national';

const ID = /^[A-Za-z0-9_-]{16,43}$/;
const KINDS: readonly SpaceKind[] = ['school', 'directorate', 'national'];

export interface BatchUpload {
  readonly stream: string;
  readonly first: number;
  readonly batches: readonly Uint8Array[];
}

export function isSpaceId(id: string): boolean {
  return id === NATIONAL || ID.test(id);
}

/** A space's kind as the relay keeps it, or why the id or kind was refused. */
export function readSpace(id: string, body: unknown): { readonly kind: SpaceKind } | { readonly problem: string } {
  const kind = (body as { kind?: unknown } | null)?.kind;
  if (!KINDS.includes(kind as SpaceKind)) return { problem: 'kind must be school, directorate or national' };
  if ((kind === 'national') !== (id === NATIONAL)) {
    return { problem: 'the national space, and only it, is named national' };
  }
  if (!isSpaceId(id)) return { problem: 'a space id is 16 to 43 base64url characters' };
  return { kind: kind as SpaceKind };
}

function sealedBatch(text: unknown): Uint8Array | null {
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]+$/.test(text)) return null;
  const bytes = Buffer.from(text, 'base64url');
  return bytes.length === SEALED_BATCH_BYTES && bytes.toString('base64url') === text ? new Uint8Array(bytes) : null;
}

/** An upload of consecutive batches from one stream, or why it was refused. */
export function readUpload(body: unknown): BatchUpload | string {
  if (typeof body !== 'object' || body === null) return 'the request must be a JSON object';
  const { stream, first, batches } = body as Record<string, unknown>;
  if (typeof stream !== 'string' || !ID.test(stream)) return 'a stream is 16 to 43 base64url characters';
  if (!Number.isSafeInteger(first) || (first as number) < 0) return 'first must be a whole number from 0';
  if (!Array.isArray(batches) || batches.length < 1 || batches.length > MAX_BATCHES_PER_REQUEST) {
    return `batches must list 1 to ${MAX_BATCHES_PER_REQUEST} sealed batches`;
  }
  const sealed = batches.map(sealedBatch);
  if (sealed.some((one) => one === null)) return `every batch is ${SEALED_BATCH_BYTES} bytes in base64url`;
  return { stream, first: first as number, batches: sealed as Uint8Array[] };
}
