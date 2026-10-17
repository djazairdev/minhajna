// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Sending batches over a link that drops, two ways (PRD §5.8, §5.13). Both
// send everything still to go in one request. Resuming keeps every batch
// that arrived whole before a drop: the device asks the server how far it
// got, or counts what it received, and carries on from there, so a drop
// costs at most one batch and the bytes in flight. Restarting throws a cut
// request away and sends it all again, as a sync without resuming would. A
// stand-in server in memory keeps each stream's batches in order; it reads
// none of them.

import type { SealedBatch } from './batches.ts';
import type { SimulatedLink } from './link.ts';

/** The server's answer to "how far did you get": a number, a few bytes. */
const POSITION_BYTES = 8;
/** One hour on the link's clock: past that, a transfer counts as failed. */
export const GIVE_UP_MS = 3_600_000;

export class BatchServer {
  private readonly streams = new Map<string, SealedBatch[]>();

  /** The next number the stream expects. */
  next(stream: string): number {
    return this.streams.get(stream)?.length ?? 0;
  }

  /** Keeps a batch. One already kept is ignored, so a batch sent twice is kept once. */
  put(stream: string, batch: SealedBatch): void {
    const kept = this.streams.get(stream) ?? [];
    if (batch.number > kept.length) throw new RangeError('A batch skips a number');
    if (batch.number === kept.length) kept.push(batch);
    this.streams.set(stream, kept);
  }

  /** The stream's batches from `from` on. */
  from(stream: string, from: number): readonly SealedBatch[] {
    return (this.streams.get(stream) ?? []).slice(from);
  }
}

export type Strategy = 'resume' | 'restart';

export interface TransferResult {
  readonly completed: boolean;
  readonly ms: number;
  /** Over the air, both ways, overhead and lost requests included. */
  readonly bytes: number;
  /** The sealed batches alone. */
  readonly payload: number;
  readonly drops: number;
  readonly requests: number;
}

interface Mark {
  readonly ms: number;
  readonly bytes: number;
  readonly drops: number;
  readonly requests: number;
}

function mark(link: SimulatedLink): Mark {
  return { ms: link.ms, bytes: link.bytes, drops: link.drops, requests: link.requests };
}

function result(link: SimulatedLink, start: Mark, payload: number, completed: boolean): TransferResult {
  return {
    completed,
    ms: link.ms - start.ms,
    bytes: link.bytes - start.bytes,
    payload,
    drops: link.drops - start.drops,
    requests: link.requests - start.requests,
  };
}

/** After a drop, asks the server where the stream stands, until an answer arrives or time runs out. */
function askPosition(link: SimulatedLink, start: Mark): void {
  while (link.ms - start.ms < GIVE_UP_MS) {
    if (link.request(0, POSITION_BYTES).done) return;
  }
}

/** The batches, from the first, that fit whole in `arrived` bytes. */
function whole(batches: readonly SealedBatch[], arrived: number): number {
  let count = 0;
  let used = 0;
  for (const batch of batches) {
    used += batch.bytes.length;
    if (used > arrived) break;
    count++;
  }
  return count;
}

function bytesOf(batches: readonly SealedBatch[]): number {
  return batches.reduce((total, batch) => total + batch.bytes.length, 0);
}

/** Uploads batches to the server's stream; they must follow on from what it holds. */
export function upload(
  link: SimulatedLink,
  server: BatchServer,
  stream: string,
  batches: readonly SealedBatch[],
  strategy: Strategy,
): TransferResult {
  const start = mark(link);
  let index = 0;
  while (index < batches.length && link.ms - start.ms < GIVE_UP_MS) {
    const rest = batches.slice(index);
    const exchange = link.request(bytesOf(rest), POSITION_BYTES);
    const arrived = strategy === 'resume' || exchange.upArrived === bytesOf(rest) ? whole(rest, exchange.upArrived) : 0;
    for (const batch of rest.slice(0, arrived)) server.put(stream, batch);
    if (exchange.done) {
      index = batches.length;
    } else if (strategy === 'resume') {
      askPosition(link, start);
      index = Math.max(
        0,
        batches.findIndex((one) => one.number >= server.next(stream)),
      );
      if (server.next(stream) > batches.at(-1)!.number) index = batches.length;
    }
  }
  return result(link, start, bytesOf(batches), index === batches.length);
}

/** Downloads the server's stream from `from` on; the batches received, in order. */
export function download(
  link: SimulatedLink,
  server: BatchServer,
  stream: string,
  from: number,
  strategy: Strategy,
): { readonly result: TransferResult; readonly batches: readonly SealedBatch[] } {
  const start = mark(link);
  const wanted = server.from(stream, from);
  const received: SealedBatch[] = [];
  while (received.length < wanted.length && link.ms - start.ms < GIVE_UP_MS) {
    const rest = wanted.slice(received.length);
    const exchange = link.request(POSITION_BYTES, bytesOf(rest));
    if (exchange.done) received.push(...rest);
    else if (strategy === 'resume') received.push(...rest.slice(0, whole(rest, exchange.downArrived)));
  }
  return { result: result(link, start, bytesOf(wanted), received.length === wanted.length), batches: received };
}
