// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The security logs (#619, §6.7, R-6.7-10, answer 656), kept apart from
// everything else: in memory only, never in the database or its backups, as
// counts by UTC day and kind, with no address, world, space or time, for the
// last 7 days, and lost when the server stops. The kinds: requests over the
// rate limits, a world id and pass that opened nothing, a starter token
// refused, and a certificate request or a delivery to the state's stand-in
// refused. They count what was refused, never who, so nothing in them can
// measure or judge a teacher. SecurityFilter counts each refusal as its
// exception is answered, then answers it as NestJS would.

import { Catch, HttpException, Inject, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { IncomingMessage } from 'node:http';
import { PassRefused } from '../worlds/world-access.js';

export const SECURITY_KINDS = [
  'rate-limited',
  'pass-refused',
  'starter-refused',
  'certificate-refused',
  'delivery-refused',
] as const;
export type SecurityKind = (typeof SECURITY_KINDS)[number];
/** How many days of counts are kept. */
export const SECURITY_DAYS = 7;
export const SECURITY_LOG = Symbol('SecurityLog');

export interface SecurityDay {
  readonly day: string;
  readonly counts: Readonly<Record<SecurityKind, number>>;
}

const zero = (): Record<SecurityKind, number> =>
  Object.fromEntries(SECURITY_KINDS.map((kind) => [kind, 0])) as Record<SecurityKind, number>;

export class SecurityLog {
  private readonly byDay = new Map<string, Record<SecurityKind, number>>();

  constructor(private readonly now: () => number = Date.now) {}

  count(kind: SecurityKind): void {
    const today = new Date(this.now()).toISOString().slice(0, 10);
    const counts = this.byDay.get(today) ?? zero();
    counts[kind] += 1;
    this.byDay.set(today, counts);
    this.trim(today);
  }

  /** The days kept, newest first. */
  days(): SecurityDay[] {
    this.trim(new Date(this.now()).toISOString().slice(0, 10));
    return [...this.byDay]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([day, counts]) => ({ day, counts: { ...counts } }));
  }

  private trim(today: string): void {
    const first = new Date(Date.parse(`${today}T00:00:00Z`) - (SECURITY_DAYS - 1) * 86_400_000);
    const oldest = first.toISOString().slice(0, 10);
    for (const day of this.byDay.keys()) if (day < oldest || day > today) this.byDay.delete(day);
  }
}

/** The kind of refusal an answered exception is, or null when it is none of them. */
export function securityKind(exception: HttpException, path: string): SecurityKind | null {
  const status: number = exception.getStatus();
  const route = path.split('?')[0] ?? '';
  if (status === 429) return 'rate-limited';
  if (status === 403 && route.startsWith('/worlds/')) return 'starter-refused';
  if (exception instanceof PassRefused) return 'pass-refused';
  if (status < 400 || status >= 500) return null;
  if (/^\/worlds\/[^/]+\/(?:seed\/)?certificates\/?$/.test(route)) return 'certificate-refused';
  if (/^\/worlds\/[^/]+\/state\/deliveries\/?$/.test(route)) return 'delivery-refused';
  return null;
}

@Catch(HttpException)
export class SecurityFilter extends BaseExceptionFilter {
  constructor(@Inject(SECURITY_LOG) private readonly log: SecurityLog) {
    super();
  }

  override catch(exception: HttpException, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<IncomingMessage>();
    const kind = securityKind(exception, request.url ?? '');
    if (kind !== null) this.log.count(kind);
    super.catch(exception, host);
  }
}
