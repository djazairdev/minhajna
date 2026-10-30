// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Rate limits on starting and joining worlds. A world id is 25 bits, so
// joins are limited too, to keep guessing out of reach. An IPv6 address
// counts by its /64, since one client usually holds a whole /64. Addresses
// are held in memory only until the first request after their window, and
// never logged or stored. Behind Cloudflare the address comes from
// CF-Connecting-IP, which is only read when the server is told it runs there.

import type { IncomingMessage } from 'node:http';
import { isIPv4, isIPv6 } from 'node:net';

export interface Limit {
  readonly perAddress: number;
  readonly total: number;
  readonly windowMs: number;
}

export const START_LIMIT: Limit = { perAddress: 5, total: 120, windowMs: 60 * 60 * 1000 };
export const JOIN_LIMIT: Limit = { perAddress: 60, total: 6000, windowMs: 10 * 60 * 1000 };

const EVERYONE = '';

export class Limiter {
  private readonly seen = new Map<string, number[]>();

  constructor(
    private readonly limit: Limit,
    private readonly now: () => number = Date.now,
  ) {}

  /** Counts one more for the address, or answers false when it or everyone has had their share. */
  take(address: string): boolean {
    const now = this.now();
    const since = now - this.limit.windowMs;
    for (const [key, times] of this.seen) if (times.at(-1)! <= since) this.seen.delete(key);
    const mine = (this.seen.get(address) ?? []).filter((time) => time > since);
    const all = (this.seen.get(EVERYONE) ?? []).filter((time) => time > since);
    if (mine.length >= this.limit.perAddress || all.length >= this.limit.total) return false;
    this.seen.set(address, [...mine, now]);
    this.seen.set(EVERYONE, [...all, now]);
    return true;
  }
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
