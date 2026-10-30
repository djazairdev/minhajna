// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Rate limits on starting and joining worlds, and on the relay. A world
// id is 25 bits, so joins are limited too, to keep guessing out of reach.
// Requests are counted in 60 slices of each window, so a request costs the
// same however many came before it. An IPv6 address counts by its /64,
// since one client usually holds a whole /64. Addresses are held in memory
// only until the first new slice after their window, and never logged or
// stored. Behind Cloudflare the address comes from CF-Connecting-IP, which
// is only read when the server is told it runs there.

import type { IncomingMessage } from 'node:http';
import { isIPv4, isIPv6 } from 'node:net';

export interface Limit {
  readonly perAddress: number;
  readonly total: number;
  readonly windowMs: number;
}

export const START_LIMIT: Limit = { perAddress: 5, total: 120, windowMs: 60 * 60 * 1000 };
export const JOIN_LIMIT: Limit = { perAddress: 60, total: 6000, windowMs: 10 * 60 * 1000 };
export const RELAY_LIMIT: Limit = { perAddress: 1200, total: 120_000, windowMs: 10 * 60 * 1000 };

const EVERYONE = '';

const SLICES = 60;

/** Counts per slice of the window: the slice's number and its count, oldest first. */
type Counts = { slice: number; count: number }[];

export class Limiter {
  private readonly seen = new Map<string, Counts>();
  private lastSlice = -1;

  constructor(
    private readonly limit: Limit,
    private readonly now: () => number = Date.now,
  ) {}

  /** Counts one more for the address, or answers false when it or everyone has had their share. */
  take(address: string): boolean {
    const slice = Math.floor((this.now() * SLICES) / this.limit.windowMs);
    const oldest = slice - SLICES;
    if (slice !== this.lastSlice) {
      this.lastSlice = slice;
      for (const [key, counts] of this.seen) if ((counts.at(-1)?.slice ?? oldest) <= oldest) this.seen.delete(key);
    }
    const mine = this.current(address, oldest);
    const all = this.current(EVERYONE, oldest);
    if (sum(mine) >= this.limit.perAddress || sum(all) >= this.limit.total) return false;
    for (const counts of [mine, all]) {
      const last = counts.at(-1);
      if (last?.slice === slice) last.count += 1;
      else counts.push({ slice, count: 1 });
    }
    return true;
  }

  private current(key: string, oldest: number): Counts {
    const counts = (this.seen.get(key) ?? []).filter((one) => one.slice > oldest);
    this.seen.set(key, counts);
    return counts;
  }
}

function sum(counts: Counts): number {
  return counts.reduce((total, one) => total + one.count, 0);
}

/** An address as the limits count it: IPv4 as it is, an IPv4-mapped address as IPv4, IPv6 by its /64. */
export function limitKey(address: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped && isIPv4(mapped)) return mapped;
  const plain = address.split('%')[0]!;
  if (!isIPv6(plain)) return address;
  const [left = '', right] = plain.split('::');
  const head = left === '' ? [] : left.split(':').flatMap((group) => (group.includes('.') ? ['0', '0'] : [group]));
  const tail = (right === undefined || right === '' ? [] : right.split(':')).flatMap((group) =>
    group.includes('.') ? ['0', '0'] : [group],
  );
  const groups =
    right === undefined ? head : [...head, ...Array<string>(8 - head.length - tail.length).fill('0'), ...tail];
  return `${groups
    .slice(0, 4)
    .map((group) => parseInt(group, 16).toString(16))
    .join(':')}::/64`;
}

/** The address a request came from, as the limits count it, or 'unknown' when the socket has none. */
export function clientAddress(request: IncomingMessage, trustCloudflare: boolean): string {
  const forwarded = request.headers['cf-connecting-ip'];
  if (trustCloudflare && typeof forwarded === 'string' && forwarded !== '') return limitKey(forwarded);
  return limitKey(request.socket.remoteAddress ?? 'unknown');
}
