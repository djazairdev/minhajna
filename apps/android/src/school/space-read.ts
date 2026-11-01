// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a demo world's relay gives back to read a school's space (#564, #570):
// the world CA's public key, and the space's batches, page after page in the
// order the relay keeps them, grouped by stream so each joining code's channel
// is read from one pass. A page that does not go on, a batch out of order or
// of another shape, or an answer that is not the relay's is unexpected; a
// batch whose bytes do not decode is left out of a reading, and unexpected
// when the space is read whole, as for its export (#592).

import { fromBase64Url, isSigningKey, type SealedBatch } from '@minhajna/core';
import { unexpected, type Send } from '../demo/world-session';

const isBatch = (one: unknown): one is { seq: number; stream: string; number: number; bytes: string } => {
  const { seq, stream, number, bytes } = (one ?? {}) as Record<string, unknown>;
  const counts = Number.isSafeInteger(seq) && Number.isSafeInteger(number) && (number as number) >= 0;
  return counts && typeof stream === 'string' && typeof bytes === 'string';
};

/** The world CA's public key. */
export async function caKey(world: string, send: Send): Promise<string> {
  const answer = await send({ method: 'GET', path: `/worlds/${world}/ca` });
  const key = (answer.body as { publicKey?: unknown } | null)?.publicKey;
  if (answer.status !== 200 || !isSigningKey(key)) throw unexpected(answer);
  return key;
}

/** A school space's batches by stream, each in the order the relay keeps them, every one of them when `whole`. */
export async function spaceBatches(
  world: string,
  school: string,
  send: Send,
  { whole = false }: { readonly whole?: boolean } = {},
): Promise<ReadonlyMap<string, SealedBatch[]>> {
  const found = new Map<string, SealedBatch[]>();
  for (let after = 0, more = true; more;) {
    const answer = await send({ method: 'GET', path: `/worlds/${world}/spaces/${school}/batches?after=${after}` });
    const body = answer.body as { batches?: unknown; more?: unknown } | null;
    if (answer.status !== 200 || !Array.isArray(body?.batches)) throw unexpected(answer);
    const before = after;
    for (const one of body.batches as unknown[]) {
      if (!isBatch(one) || one.seq <= after) throw unexpected(answer);
      after = one.seq;
      const bytes = fromBase64Url(one.bytes);
      if (bytes === null && whole) throw unexpected(answer);
      if (bytes === null) continue;
      const stream = found.get(one.stream) ?? [];
      if (stream.length === 0) found.set(one.stream, stream);
      stream.push({ number: one.number, bytes });
    }
    more = body.more === true;
    if (more && after === before) throw unexpected(answer);
  }
  return found;
}
