// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Putting one record on a stream of a demo world's space, once (#593, answer
// 621): the space, a school's, a directorate's or the world's national one
// (#608), is opened as its kind first, then the stream is read, and
// when it already holds the record nothing is put; otherwise the record is
// sealed at the stream's next number. When another device took that number
// first, the stream is read again and the record put on top, until it holds it;
// a refusal while the stream stayed as it was, as for a full world, is said as
// the server's. A world erased, or a space open as another kind, says so, and a
// world with no room for a new space is the server's refusal; a space that may
// not be there is read through `readingMissing`.

import { toBase64Url, type SealedBatch } from '@minhajna/core';
import { failed, kitStep, unexpected, type Send } from '../demo/world-session';
import { spaceBatches } from './space-read';

/** How many times a record is put on top before it gives up. */
const TRIES = 3;

/** A record to put once on a stream of a world's space. */
export interface StreamPut {
  readonly world: string;
  readonly space: string;
  readonly kind: 'school' | 'directorate' | 'national';
  readonly stream: string;
  /** The stream's records, opened from its batches. */
  readonly open: (batches: readonly SealedBatch[]) => Promise<readonly unknown[]>;
  /** Whether the stream holds the record already. */
  readonly there: (records: readonly unknown[]) => boolean;
  /** The record's batches, numbered from `first`. */
  readonly seal: (first: number) => Promise<readonly SealedBatch[]>;
}

/** Whether a refused space names another kind, as the relay and the demo server word it. */
const otherKind = (body: unknown) => {
  const { error, message } = (body ?? {}) as { error?: unknown; message?: unknown };
  return error === 'other' || (typeof message === 'string' && message.includes('another kind'));
};

/**
 * Opens a world's space as its kind, or finds it open: E_NO_SUCH_WORLD once
 * the world is erased, E_SPACE_KIND when the space is open as another kind;
 * a world with no room for a new space is the server's refusal.
 */
export async function openSpace(world: string, space: string, kind: StreamPut['kind'], send: Send): Promise<void> {
  const opened = await send({ method: 'PUT', path: `/worlds/${world}/spaces/${space}`, body: { kind } });
  if (opened.status === 404) throw failed('The world was erased', 'E_NO_SUCH_WORLD');
  if (opened.status === 409 && otherKind(opened.body))
    throw failed('The space is open as another kind', 'E_SPACE_KIND');
  if (opened.status !== 200 && opened.status !== 201) throw unexpected(opened);
}

/**
 * A way to read a space that may not be there: a 404 whose world is erased is
 * E_NO_SUCH_WORLD, and any other 404 answers what `missing` gives.
 */
export function readingMissing(world: string, send: Send, missing: () => Awaited<ReturnType<Send>>): Send {
  return async (request) => {
    const answer = await send(request);
    if (answer.status !== 404) return answer;
    const there = await send({ method: 'GET', path: `/worlds/${world}/ca` });
    if (there.status === 404) throw failed('The world was erased', 'E_NO_SUCH_WORLD');
    return missing();
  };
}

/** Puts a record on its stream unless it is there; what failed carries world-session.ts's codes. */
export async function putOnce(put: StreamPut, send: Send): Promise<void> {
  const path = `/worlds/${put.world}/spaces/${put.space}`;
  await openSpace(put.world, put.space, put.kind, send);
  let refused: { readonly first: number; readonly answer: Awaited<ReturnType<Send>> } | null = null;
  for (let tries = 0; tries < TRIES; tries += 1) {
    const there = (await spaceBatches(put.world, put.space, send)).get(put.stream) ?? [];
    if (put.there(await kitStep(() => put.open(there)))) return;
    const first = there.reduce((most, one) => Math.max(most, one.number + 1), 0);
    if (refused !== null && refused.first === first) throw unexpected(refused.answer);
    const sealed = await kitStep(() => put.seal(first));
    const body = { stream: put.stream, first, batches: sealed.map((one) => toBase64Url(one.bytes)) };
    const answer = await send({ method: 'POST', path: `${path}/batches`, body });
    if (answer.status === 201) return;
    if (answer.status !== 409) throw unexpected(answer);
    refused = { first, answer };
  }
  throw failed('The stream kept changing', 'E_WORLD_SERVER');
}
