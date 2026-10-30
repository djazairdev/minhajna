// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Rate limits on starting and joining worlds, and on the relay, and a daily
// quota of batches stored, so no address fills the store. A world id is 25
// bits, so joins are limited too, to keep guessing out of reach. Requests
// are counted in 60 slices of each window, so a request costs the same
// however many came before it; the quota counts only batches stored. An
// IPv6 address counts by its /64, since one client usually holds a whole
// /64. Addresses are held in memory only until the first new slice after
// their window, so up to a day for the quota, and never logged or stored.
// Behind Cloudflare the address comes from CF-Connecting-IP, which is only
// read when the server is told it runs there.

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
/** Sealed batches stored per day: about 82 MB for one address; for everyone, a week of them fits the server's cap. */
export const UPLOAD_LIMIT: Limit = { perAddress: 20_000, total: 140_000, windowMs: 24 * 60 * 60 * 1000 };

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

  /** Answers whether `amount` more fits the address's share and everyone's, counting nothing. */
  fits(address: string, amount = 1): boolean {
    const { mine, all } = this.counts(address);
    return sum(mine) + amount <= this.limit.perAddress && sum(all) + amount <= this.limit.total;
  }

  /** Counts `amount` more for the address, or answers false when it or everyone would go over their share. */
  take(address: string, amount = 1): boolean {
    if (!this.fits(address, amount)) return false;
    this.charge(address, amount);
    return true;
  }

  /** Counts `amount` more for the address whether it fits or not, for what was already done. */
  charge(address: string, amount: number): void {
    const { slice, mine, all } = this.counts(address);
    for (const counts of [mine, all]) {
      const last = counts.at(-1);
      if (last?.slice === slice) last.count += amount;
      else counts.push({ slice, count: amount });
    }
  }

  private counts(address: string): { slice: number; mine: Counts; all: Counts } {
    const slice = Math.floor((this.now() * SLICES) / this.limit.windowMs);
    const oldest = slice - SLICES;
    if (slice !== this.lastSlice) {
      this.lastSlice = slice;
      for (const [key, counts] of this.seen) if ((counts.at(-1)?.slice ?? oldest) <= oldest) this.seen.delete(key);
    }
    return { slice, mine: this.current(address, oldest), all: this.current(EVERYONE, oldest) };
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
