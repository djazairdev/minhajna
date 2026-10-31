// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Issue's records in a demo world's store (#570, §7.5, answers 596 and
// 597): the school key this device holds, kept with its agreement pair and the
// keyring as it holds it, the latest that reads counting, its school named by
// the space ID the device drew; each assignment named by an HMAC, keyed by
// the space, of the seeded teacher's ID; and each joining code or
// security key it issued for an assignment, the first that reads of each issue
// counting and the highest issue being the assignment's current one. A code is
// valid for seven days from the day it was issued, to be printed and handed
// over; a security key, by its four-digit number, never given twice in the
// school, has no last day. Cancelling a code is issuing the next. Each of the
// school's teachers is a row, by subject then name in the screen's language:
// by phone or by security key, and the current issue's standing, none yet,
// waiting to be scanned, expired, or joined on the day the first joined
// record on its channel was certified. Nothing here records when anyone
// signed in. They are device-layer events, so nothing exports them.

import { addDays, type Day } from './day.ts';
import type { DemoTeacher } from './demo-world.ts';
import type { SchoolHeld, SchoolIssued } from './device-events.ts';
import { eventOf } from './events.ts';
import type { Entry } from './history.ts';
import { toHex, type RandomBytes } from './id.ts';
import { ascii, ID, isKeyring, SCHOOL } from './school-key-shape.ts';
import { PKCS8_TEXT, toBase64Url, type WorldMac } from './world-keys.ts';

export type { SchoolHeld, SchoolIssued } from './device-events.ts';

/** How many days a joining code stays valid, from the day it is issued. */
export const CODE_DAYS = 7;
const MOST = 999_999_999;
const HEX = /^[0-9a-f]+$/u;
const KEY_NUMBER = /^\d{4}$/u;
const KEY_NUMBERS = 10_000;
/** The draws of two bytes below this give each key number as often. */
const FAIR_DRAWS = 60_000;

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A held school key as the store may keep it, or null when it does not read. */
export function readSchoolHeld(value: unknown, publicKeyBytes: number): SchoolHeld | null {
  if (!record(value)) return null;
  const { school, device, publicKey, pkcs8, ring, ...rest } = value;
  if (Object.keys(rest).length > 0 || typeof school !== 'string' || !SCHOOL.test(school)) return null;
  if (typeof device !== 'string' || !ID.test(device) || typeof pkcs8 !== 'string' || !PKCS8_TEXT.test(pkcs8)) {
    return null;
  }
  if (typeof publicKey !== 'string' || publicKey.length !== publicKeyBytes * 2 || !HEX.test(publicKey)) return null;
  if (!isKeyring(ring, publicKeyBytes) || ring.school !== school) return null;
  if (!ring.holders.some((one) => one.id === device && one.publicKey === publicKey)) return null;
  return { school, device, publicKey, pkcs8, ring };
}

/**
 * The school key this store holds for a school, the latest that reads, or null; a later record that does not read
 * leaves the one before it held.
 */
export function keptHeld(entries: readonly Entry[], school: string, publicKeyBytes: number): SchoolHeld | null {
  return heldIn(entries, publicKeyBytes, school);
}

/** The school key this store holds, of whichever school, the latest that reads, or null (answer 597). */
export function latestHeld(entries: readonly Entry[], publicKeyBytes: number): SchoolHeld | null {
  return heldIn(entries, publicKeyBytes, null);
}

function heldIn(entries: readonly Entry[], publicKeyBytes: number, school: string | null): SchoolHeld | null {
  let held: SchoolHeld | null = null;
  for (const entry of entries) {
    const event = eventOf(entry);
    if (event?.kind !== 'school.held') continue;
    const read = readSchoolHeld(event.held, publicKeyBytes);
    if (read !== null && (school === null || read.school === school)) held = read;
  }
  return held;
}

/** A new school space's ID, as the director's device draws it: 16 random bytes in base64url. */
export const newSchoolSpace = (random: RandomBytes): string => toBase64Url(random(16));

/** A seeded teacher's assignment ID in a school's space: 16 bytes of an HMAC keyed by the space, in hex. */
export async function assignmentId(school: string, teacher: string, mac: WorldMac): Promise<string> {
  const made = await mac(ascii(school), ascii(`minhajna/demo/assignment\n${teacher}`));
  return toHex(made.subarray(0, 16));
}

/** An issued code or key as the store may keep it, or null when it does not read. */
export function readSchoolIssued(value: unknown): SchoolIssued | null {
  if (!record(value)) return null;
  const { school, assignment, issue, epoch, access, keyNumber, ...rest } = value;
  if (Object.keys(rest).length > 0 || typeof school !== 'string' || !SCHOOL.test(school)) return null;
  if (typeof assignment !== 'string' || !ID.test(assignment)) return null;
  const counts = (one: unknown, least: number): one is number =>
    Number.isSafeInteger(one) && (one as number) >= least && (one as number) <= MOST;
  if (!counts(issue, 1) || !counts(epoch, 0)) return null;
  if (access === 'phone' && keyNumber === null) return { school, assignment, issue, epoch, access, keyNumber };
  if (access === 'key' && typeof keyNumber === 'string' && KEY_NUMBER.test(keyNumber)) {
    return { school, assignment, issue, epoch, access, keyNumber };
  }
  return null;
}

/** An issue as kept, with the day it was issued. */
export interface KeptIssue extends SchoolIssued {
  readonly day: Day;
}

/** How a code or key's joined standing is looked up: by assignment and issue. */
export const joinedKey = (assignment: string, issue: number) => `${assignment}:${issue}`;

/** Every issue in this store for a school, the first that reads of each, in the order kept, with its day. */
export function issuesIn(entries: readonly Entry[], school: string): KeptIssue[] {
  const found = new Map<string, KeptIssue>();
  for (const entry of entries) {
    const event = eventOf(entry);
    const read = event?.kind === 'school.issued' ? readSchoolIssued(event.issued) : null;
    const at = read === null ? '' : joinedKey(read.assignment, read.issue);
    if (read?.school === school && !found.has(at)) found.set(at, { ...read, day: entry.day });
  }
  return [...found.values()];
}

/** Each assignment's current issue in this store for a school: the highest, the first that reads of each. */
export function keptIssues(entries: readonly Entry[], school: string): ReadonlyMap<string, KeptIssue> {
  const current = new Map<string, KeptIssue>();
  for (const read of issuesIn(entries, school)) {
    const before = current.get(read.assignment);
    if (before === undefined || read.issue > before.issue) current.set(read.assignment, read);
  }
  return current;
}

/** The issue a new code or key for an assignment takes. */
export const nextIssue = (issues: ReadonlyMap<string, KeptIssue>, assignment: string): number =>
  (issues.get(assignment)?.issue ?? 0) + 1;

/** Every security key number this store gave out for a school, a lost key's included. */
export function keyNumbers(entries: readonly Entry[], school: string): ReadonlySet<string> {
  return new Set(issuesIn(entries, school).flatMap((one) => (one.keyNumber === null ? [] : [one.keyNumber])));
}

/** A new security key's four-digit number, each as likely, none of those given out; it throws when none is left. */
export function newKeyNumber(random: RandomBytes, taken: ReadonlySet<string>): string {
  if (taken.size >= KEY_NUMBERS) throw new RangeError('No security key number is left');
  for (;;) {
    const [high = 0, low = 0] = random(2);
    const drawn = (high << 8) | low;
    if (drawn >= FAIR_DRAWS) continue;
    const number = String(drawn % KEY_NUMBERS).padStart(4, '0');
    if (!taken.has(number)) return number;
  }
}

/** Where an assignment's current code or key stands on a day. */
export type IssueStatus =
  | { readonly kind: 'none' }
  | { readonly kind: 'waiting'; readonly until: Day | null }
  | { readonly kind: 'expired'; readonly until: Day }
  | { readonly kind: 'joined'; readonly on: Day };

/** A teacher's row in D-Issue. */
export interface IssueRow {
  readonly teacher: DemoTeacher;
  readonly assignment: string | null;
  readonly access: 'phone' | 'key';
  readonly keyNumber: string | null;
  readonly issue: KeptIssue | null;
  readonly status: IssueStatus;
}

/**
 * The school's teachers as D-Issue lists them, by subject then name as `name` words and compares them, each with
 * the assignment `assignments` gives its ID.
 */
export function issueRows(
  teachers: readonly DemoTeacher[],
  assignments: ReadonlyMap<string, string>,
  issues: ReadonlyMap<string, KeptIssue>,
  joined: ReadonlyMap<string, Day>,
  today: Day,
  name: {
    readonly subject: (code: string) => string;
    readonly person: (teacher: DemoTeacher) => string;
    /** The screen's language's order, such as an `Intl.Collator`'s compare. */
    readonly compare: (one: string, other: string) => number;
  },
): IssueRow[] {
  const status = (issue: KeptIssue | null): IssueStatus => {
    if (issue === null) return { kind: 'none' };
    const on = joined.get(joinedKey(issue.assignment, issue.issue));
    if (on !== undefined) return { kind: 'joined', on };
    if (issue.access === 'key') return { kind: 'waiting', until: null };
    const until = addDays(issue.day, CODE_DAYS);
    return today <= until ? { kind: 'waiting', until } : { kind: 'expired', until };
  };
  return [...teachers]
    .sort(
      (one, other) =>
        name.compare(name.subject(one.subject), name.subject(other.subject)) ||
        name.compare(name.person(one), name.person(other)),
    )
    .map((teacher) => {
      const assignment = assignments.get(teacher.id) ?? null;
      const issue = (assignment === null ? undefined : issues.get(assignment)) ?? null;
      const keyNumber = issue?.keyNumber ?? null;
      return { teacher, assignment, access: issue?.access ?? 'phone', keyNumber, issue, status: status(issue) };
    });
}

/** The counts D-Issue's filter shows: every teacher, by phone, and by security key. */
export function issueCounts(rows: readonly IssueRow[]) {
  const key = rows.filter((one) => one.access === 'key').length;
  return { all: rows.length, phone: rows.length - key, key };
}
