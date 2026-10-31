// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A course's week as its teacher signs it (#582, Week-sign, #583, Week-fix,
// §3.3, §5.5, R-3.3-26 to R-3.3-29, R-3.1-08, R-5.5-02, R-5.5-03, answers 565,
// 610 and 611): the week's text is canonical JSON of the week's format, its
// course, first day, version and totals, which the totals above the school
// read, then the class and the subject as the timetable names them and each
// session's day, start, end, group, week and state, held, not held or awaiting
// confirmation, which is never an absence: at least one session, each once, in
// the order of day, start, end, group and week, so one week makes one text, and
// a text that is not canonical does not read. Nothing private: no reason for a
// session not held, no clock time of signing, no place. A correction is the
// whole week again at the next version, one session's state changed, with a
// reason chosen from a short list, confirmed later, an entry error or other, or
// none; version 0 carries none, and a correction that changes nothing is not
// made. What a version changed is each session whose state differs from the
// version before, or that it added or dropped, by its slot: its day, start,
// end, group and week. A version is read as the teacher signed it. A course's
// ID is a MAC under the school's ID, which is not secret, of its class by its
// name key and its subject's country code, so every device that knows the
// school derives the same one, and a subject the timetable names in another
// language stays the same course; a week whose course is not the one its class
// and subject make in the channel's school is neither sealed nor read. A signed
// week goes on the teacher's own channel (#577) sealed under the channel's key,
// which the teacher and the school key's holders read; reading the channel
// keeps the weeks the joined device's certified key signed, each course's week
// once, at its highest version, with every version below it and what signed it,
// oldest first, so both show, one a version, the lower text winning a tie, as
// the totals' does (total-shares.ts), in the order of the week, then the
// course. A record of another format, another key, a week that does not read or
// a signature that does not check is left out.

import type { SealedBatch } from './batches.ts';
import { canonicalJson } from './canonical.ts';
import { checkSignedWeek, type SignedWeek } from './certify.ts';
import type { Day, Weekday } from './day.ts';
import { toHex } from './id.ts';
import type { Joined, JoinCode } from './school-join.ts';
import { ascii } from './school-key-shape.ts';
import { asciiJson, openRecords, sealRecord } from './sealed-stream.ts';
import { timetableNameKey } from './timetable-import.ts';
import { clean, DAY_MINUTES, named, placeOfCode, record, whole, type TimetableCa } from './timetable-record.ts';
import { MOST_WEEK_SESSIONS, readWeekTotals, WEEK_FORMAT, type WeekTotals } from './week-totals.ts';
import type { WorldCipher, WorldMac } from './world-keys.ts';

/** The format a signed week travels under on its teacher's channel. */
export const SIGNED_WEEK_RECORD = 'minhajna/signed-week-record/1';

/** The most batches a signed week may take on a channel. */
export const WEEK_BATCHES = 64;

export const SESSION_STATES = ['held', 'not-held', 'awaiting'] as const;
export type SessionState = (typeof SESSION_STATES)[number];

/** Why a week was corrected, chosen and never typed. */
export const WEEK_FIX_REASONS = ['confirmed-later', 'entry-error', 'other'] as const;
export type WeekFixReason = (typeof WEEK_FIX_REASONS)[number];

/** One session of a signed week, as the timetable gives it, with its state. */
export interface WeekSession {
  readonly day: Weekday;
  /** Minutes from midnight. */
  readonly start: number;
  readonly end: number;
  /** Empty for the whole class. */
  readonly group: string;
  readonly week: 'both' | 'A' | 'B';
  readonly state: SessionState;
}

/** A course's week as its teacher signs it. */
export interface WeekRecord {
  readonly course: string;
  /** The week's first day. */
  readonly week: Day;
  readonly version: number;
  readonly totals: WeekTotals;
  /** The class and the subject as the timetable names them. */
  readonly class: string;
  readonly subject: string;
  readonly sessions: readonly WeekSession[];
  /** A correction's reason, on a version above 0 only, when one was chosen. */
  readonly reason?: WeekFixReason;
}

const WEEKS = ['both', 'A', 'B'] as const;

function readSession(value: unknown): WeekSession | null {
  if (!record(value) || Object.keys(value).length !== 6) return null;
  const { day, start, end, group, week, state } = value;
  if (!whole(day, 0, 6) || !whole(start, 0, DAY_MINUTES - 1) || !whole(end, 1, DAY_MINUTES)) return null;
  if (start >= end || !named(group, true) || clean(group) !== group) return null;
  if (!WEEKS.includes(week as never) || !SESSION_STATES.includes(state as never)) return null;
  return value as unknown as WeekSession;
}

/** Sessions in the order of their day, start, end, group and week, each once. */
const order = (a: WeekSession, b: WeekSession) =>
  a.day - b.day ||
  a.start - b.start ||
  a.end - b.end ||
  (a.group < b.group ? -1 : a.group > b.group ? 1 : 0) ||
  WEEKS.indexOf(a.week) - WEEKS.indexOf(b.week);

/** A week's text as its teacher signs it: canonical JSON of the week's format, its sessions in order. */
export function weekRecordText(week: WeekRecord): string {
  const text = canonicalJson({ format: WEEK_FORMAT, ...week, sessions: [...week.sessions].sort(order) });
  if (readWeekRecord(text) === null) throw new RangeError('Not a week a teacher signs');
  return text;
}

/** The week a signed text holds, its totals and its sessions, or null when it is not one. */
export function readWeekRecord(text: string): WeekRecord | null {
  const totals = readWeekTotals(text);
  if (totals === null) return null;
  const value = JSON.parse(text) as Record<string, unknown>;
  const fix = Object.hasOwn(value, 'reason');
  const keys = ['format', 'course', 'week', 'version', 'totals', 'class', 'subject', 'sessions'];
  if (Object.keys(value).length !== keys.length + (fix ? 1 : 0)) return null;
  if (!keys.every((key) => Object.hasOwn(value, key))) return null;
  const { class: name, subject, sessions, reason } = value;
  if (fix && (totals.version === 0 || !WEEK_FIX_REASONS.includes(reason as never))) return null;
  if (!named(name) || !named(subject) || clean(name) !== name || clean(subject) !== subject) {
    return null;
  }
  if (!Array.isArray(sessions) || sessions.length === 0 || sessions.length > MOST_WEEK_SESSIONS) return null;
  const read = sessions.map(readSession);
  if (read.some((one, at) => one === null || (at > 0 && order(read[at - 1]!, one) >= 0))) return null;
  if (canonicalJson(value) !== text) return null;
  const week = { ...totals, class: name, subject, sessions: read as WeekSession[] };
  return fix ? { ...week, reason: reason as WeekFixReason } : week;
}

/** A session's slot in its week: its day, start, end, group and week, which a correction keeps. */
export const sessionSlot = (one: Omit<WeekSession, 'state'>) =>
  [one.day, one.start, one.end, one.group, one.week].join('\n');

/** A signed week's next version: one session's state changed, with a reason or none; refused when nothing changes. */
export function correctWeek(
  latest: WeekRecord,
  session: Omit<WeekSession, 'state'>,
  state: SessionState,
  reason?: WeekFixReason,
): WeekRecord {
  const at = latest.sessions.findIndex((one) => sessionSlot(one) === sessionSlot(session));
  if (at === -1 || latest.sessions[at]!.state === state) throw new RangeError('A correction changes a session');
  const { course, week, version, totals, class: name, subject } = latest;
  const sessions = latest.sessions.map((one, index) => (index === at ? { ...one, state } : one));
  const next = { course, week, version: version + 1, totals, class: name, subject, sessions };
  return reason === undefined ? next : { ...next, reason };
}

/** A session a version changed: its slot, the state it had and the state it has, null where it was or is not. */
export interface WeekChange {
  readonly slot: Omit<WeekSession, 'state'>;
  readonly before: SessionState | null;
  readonly after: SessionState | null;
}

/** The sessions a version changed from the one before it: a state changed, a session added or a session dropped. */
export function weekChanges(before: WeekRecord, after: WeekRecord): WeekChange[] {
  const states = (week: WeekRecord) => new Map(week.sessions.map((one) => [sessionSlot(one), one.state]));
  const [had, has] = [states(before), states(after)];
  const slots = [...before.sessions, ...after.sessions.filter((one) => !had.has(sessionSlot(one)))];
  return slots
    .map(({ day, start, end, group, week }) => {
      const slot = { day, start, end, group, week };
      return { slot, before: had.get(sessionSlot(slot)) ?? null, after: has.get(sessionSlot(slot)) ?? null };
    })
    .filter((one) => one.before !== one.after);
}

/** A course's ID: a MAC under the school's ID of its class, as its name key reads, and its subject's country code. */
export async function courseId(school: string, name: string, subjectCode: string, mac: WorldMac): Promise<string> {
  const keys = ['minhajna/course', timetableNameKey(name), subjectCode];
  return toHex((await mac(ascii(school), ascii(asciiJson(keys)))).subarray(0, 16));
}

/** Whether a week's course is the one its class and subject make in a school. */
const ofSchool = async (week: WeekRecord, school: string, mac: WorldMac) =>
  week.course === (await courseId(school, week.class, week.totals.subject, mac));

/** A signed week's batches on its code's channel, numbered from `first`. */
export async function sealWeek(
  code: JoinCode,
  signed: SignedWeek,
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<{ readonly stream: string; readonly batches: readonly SealedBatch[] }> {
  const week = readWeekRecord(signed.text);
  if (signed.certificate.world !== code.world || week === null || !(await ofSchool(week, code.school, mac))) {
    throw new RangeError('A week goes on its own school’s channel');
  }
  const place = await placeOfCode(code, mac);
  const { text, signature, certificate } = signed;
  const value = { format: SIGNED_WEEK_RECORD, text, signature, certificate };
  const batches = await sealRecord(place, value, first, WEEK_BATCHES, cipher);
  return { stream: place.stream, batches };
}

/** A version of a week read from a channel, with what signed it. */
export interface WeekVersion {
  readonly week: WeekRecord;
  readonly signed: SignedWeek;
}

/** A week read from a channel at its highest version, with what signed it. */
export interface ChannelWeek extends WeekVersion {
  /** The week's versions below this one, oldest first, one a version, with gaps where none was read. */
  readonly earlier: readonly WeekVersion[];
}

/**
 * The weeks the joined device signed on a code's channel, each course's week
 * once, at its highest version with the versions below it, one a version, the
 * lower text winning a tie as the totals' does, in the order of the week, then
 * the course; none before a device joined.
 */
export async function channelWeeks(
  code: JoinCode,
  batches: readonly SealedBatch[],
  ca: TimetableCa,
  joined: Joined | null,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<ChannelWeek[]> {
  if (joined === null) return [];
  const found = new Map<string, Map<number, WeekVersion>>();
  for (const value of await openRecords(await placeOfCode(code, mac), batches, WEEK_BATCHES, cipher)) {
    if (!record(value) || value['format'] !== SIGNED_WEEK_RECORD || Object.keys(value).length !== 4) continue;
    const { text, signature, certificate } = value;
    const signed = await checkSignedWeek({ text, signature, certificate }, code.world, ca.key, ca.checker);
    if (typeof signed === 'string') continue;
    const { subject, publicKey } = signed.certificate;
    if (subject !== joined.device || publicKey !== joined.certificate.publicKey) continue;
    const week = readWeekRecord(signed.text);
    if (week === null || !(await ofSchool(week, code.school, mac))) continue;
    const versions = found.get(`${week.course}\n${week.week}`) ?? new Map<number, WeekVersion>();
    const before = versions.get(week.version);
    if (before === undefined || signed.text < before.signed.text) versions.set(week.version, { week, signed });
    found.set(`${week.course}\n${week.week}`, versions);
  }
  const latest = (versions: Map<number, WeekVersion>): ChannelWeek => {
    const all = [...versions.values()].sort((a, b) => a.week.version - b.week.version);
    return { ...all.at(-1)!, earlier: all.slice(0, -1) };
  };
  const byWeek = (a: ChannelWeek, b: ChannelWeek) =>
    a.week.week < b.week.week ? -1 : a.week.week > b.week.week ? 1 : a.week.course < b.week.course ? -1 : 1;
  return [...found.values()].map(latest).sort(byWeek);
}
