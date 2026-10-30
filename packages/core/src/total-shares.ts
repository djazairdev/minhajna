// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Each school's share of the totals above the school (#555, PRD §5.10 and §7.9,
// R-5.10-10, answers 545, 566 and 567), prepared on a device that holds the
// school key from the school's signed weeks, each checked here against the
// world's CA (certify.ts), and from the school's records: which signing keys
// may sign each course's weeks, and the assignments. For each subject it gives
// the teachers its assignments name, the classes its weeks record, and the sums
// of what the system owes teachers (cover given in its classes, vacant posts,
// weekly hours without a teacher, sessions lost to closures) and of the
// curriculum report (sessions per plan item, the classes whose latest word on
// it is merged, skipped or re-taught, how far classes got, and plans that run
// long). A week counts only when signed with a key the school lists for its
// course, whatever device its certificate names, so no other signer adds or
// replaces one; of each week only the latest correction counts, the lower
// signature breaking a tie; and only weeks with a day in the term up to the
// announced day. Each week's sums go to its own subject; a class counts under
// its latest week's subject, and how far it got is that week's. A share has no
// row for a teacher or a class. In the demo the server sees each school's share
// before adding them up, and keeps only figures above the floors; cryptographic
// secure aggregation comes later (choice D2). A share's ID is a MAC under the
// school key's first epoch for its day, so a share sent again replaces the
// first and the ID links no two days; a device removed from the school key can
// still work it out (answer 567).

import { checkSignedWeek, type KeyChecker } from './certify.ts';
import { addDays, isDay, type Day } from './day.ts';
import { toHex } from './id.ts';
import { ENTRY_ID } from './reference-fields.ts';
import { ascii, ID, type KeyCrypto } from './school-key-shape.ts';
import { purposeKey, type OpenedKeyring } from './school-key.ts';
import { readWeekTotals, WEEK_TEXT_BYTES, type ItemOutcome, type WeekForTotals } from './week-totals.ts';

export const SHARE_FORMAT = 'minhajna/total-share/1';

/** What a school's assignments show for a subject. */
export interface Staffing {
  readonly teachers: number;
  readonly vacantPosts: number;
  readonly hoursWithoutTeacher: number;
}

/** A plan item: its sessions, and the classes whose latest word on it is merged, skipped or re-taught. */
export interface ItemShare {
  readonly sessions: number;
  readonly merged: number;
  readonly skipped: number;
  readonly retaught: number;
}

export interface SubjectShare extends Staffing {
  /** Courses: one class in this subject. */
  readonly classes: number;
  /** The classes' sessions that another teacher gave as cover. */
  readonly cover: number;
  readonly closed: number;
  /** How far the classes got in their plans, in thousandths, added up over the classes. */
  readonly reached: number;
  readonly runLong: number;
  /** By item, in order. */
  readonly items: Readonly<Record<string, ItemShare>>;
}

export interface TotalsShare {
  readonly format: typeof SHARE_FORMAT;
  readonly id: string;
  /** The announced day it is prepared for. */
  readonly day: Day;
  readonly directorate: string;
  /** By subject, in order. */
  readonly subjects: Readonly<Record<string, SubjectShare>>;
}

export interface ShareInput {
  readonly school: OpenedKeyring;
  readonly day: Day;
  /** The term's first day. */
  readonly from: Day;
  readonly directorate: string;
  /** The school's signed weeks, as its space holds them. */
  readonly weeks: readonly unknown[];
  /**
   * By course, the signing keys (in hex) that may sign its weeks, as the
   * school's records keep them when a device joins: the teacher's, and a new
   * phone's once it rejoins (#564, #566).
   */
  readonly signers: Readonly<Record<string, readonly string[]>>;
  /** The world's CA, which the weeks' certificates check against. */
  readonly ca: { readonly world: string; readonly key: string; readonly checker: KeyChecker };
  /** By subject, from the school's assignments. */
  readonly staffing: Readonly<Record<string, Staffing>>;
}

interface Checked {
  readonly read: WeekForTotals;
  readonly signature: string;
}

type ItemCount = { -readonly [K in keyof ItemShare]: number };

interface Tally {
  classes: number;
  cover: number;
  closed: number;
  reached: number;
  runLong: number;
  items: Map<string, ItemCount>;
}

const newTally = (): Tally => ({ classes: 0, cover: 0, closed: 0, reached: 0, runLong: 0, items: new Map() });

/** Whether `a` comes before `b` among a course's weeks: an earlier week, a lower version, a lower signature. */
function before(a: Checked, b: Checked): boolean {
  if (a.read.week !== b.read.week) return a.read.week < b.read.week;
  if (a.read.version !== b.read.version) return a.read.version < b.read.version;
  return a.signature < b.signature;
}

const tooLong = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  'text' in value &&
  typeof value.text === 'string' &&
  value.text.length > WEEK_TEXT_BYTES;

/** Each course's weeks that count, in order: under its listed keys, the latest correction of each, in the term. */
async function countedWeeks({ weeks, signers, ca, from, day }: ShareInput): Promise<WeekForTotals[][]> {
  const latest = new Map<string, Checked>();
  for (const value of weeks) {
    if (tooLong(value)) continue;
    const signed = await checkSignedWeek(value, ca.world, ca.key, ca.checker);
    const read = typeof signed === 'string' ? null : readWeekTotals(signed.text);
    if (typeof signed === 'string' || read === null) continue;
    const { course, week, version } = read;
    if (!signers[course]?.includes(signed.certificate.publicKey) || addDays(week, 6) < from || week > day) continue;
    const one = { read, signature: signed.signature };
    const held = latest.get(`${course}\n${week}`);
    const kept = held?.read.version ?? -1;
    if (kept > version || (kept === version && held!.signature < one.signature)) continue;
    latest.set(`${course}\n${week}`, one);
  }
  const courses = new Map<string, WeekForTotals[]>();
  for (const { read } of [...latest.values()].sort((a, b) => (before(a, b) ? -1 : 1))) {
    courses.set(read.course, [...(courses.get(read.course) ?? []), read]);
  }
  return [...courses.values()];
}

function tally(courses: readonly WeekForTotals[][]): Map<string, Tally> {
  const subjects = new Map<string, Tally>();
  const of = (subject: string): Tally => {
    const one = subjects.get(subject) ?? newTally();
    subjects.set(subject, one);
    return one;
  };
  for (const weeks of courses) {
    const last = weeks.at(-1)!.totals;
    const one = of(last.subject);
    one.classes += 1;
    one.reached += last.reached;
    if (last.runsLong) one.runLong += 1;
    const outcomes = new Map<string, { subject: string; outcome: ItemOutcome }>();
    for (const { totals } of weeks) {
      const own = of(totals.subject);
      own.cover += totals.covered;
      own.closed += totals.closed;
      for (const { item, sessions, outcome } of totals.items) {
        const held = own.items.get(item) ?? { sessions: 0, merged: 0, skipped: 0, retaught: 0 };
        own.items.set(item, held);
        held.sessions += sessions;
        outcomes.set(item, { subject: totals.subject, outcome });
      }
    }
    for (const [item, { subject, outcome }] of outcomes) {
      if (outcome !== 'taught') of(subject).items.get(item)![outcome] += 1;
    }
  }
  return subjects;
}

function sorted<T>(entries: Iterable<[string, T]>): Record<string, T> {
  return Object.fromEntries([...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

const KEY = /^[0-9a-f]{64}$/u;

const isMap = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isStaffing(value: unknown): value is Staffing {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const counts = Object.entries(value);
  const fields = ['teachers', 'vacantPosts', 'hoursWithoutTeacher'];
  if (counts.length !== fields.length || !counts.every(([name]) => fields.includes(name))) return false;
  return counts.every(([, count]) => Number.isSafeInteger(count) && (count as number) >= 0);
}

/** The school's share for an announced day, prepared on a device that holds the school key. */
export async function prepareShare(input: ShareInput, crypto: KeyCrypto): Promise<TotalsShare> {
  const { school, day, from, directorate, staffing } = input;
  if (!isDay(day) || !isDay(from) || from > day || !ENTRY_ID.test(directorate)) {
    throw new RangeError('A share names its directorate and its term');
  }
  const names = isMap(staffing) ? Object.keys(staffing) : [''];
  if (!names.every((name) => ENTRY_ID.test(name) && isStaffing(staffing[name]))) {
    throw new RangeError('Staffing is counted by subject');
  }
  const isKeys = (keys: unknown) =>
    Array.isArray(keys) && keys.every((one) => typeof one === 'string' && KEY.test(one));
  const listed = isMap(input.signers) ? Object.entries(input.signers) : [['', null] as const];
  if (!listed.every(([course, keys]) => ID.test(course) && isKeys(keys))) {
    throw new RangeError('Signers are listed by course and key');
  }
  const tallies = tally(await countedWeeks(input));
  const subjects = [...new Set([...tallies.keys(), ...names])].map((subject): [string, SubjectShare] => {
    const { items, ...sums } = tallies.get(subject) ?? newTally();
    const { teachers, vacantPosts, hoursWithoutTeacher } = staffing[subject] ?? {
      teachers: 0,
      vacantPosts: 0,
      hoursWithoutTeacher: 0,
    };
    return [subject, { teachers, vacantPosts, hoursWithoutTeacher, ...sums, items: sorted(items) }];
  });
  const key = await purposeKey(school, 0, 'total-shares', crypto);
  const id = toHex(await crypto.mac(key, ascii(`minhajna/total-share\n${school.ring.school}\n${day}`)));
  return { format: SHARE_FORMAT, id, day, directorate, subjects: sorted(subjects) };
}
