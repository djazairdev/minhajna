// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the check measures (PRD §5.13): how big each load is as it travels;
// how long it takes over each weak link, and how many bytes, when sync
// resumes and when it restarts; what fixed batches cost a month whether or
// not the teacher did anything; and how often a day's changes fit the
// day's batches. Each transfer runs over many seeded links and reports the
// median and the worst.

import type { webcrypto } from 'node:crypto';
import type { Day, Entry } from '@minhajna/core';
import { encodeChanges, pieceRoom, sealBatches, sealedSize, type SealedBatch } from './batches.ts';
import { REQUEST_OVERHEAD_BYTES, SimulatedLink, type LinkProfile } from './link.ts';
import { BatchServer, download, upload, type Strategy, type TransferResult } from './transfer.ts';

export interface Load {
  readonly name: string;
  readonly entries: readonly Entry[];
}

export interface Sizes {
  readonly entries: number;
  /** The entries as JSON, before compression. */
  readonly json: number;
  readonly compressed: number;
  readonly batches: number;
  /** All sealed batches, before any request overhead. */
  readonly sealed: number;
}

export async function sizes(load: Load, size: number): Promise<Sizes> {
  const compressed = await encodeChanges(load.entries);
  const batches = Math.max(1, Math.ceil(compressed.length / pieceRoom(size)));
  return {
    entries: load.entries.length,
    json: new TextEncoder().encode(JSON.stringify(load.entries)).length,
    compressed: compressed.length,
    batches,
    sealed: batches * sealedSize(size),
  };
}

export type Direction = 'upload' | 'download';

export interface TransferRow {
  readonly profile: string;
  readonly load: string;
  readonly direction: Direction;
  readonly strategy: Strategy;
  readonly runs: number;
  readonly completed: number;
  /** Over the completed runs; NaN when none completed. */
  readonly medianMs: number;
  readonly worstMs: number;
  readonly medianBytes: number;
  readonly payload: number;
  readonly medianDrops: number;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function once(
  profile: LinkProfile,
  seed: number,
  batches: readonly SealedBatch[],
  direction: Direction,
  strategy: Strategy,
): TransferResult {
  const server = new BatchServer();
  if (direction === 'download') for (const batch of batches) server.put('check', batch);
  const link = new SimulatedLink(profile, seed);
  return direction === 'upload'
    ? upload(link, server, 'check', batches, strategy)
    : download(link, server, 'check', 0, strategy).result;
}

/** One load over one link, `runs` times with seeds 1 to `runs`. */
export async function transferRow(
  key: webcrypto.CryptoKey,
  load: Load,
  profile: LinkProfile,
  direction: Direction,
  strategy: Strategy,
  size: number,
  runs: number,
): Promise<TransferRow> {
  const batches = await sealBatches(key, 'check', 0, await encodeChanges(load.entries), size);
  const results = Array.from({ length: runs }, (_, index) => once(profile, index + 1, batches, direction, strategy));
  const done = results.filter((one) => one.completed);
  return {
    profile: profile.name,
    load: load.name,
    direction,
    strategy,
    runs,
    completed: done.length,
    medianMs: median(done.map((one) => one.ms)),
    worstMs: done.length === 0 ? NaN : Math.max(...done.map((one) => one.ms)),
    medianBytes: median(results.map((one) => one.bytes)),
    payload: results[0]?.payload ?? 0,
    medianDrops: median(results.map((one) => one.drops)),
  };
}

/** Each school day's changes, compressed, in bytes. */
export async function daySizes(entries: readonly Entry[]): Promise<number[]> {
  const days = new Map<Day, Entry[]>();
  for (const entry of entries) days.set(entry.day, [...(days.get(entry.day) ?? []), entry]);
  return Promise.all([...days.values()].map(async (day) => (await encodeChanges(day)).length));
}

export interface FixedCost {
  readonly size: number;
  readonly setTimes: number;
  /** Thirty days of one batch at each set time, overhead included. */
  readonly monthBytes: number;
  /** The share of school days whose changes fit that day's batches. */
  readonly daysFitting: number;
  /** The most batches a day needed. */
  readonly busiestDay: number;
}

/** What one batch at each set time costs a month, and how well a day's changes fit. */
export function fixedCost(days: readonly number[], size: number, setTimes: number): FixedCost {
  const needed = days.map((bytes) => Math.max(1, Math.ceil(bytes / pieceRoom(size))));
  return {
    size,
    setTimes,
    monthBytes: 30 * setTimes * (sealedSize(size) + REQUEST_OVERHEAD_BYTES),
    daysFitting: needed.filter((count) => count <= setTimes).length / Math.max(1, needed.length),
    busiestDay: Math.max(0, ...needed),
  };
}
