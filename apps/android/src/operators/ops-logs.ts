// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The operators' logs as the console reads them from the demo server (#619,
// answer 656), with the world's pass: the admin log's lines, newest first, by
// day, action and detail, an action the console does not know, or a known one
// whose detail it does not read, kept as one it does not know, so a newer
// server's lines still read; and the security log's counts by day and kind,
// newest first, the kinds it does not know counted together, with how many
// days it keeps. Each answer is checked field by field, and refused when
// shaped otherwise; a world that is gone is said as erased.

import { isDay, type Day } from '@minhajna/core';
import { unexpected, type Send } from '../demo/world-session';
import { goneWorld } from './ops-system';

/** An admin log line as the console shows it. */
export type AdminLine =
  | {
      readonly day: Day;
      readonly action: 'server.started';
      readonly version: string;
      readonly migrations: readonly string[];
    }
  | { readonly day: Day; readonly action: 'worlds.erased'; readonly count: number }
  | { readonly day: Day; readonly action: 'problem.fixed'; readonly problem: string }
  | { readonly day: Day; readonly action: 'other' };

export const SECURITY_KINDS = [
  'rate-limited',
  'pass-refused',
  'starter-refused',
  'certificate-refused',
  'delivery-refused',
] as const;
export type SecurityKind = (typeof SECURITY_KINDS)[number];

export interface SecurityDay {
  readonly day: Day;
  readonly counts: Readonly<Record<SecurityKind, number>>;
  /** The refusals of kinds this app does not know. */
  readonly others: number;
}

const PROBLEM_ID = /^[0-9a-f]{32}$/u;
const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isText = (value: unknown, most: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= most && !/\p{Cc}/u.test(value);
const dayOf = (value: unknown): Day | null => (typeof value === 'string' && isDay(value) ? value : null);
const isKind = (kind: string): kind is SecurityKind => (SECURITY_KINDS as readonly string[]).includes(kind);

/** An admin log line, or null when it is not a line by its day, action and a detail object. */
export function adminLine(value: unknown): AdminLine | null {
  const one = record(value);
  const detail = record(one?.['detail']);
  const day = dayOf(one?.['day']);
  const action = one?.['action'];
  if (detail === null || day === null || typeof action !== 'string') return null;
  const { version, migrations = [], count, problem } = detail;
  if (
    action === 'server.started' &&
    isText(version, 64) &&
    Array.isArray(migrations) &&
    migrations.every((name) => isText(name, 64))
  )
    return { day, action, version, migrations };
  if (action === 'worlds.erased' && isCount(count)) return { day, action, count };
  if (action === 'problem.fixed' && typeof problem === 'string' && PROBLEM_ID.test(problem))
    return { day, action, problem };
  return { day, action: 'other' };
}

/** A security log's day, or null when it is shaped otherwise. */
export function securityDay(value: unknown): SecurityDay | null {
  const one = record(value);
  const counts = record(one?.['counts']);
  const day = dayOf(one?.['day']);
  if (day === null || counts === null) return null;
  const entries = Object.entries(counts);
  if (!entries.every(([, count]) => isCount(count)) || !SECURITY_KINDS.every((kind) => kind in counts)) return null;
  const known = Object.fromEntries(SECURITY_KINDS.map((kind) => [kind, counts[kind]])) as SecurityDay['counts'];
  const others = entries.filter(([kind]) => !isKind(kind)).reduce((sum, [, count]) => sum + (count as number), 0);
  return { day, counts: known, others };
}

/** The admin log's lines, newest first. */
export async function readAdminLog(world: string, send: Send): Promise<AdminLine[]> {
  const answer = await send({ method: 'GET', path: `/worlds/${world}/admin/log` });
  goneWorld(answer);
  const lines = record(answer.body)?.['lines'];
  const read = Array.isArray(lines) ? lines.map(adminLine) : null;
  if (answer.status !== 200 || read === null || read.some((one) => one === null)) throw unexpected(answer);
  return read as AdminLine[];
}

/** The security log's days, newest first, and how many days it keeps. */
export async function readSecurity(
  world: string,
  send: Send,
): Promise<{ readonly keptDays: number; readonly days: SecurityDay[] }> {
  const answer = await send({ method: 'GET', path: `/worlds/${world}/admin/security` });
  goneWorld(answer);
  const body = record(answer.body);
  const days = body?.['days'];
  const keptDays = body?.['keptDays'];
  const read = Array.isArray(days) ? days.map(securityDay) : null;
  if (answer.status !== 200 || !isCount(keptDays) || read === null || read.some((one) => one === null))
    throw unexpected(answer);
  return { keptDays, days: read as SecurityDay[] };
}
