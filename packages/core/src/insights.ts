// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One class's anonymous insights sending for a term (#621, PRD §1.6 and §8.4,
// R-1.6-04, R-8.4-01, choice D6, answers 547 and 675): what was taught, never
// when or why. It holds the class's sending ID for the term, the term's token,
// the school-and-term code, the school year and term, the wilaya, grade and
// subject, the pinned pack and release, the sessions spent on each item over
// the term, the items merged, skipped, split or re-taught, and how far the
// class got by the term's end, in thousandths of its plan. The token is drawn
// at random when the term's first sending is made and is the same for every
// class the teacher sends that term, so the server counts teachers without
// linking terms; the sending ID is drawn for each class and term, so a sending
// sent again replaces the first. The school-and-term code is a hash of the
// wilaya, the school's official code (in a demo world its seeded ID), the year
// and the term, the same for every teacher of the school in a term. In teacher
// mode no secret is shared within a school, so whoever holds a list of schools
// could work the school out from it: the server only counts it in memory and
// drops it (choice D6). Sessions and changes come from one course's weeks,
// those of the term each at its highest version, as their totals give them
// (week-totals.ts), each item's latest word deciding whether it was merged,
// skipped or re-taught, as a school's share does (total-shares.ts), and the
// split items from the class's plan layer; how far it got is its last week's.
// An item's sessions stop at MOST_ITEM_SESSIONS, more than any term holds. No
// date, reason, pupil, or name of a school, class or teacher is ever in it.
// The server reads a sending under the same rules as readSending, and the
// builder checks its own sending with it.

import { addDays, isDay, type Day } from './day.ts';
import type { Digest } from './history.ts';
import { newId, type RandomBytes } from './id.ts';
import { PACK_ID } from './pack.ts';
import { ITEM_ID } from './pack-fields.ts';
import { RELEASE } from './read.ts';
import { ENTRY_ID, YEAR_ID } from './reference-fields.ts';
import type { PinnedPack } from './records.ts';
import { isName } from './share-grades.ts';
import { utf8Length } from './signed-read.ts';
import type { WeekForTotals } from './week-totals.ts';

export const INSIGHTS_FORMAT = 'minhajna/insights/1';
/** The most items one sending holds, in its sessions and in each list of changes. */
export const MOST_SENDING_ITEMS = 512;
/** The most sessions one item takes in a term. */
export const MOST_ITEM_SESSIONS = 500;
/** The most JSON a sending may take, in UTF-8 bytes. */
export const MOST_SENDING_BYTES = 48 * 1024;

export const CHANGE_LISTS = ['merged', 'skipped', 'split', 'retaught'] as const;
export type ChangeList = (typeof CHANGE_LISTS)[number];

const HEX32 = /^[0-9a-f]{32}$/;
const HEX64 = /^[0-9a-f]{64}$/;
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

export interface InsightsSending {
  readonly format: typeof INSIGHTS_FORMAT;
  /** The class's sending ID for the term. */
  readonly id: string;
  /** The term's token. */
  readonly token: string;
  /** The school-and-term code (schoolTermCode), never the school's own code. */
  readonly schoolTerm: string;
  readonly year: string;
  readonly term: 1 | 2 | 3;
  readonly wilaya: string;
  readonly grade: string;
  readonly subject: string;
  readonly pack: string;
  readonly release: string;
  /** Sessions spent on each item over the term, by item ID. */
  readonly sessions: Readonly<Record<string, number>>;
  /** Item IDs, each list in order. */
  readonly changed: Readonly<Record<ChangeList, readonly string[]>>;
  /** How far the class got by the term's end, in thousandths of its plan. */
  readonly reached: number;
}

/** A new term's token: drawn at random, never derived, and kept on the device for that term only. */
export const newTermToken = (random: RandomBytes): string => newId(random);

/** A class's sending ID for a term, kept on the device with the term's token. */
export const newSendingId = (random: RandomBytes): string => newId(random);

export interface SchoolTerm {
  readonly wilaya: string;
  /** The school's official code; in a demo world, its seeded ID. */
  readonly school: string;
  readonly year: string;
  readonly term: 1 | 2 | 3;
}

/** The school-and-term code: the same for every teacher of the school in a term, a different one the next. */
export function schoolTermCode(digest: Digest, { wilaya, school, year, term }: SchoolTerm): Promise<string> {
  return digest(['minhajna/insights/school/1', wilaya, school, year, String(term)].join('\n'));
}

export interface SendingInput {
  readonly id: string;
  readonly token: string;
  /** The school-and-term code (schoolTermCode), never the school's own code. */
  readonly schoolTerm: string;
  readonly year: string;
  readonly term: 1 | 2 | 3;
  readonly wilaya: string;
  readonly grade: string;
  readonly subject: string;
  readonly pack: PinnedPack;
  /** The term's first and last days: a week counts when any of its days falls between them. */
  readonly from: Day;
  readonly to: Day;
  /**
   * One course's weeks, the class in the subject, in any order and versions; each week counts at its highest
   * version, the first given of two alike.
   */
  readonly weeks: readonly WeekForTotals[];
  /** The items the class's plan layer split. */
  readonly split?: readonly string[];
}

const sorted = (items: Iterable<string>): string[] => [...new Set(items)].sort();

/** The course's weeks in the term, each at its highest version, in order; or why they make no sending. */
function termWeeks({ weeks, subject, from, to }: SendingInput): WeekForTotals[] | string {
  if (!isDay(from) || !isDay(to) || to < from) return 'the term runs from its first day to its last';
  if (new Set(weeks.map((week) => week.course)).size > 1) return 'a sending is one course’s';
  if (weeks.some((week) => week.totals.subject !== subject)) return 'the course’s weeks are of another subject';
  const latest = new Map<string, WeekForTotals>();
  for (const week of weeks) {
    if (addDays(week.week, 6) < from || week.week > to) continue;
    if ((latest.get(week.week)?.version ?? -1) < week.version) latest.set(week.week, week);
  }
  const kept = [...latest.values()].sort((a, b) => (a.week < b.week ? -1 : 1));
  return kept.length === 0 ? 'no week of the course is in the term' : kept;
}

/** The class's sending for the term, or why none can be made. */
export function insightsSending(input: SendingInput): InsightsSending | string {
  const weeks = termWeeks(input);
  if (typeof weeks === 'string') return weeks;
  const spent = new Map<string, number>();
  const latest = new Map<string, string>();
  for (const { totals } of weeks) {
    for (const { item, sessions, outcome } of totals.items) {
      spent.set(item, (spent.get(item) ?? 0) + sessions);
      latest.set(item, outcome);
    }
  }
  const items = sorted(spent.keys());
  const sessions = Object.fromEntries(items.map((item) => [item, Math.min(spent.get(item)!, MOST_ITEM_SESSIONS)]));
  const said = (outcome: string) => items.filter((item) => latest.get(item) === outcome);
  return readSending({
    format: INSIGHTS_FORMAT,
    id: input.id,
    token: input.token,
    schoolTerm: input.schoolTerm,
    year: input.year,
    term: input.term,
    wilaya: input.wilaya,
    grade: input.grade,
    subject: input.subject,
    pack: input.pack.id,
    release: input.pack.release,
    sessions,
    changed: {
      merged: said('merged'),
      skipped: said('skipped'),
      split: sorted(input.split ?? []),
      retaught: said('retaught'),
    },
    reached: weeks.at(-1)!.totals.reached,
  });
}

const isMap = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWhole = (value: unknown, most: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= most;

/** Whether an object holds exactly these fields as its own. */
const hasOnly = (value: Record<string, unknown>, fields: readonly string[]): boolean =>
  Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field));

const inOrder = (items: readonly string[]): boolean => items.every((item, at) => at === 0 || items[at - 1]! < item);

function readSessions(value: unknown): string | null {
  if (!isMap(value)) return 'sessions are an object of items';
  const items = Object.keys(value);
  if (items.length > MOST_SENDING_ITEMS) return `items are at most ${MOST_SENDING_ITEMS}`;
  if (!items.every((item) => isName(item, ITEM_ID))) return 'items are named as packs name them';
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
    if (!items.every((item) => isName(item, ITEM_ID)) || !inOrder(items)) {
      return `${list} items are named once each, in order`;
    }
    if (list !== 'split' && !items.every((item) => Object.hasOwn(sessions, item))) {
      return `${list} items are among the items with sessions`;
    }
  }
  return null;
}

/** Why a sending's own fields are refused, or null when they are read right. */
function readFields(value: Record<string, unknown>): string | null {
  const { format, id, token, schoolTerm, year, term, wilaya, grade, subject, pack, release, reached } = value;
  if (format !== INSIGHTS_FORMAT) return `format is ${INSIGHTS_FORMAT}`;
  if (typeof id !== 'string' || !HEX32.test(id)) return 'ID is 32 hex digits';
  if (typeof token !== 'string' || !HEX32.test(token)) return 'token is 32 hex digits';
  if (typeof schoolTerm !== 'string' || !HEX64.test(schoolTerm)) return 'school-and-term code is 64 hex digits';
  if (typeof year !== 'string' || !YEAR_ID.test(year)) return 'year is written YYYY-YYYY';
  if (term !== 1 && term !== 2 && term !== 3) return 'term is 1, 2 or 3';
  if (![wilaya, grade, subject].every((name) => isName(name, ENTRY_ID))) return 'wilaya, grade and subject are named';
  if (typeof pack !== 'string' || !PACK_ID.test(pack)) return 'pack is a pack’s ID';
  if (typeof release !== 'string' || !RELEASE.test(release)) return 'release is a pack’s release';
  if (!isWhole(reached, 1000)) return 'reached is in thousandths, from 0 to 1000';
  return null;
}

/** A sending as the server takes it, or why it is refused. */
export function readSending(value: unknown): InsightsSending | string {
  let text: string;
  try {
    text = JSON.stringify(value ?? null) ?? '';
  } catch {
    return 'a sending is JSON';
  }
  const bytes = text.length > MOST_SENDING_BYTES ? Infinity : utf8Length(text);
  if (bytes === null) return 'a sending is well-formed text';
  if (bytes > MOST_SENDING_BYTES) return `a sending takes at most ${MOST_SENDING_BYTES} bytes`;
  if (!isMap(value) || !hasOnly(value, FIELDS)) return `a sending holds exactly ${FIELDS.join(', ')}`;
  const problem =
    readFields(value) ??
    readSessions(value['sessions']) ??
    readChanged(value['changed'], value['sessions'] as Record<string, unknown>);
  return problem === null ? (value as unknown as InsightsSending) : `a sending’s ${problem}`;
}
