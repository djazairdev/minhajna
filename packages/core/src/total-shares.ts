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
// long). Which signed weeks count is share-weeks.ts's: under the keys the
// school lists for each course, the latest correction of each, named as the
// server takes names, and with a day in the term up to the announced day, but
// for how far each grade got, given when the school's plans are
// (share-grades.ts, answer 631), which takes each class's position over the
// year's weeks up to the day, the last subjects' grades left out when the share
// would take more than SHARE_BYTES. Each week's sums go to its own subject; a
// class counts under its latest week's subject, and how far it got is that
// week's. A share has no row for a teacher or a class. In the demo the server
// sees each school's share before adding them up, and keeps only figures above
// the floors; cryptographic secure aggregation comes later (choice D2). A
// share's ID is a MAC under the school key's first epoch for its day, so a
// share sent again replaces the first and the ID links no two days; a device
// removed from the school key can still work it out (answer 567). A seeded
// school's share is prepared the same way from the term generator's weeks
// worked out up to the day, which are never signed, by the device that started
// the world (answer 628).

import { isSigningKey, type KeyChecker } from './certify.ts';
import { utf8Length } from './signed-read.ts';
import { addDays, compareDays, isDay, type Day } from './day.ts';
import { toHex } from './id.ts';
import { ENTRY_ID } from './reference-fields.ts';
import { ascii, ID, type KeyCrypto } from './school-key-shape.ts';
import { purposeKey, type OpenedKeyring } from './school-key.ts';
import { checkPlans, gradeReach, isName, shareable, type CoursePlan, type GradeReach } from './share-grades.ts';
import { countedWeeks } from './share-weeks.ts';
import type { ItemOutcome, WeekForTotals } from './week-totals.ts';

export const SHARE_FORMAT = 'minhajna/total-share/1';
/** The most JSON a share may take, in bytes, as the server takes it. */
export const SHARE_BYTES = 256 * 1024;

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
  /** By grade, in order, when the school's plans are given (share-grades.ts). */
  readonly grades?: Readonly<Record<string, GradeReach>>;
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
   * By course, the signing keys (SPKI in base64) that may sign its weeks, as the
   * school's records keep them when a device joins: the teacher's, and a new
   * phone's once it rejoins (#564, #566).
   */
  readonly signers: Readonly<Record<string, readonly string[]>>;
  /** The world's CA, which the weeks' certificates check against. */
  readonly ca: { readonly world: string; readonly key: string; readonly checker: KeyChecker };
  /** By subject, from the school's assignments. */
  readonly staffing: Readonly<Record<string, Staffing>>;
  /** By course, its class's grade, its teacher and its pinned pack's items, to give how far each grade got. */
  readonly plans?: Readonly<Record<string, CoursePlan>>;
  /** The school year's first day, from which each class's position in its plan is taken; the term's when not given. */
  readonly yearFrom?: Day;
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

const isMap = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isStaffing(value: unknown): value is Staffing {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const counts = Object.entries(value);
  const fields = ['teachers', 'vacantPosts', 'hoursWithoutTeacher'];
  if (counts.length !== fields.length || !counts.every(([name]) => fields.includes(name))) return false;
  return counts.every(([, count]) => Number.isSafeInteger(count) && (count as number) >= 0);
}

type Common = Pick<ShareInput, 'school' | 'day' | 'from' | 'directorate' | 'staffing' | 'plans' | 'yearFrom'>;

/** Refuses a share's day, term, directorate or staffing written otherwise. */
function checkCommon({ day, from, directorate, staffing, plans, yearFrom = from }: Common): void {
  if (
    !isDay(day) ||
    !isDay(from) ||
    from > day ||
    !isName(directorate, ENTRY_ID) ||
    !isDay(yearFrom) ||
    yearFrom > from
  ) {
    throw new RangeError('A share names its directorate and its term');
  }
  if (plans !== undefined) checkPlans(plans);
  const names = isMap(staffing) ? Object.keys(staffing) : [''];
  if (!names.every((name) => isName(name, ENTRY_ID) && isStaffing(staffing[name]))) {
    throw new RangeError('Staffing is counted by subject');
  }
}

/**
 * The share of each course's weeks over the year up to the day, each course's in order, its figures from those in
 * the term, with the staffing and, when plans are given, how far each grade got, under its ID for the day.
 */
async function shareOf(input: Common, year: WeekForTotals[][], crypto: KeyCrypto): Promise<TotalsShare> {
  const { school, day, directorate, staffing, from, plans } = input;
  const courses = year
    .map((weeks) => weeks.filter((one) => addDays(one.week, 6) >= from))
    .filter((one) => one.length > 0);
  const tallies = tally(courses);
  const reach =
    plans === undefined ? null : gradeReach(courses, new Map(year.map((weeks) => [weeks[0]!.course, weeks])), plans);
  const names = Object.keys(staffing);
  const rows = [...new Set([...tallies.keys(), ...names])].map((subject) => {
    const { items, ...sums } = tallies.get(subject) ?? newTally();
    const { teachers, vacantPosts, hoursWithoutTeacher } = staffing[subject] ?? {
      teachers: 0,
      vacantPosts: 0,
      hoursWithoutTeacher: 0,
    };
    const figures: SubjectShare = { teachers, vacantPosts, hoursWithoutTeacher, ...sums, items: sorted(items) };
    return { subject, figures, grades: reach?.get(subject) };
  });
  const key = await purposeKey(school, 0, 'total-shares', crypto);
  const id = toHex(await crypto.mac(key, ascii(`minhajna/total-share\n${school.ring.school}\n${day}`)));
  const shareWithout = (dropped: ReadonlySet<string>): TotalsShare => {
    const subjects = rows.map(({ subject, figures, grades }): [string, SubjectShare] => [
      subject,
      grades === undefined || dropped.has(subject) ? figures : { ...figures, grades },
    ]);
    return { format: SHARE_FORMAT, id, day, directorate, subjects: sorted(subjects) };
  };
  const dropped = new Set<string>();
  for (const { subject } of [...rows].sort((a, b) => (a.subject < b.subject ? 1 : -1))) {
    if (utf8Length(JSON.stringify(shareWithout(dropped)))! <= SHARE_BYTES) break;
    dropped.add(subject);
  }
  return shareWithout(dropped);
}

/** The school's share for an announced day, prepared on a device that holds the school key. */
export async function prepareShare(input: ShareInput, crypto: KeyCrypto): Promise<TotalsShare> {
  checkCommon(input);
  const isKeys = (keys: unknown) => Array.isArray(keys) && keys.every(isSigningKey);
  const listed = isMap(input.signers) ? Object.entries(input.signers) : [['', null] as const];
  if (!listed.every(([course, keys]) => ID.test(course) && isKeys(keys))) {
    throw new RangeError('Signers are listed by course and key');
  }
  return shareOf(input, await countedWeeks({ ...input, from: input.yearFrom ?? input.from }), crypto);
}

/**
 * A seeded school's share for an announced day, from the term generator's weeks worked out up to that day
 * (seeded-term.ts) rather than signed ones, each course's weeks counted at their latest version.
 */
export async function seededShare(
  input: Common & { readonly weeks: readonly { readonly versions: readonly WeekForTotals[] }[] },
  crypto: KeyCrypto,
): Promise<TotalsShare> {
  checkCommon(input);
  const { yearFrom = input.from, day } = input;
  const courses = new Map<string, WeekForTotals[]>();
  for (const { versions } of input.weeks) {
    const latest = versions.at(-1);
    if (latest === undefined || !shareable(latest) || addDays(latest.week, 6) < yearFrom || latest.week > day) continue;
    courses.set(latest.course, [...(courses.get(latest.course) ?? []), latest]);
  }
  const inOrder = [...courses.values()].map((weeks) => weeks.sort((a, b) => compareDays(a.week, b.week)));
  return shareOf(input, inOrder, crypto);
}
