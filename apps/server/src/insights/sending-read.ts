// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One class's anonymous insights sending as the server takes it (#621,
// answer 675), under the rules packages/core's insights.ts builds it by: its
// format, the class's sending ID for the term and the term's token, each 32 hex
// digits, the school-and-term code in 64, the school year and term, the
// wilaya, grade and subject, the pack and release, the sessions spent on at
// most 512 items, each from 0 to 500, the items merged, skipped, split or
// re-taught, each list in order and once each, all but the split ones among the
// items with sessions, and how far the class got in thousandths, in at most 48
// KB of JSON. A name is never one an object already holds, such as __proto__.
// Anything else is refused with the reason. What the server keeps is the
// sending without its school-and-term code, which it never stores.

import { isName } from '../totals/share-read.js';

export const INSIGHTS_FORMAT = 'minhajna/insights/1';
export const MOST_SENDING_ITEMS = 512;
export const MOST_ITEM_SESSIONS = 500;
export const MOST_SENDING_BYTES = 48 * 1024;
const CHANGE_LISTS = ['merged', 'skipped', 'split', 'retaught'] as const;
const FIELDS = [
  'format',
  'id',
  'token',
  'schoolTerm',
  'year',
  'term',
  'wilaya',
  'grade',
  'subject',
  'pack',
  'release',
  'sessions',
  'changed',
  'reached',
] as const;
const HEX32 = /^[0-9a-f]{32}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const YEAR = /^(\d{4})-(\d{4})$/;
const PACK = /^[a-z]{2}(\.[a-z0-9-]+){4,5}$/;
const RELEASE = /^\d{4}\.\d+$/;

/** A sending as the server keeps it: never its school-and-term code. */
export interface KeptSending {
  readonly format: typeof INSIGHTS_FORMAT;
  readonly id: string;
  readonly token: string;
  readonly year: string;
  readonly term: 1 | 2 | 3;
  readonly wilaya: string;
  readonly grade: string;
  readonly subject: string;
  readonly pack: string;
  readonly release: string;
  readonly sessions: Readonly<Record<string, number>>;
  readonly changed: Readonly<Record<(typeof CHANGE_LISTS)[number], readonly string[]>>;
  readonly reached: number;
}

/** A sending as it arrives. */
export interface Sending extends KeptSending {
  readonly schoolTerm: string;
}

const isMap = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnly = (value: Record<string, unknown>, fields: readonly string[]): boolean =>
  Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field));

const isWhole = (value: unknown, most: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= most;

const inOrder = (items: readonly string[]): boolean => items.every((item, at) => at === 0 || items[at - 1]! < item);

function readFields(value: Record<string, unknown>): string | null {
  const { format, id, token, schoolTerm, year, term, wilaya, grade, subject, pack, release, reached } = value;
  if (format !== INSIGHTS_FORMAT) return `format is ${INSIGHTS_FORMAT}`;
  if (typeof id !== 'string' || !HEX32.test(id)) return 'ID is 32 hex digits';
  if (typeof token !== 'string' || !HEX32.test(token)) return 'token is 32 hex digits';
  if (typeof schoolTerm !== 'string' || !HEX64.test(schoolTerm)) return 'school-and-term code is 64 hex digits';
  if (typeof year !== 'string' || !YEAR.test(year)) return 'year is written YYYY-YYYY';
  if (term !== 1 && term !== 2 && term !== 3) return 'term is 1, 2 or 3';
  if (![wilaya, grade, subject].every(isName)) return 'wilaya, grade and subject are named';
  if (typeof pack !== 'string' || !PACK.test(pack)) return 'pack is a pack’s ID';
  if (typeof release !== 'string' || !RELEASE.test(release)) return 'release is a pack’s release';
  if (!isWhole(reached, 1000)) return 'reached is in thousandths, from 0 to 1000';
  return null;
}

function readSessions(value: unknown): string | null {
  if (!isMap(value)) return 'sessions are an object of items';
  const items = Object.keys(value);
  if (items.length > MOST_SENDING_ITEMS) return `items are at most ${MOST_SENDING_ITEMS}`;
  if (!items.every(isName)) return 'items are named as packs name them';
  if (!items.every((item) => isWhole(value[item], MOST_ITEM_SESSIONS))) {
    return `items take from 0 to ${MOST_ITEM_SESSIONS} sessions each`;
  }
  return null;
}

function readChanged(value: unknown, sessions: Readonly<Record<string, unknown>>): string | null {
  if (!isMap(value) || !hasOnly(value, CHANGE_LISTS)) return `changes are the lists ${CHANGE_LISTS.join(', ')}`;
  for (const list of CHANGE_LISTS) {
    const items = value[list];
    if (!Array.isArray(items) || items.length > MOST_SENDING_ITEMS) {
      return `${list} items are a list of at most ${MOST_SENDING_ITEMS}`;
    }
    if (!items.every(isName) || !inOrder(items)) return `${list} items are named once each, in order`;
    if (list !== 'split' && !items.every((item) => Object.hasOwn(sessions, item))) {
      return `${list} items are among the items with sessions`;
    }
  }
  return null;
}

/** A sending as the server takes it, or why it is refused. */
export function readSending(value: unknown): Sending | string {
  const bytes = Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
  if (bytes > MOST_SENDING_BYTES) return `a sending takes at most ${MOST_SENDING_BYTES} bytes`;
  if (!isMap(value) || !hasOnly(value, FIELDS)) return `a sending holds exactly ${FIELDS.join(', ')}`;
  const problem =
    readFields(value) ??
    readSessions(value['sessions']) ??
    readChanged(value['changed'], value['sessions'] as Record<string, unknown>);
  return problem === null ? (value as unknown as Sending) : `a sending’s ${problem}`;
}

/** The sending as the server keeps it: each of its fields but the school-and-term code, which is dropped. */
export function kept(sending: Sending): KeptSending {
  const { format, id, token, year, term, wilaya, grade, subject, pack, release, sessions, changed, reached } = sending;
  return { format, id, token, year, term, wilaya, grade, subject, pack, release, sessions, changed, reached };
}
