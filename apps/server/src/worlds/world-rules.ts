// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the server accepts for a world (choice D3 of the 0.7.0 demo): an id of
// five characters from the world code's alphabet, a sealed world in base64url,
// a date and the announced days the date moves through, and the world's pass,
// which the device derives from the code's secret; later, the announced days
// after the date that a published calendar gives (#608). The server keeps the
// pass and the starter token only as hashes: whoever reads the store can
// neither enter the world nor move its date.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const WORLD_ID = /^[0-9A-HJKMNP-TV-Z]{5}$/;
const SEALED = /^[A-Za-z0-9_-]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PASS = /^[A-Za-z0-9_-]{43}$/;

export const MAX_SEALED = 48 * 1024;
export const MAX_ANNOUNCED_DAYS = 400;

export interface WorldStart {
  readonly id: string;
  readonly sealed: string;
  readonly date: string;
  readonly announcedDays: readonly string[];
  readonly passHash: string;
}

export function isWorldId(text: unknown): text is string {
  return typeof text === 'string' && WORLD_ID.test(text);
}

/** A calendar day written YYYY-MM-DD that exists. */
export function isDay(text: unknown): text is string {
  if (typeof text !== 'string' || !DATE.test(text)) return false;
  const [year, month, day] = text.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** The start request as the server keeps it, or why it was refused. */
export function readWorldStart(body: unknown): WorldStart | string {
  if (typeof body !== 'object' || body === null) return 'the request must be a JSON object';
  const { world, sealed, date, announcedDays, pass } = body as Record<string, unknown>;
  if (!isWorldId(world)) return 'world must be the first five characters of a world code';
  if (typeof sealed !== 'string' || !SEALED.test(sealed) || sealed.length > MAX_SEALED) {
    return `sealed must be base64url, at most ${MAX_SEALED} characters`;
  }
  if (!isDay(date)) return 'date must be a day written YYYY-MM-DD';
  if (!Array.isArray(announcedDays) || announcedDays.length > MAX_ANNOUNCED_DAYS || !announcedDays.every(isDay)) {
    return `announcedDays must list at most ${MAX_ANNOUNCED_DAYS} days written YYYY-MM-DD`;
  }
  if (typeof pass !== 'string' || !PASS.test(pass)) return 'pass must be 32 bytes in base64url';
  return { id: world, sealed, date, announcedDays: [...new Set(announcedDays)].sort(), passHash: hashToken(pass) };
}

/**
 * The announced days a world keeps once a device sends those after its date:
 * the days on or before the date as they were, then the days sent, each after
 * the date, sorted once each; or why they were refused, such as for a field
 * other than the days.
 */
export function readLaterDays(body: unknown, date: string, kept: readonly string[]): string[] | string {
  const fields = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  if (Object.keys(fields).some((key) => key !== 'announcedDays')) return 'only announcedDays may be sent';
  const { announcedDays } = fields;
  const before = kept.filter((day) => day <= date);
  if (
    !Array.isArray(announcedDays) ||
    !announcedDays.every((day) => isDay(day) && day > date) ||
    before.length + new Set(announcedDays).size > MAX_ANNOUNCED_DAYS
  ) {
    return `announcedDays must list days after the date, written YYYY-MM-DD, at most ${MAX_ANNOUNCED_DAYS} in all`;
  }
  return [...before, ...new Set(announcedDays as string[])].sort();
}

/** The first announced day after the world's date, or null when none is left. */
export function nextAnnouncedDay(date: string, announcedDays: readonly string[]): string | null {
  return announcedDays.find((day) => day > date) ?? null;
}

export function newStarterToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Whether the X-World-Pass header carries the pass whose hash the world keeps. */
export function holdsPass(header: string | undefined, passHash: string): boolean {
  if (typeof header !== 'string' || !PASS.test(header)) return false;
  return timingSafeEqual(Buffer.from(hashToken(header), 'hex'), Buffer.from(passHash, 'hex'));
}

/** Whether the Authorization header carries the token whose hash the world keeps. */
export function holdsStarter(authorization: string | undefined, starterHash: string): boolean {
  const token = /^Bearer +([A-Za-z0-9_-]{1,128})$/i.exec(authorization ?? '')?.[1];
  if (!token) return false;
  return timingSafeEqual(Buffer.from(hashToken(token), 'hex'), Buffer.from(starterHash, 'hex'));
}
