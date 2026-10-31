// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a handover to a substitute (class-handover.ts, #587) and the classes'
// return to their holder (class-return.ts, #588) share, in the school's space
// (§7.5, R-7.5-07, answers 615 and 616): a record naming the appointment, the
// holder's and the substitute's names as the staff list writes them, the
// decision, the first day and the classes, each named once, and carrying some
// signed weeks of one of those classes as their teacher signed them, with the
// ID of the sending it was put in, its place among that class's records of that
// sending and how many there are, at most 64 a record so a record fits the 128
// batches the server takes in one request; such a record is sealed only on its
// own code's channel. An appointment's records join under the first's
// certificate subject, the director's device, repeating what it says, so
// records sent again after a reload, under a new key, join it; its weeks are
// those that check under the world's CA, of the channel's school and of their
// record's class, signed by neither the joined device's subject or key nor the
// records' subject or keys, each course's week once at its highest version, the
// lower text winning a tie; and the classes all of whose records of one sending
// arrived are said.

import type { SealedBatch } from './batches.ts';
import { checkSignedWeek, isCertificate, type Certificate, type SignedWeek } from './certify.ts';
import { isDay, type Day } from './day.ts';
import type { JoinCode } from './school-join.ts';
import { ID } from './school-key-shape.ts';
import { distinctClasses, isDecision, SUBSTITUTION_CLASSES } from './school-substitution.ts';
import { sealRecord } from './sealed-stream.ts';
import { timetableNameKey } from './timetable-import.ts';
import { onChannel } from './timetable-package.ts';
import { clean, named, placeOfCode, record, whole } from './timetable-record.ts';
import type { OnChannel, SignedTimetable, TimetableCa } from './timetable-record.ts';
import { ofSchool, readWeekRecord, type WeekRecord, type WeekVersion } from './week-record.ts';
import type { WorldCipher, WorldMac } from './world-keys.ts';

/** The most batches one record passing classes may take on a channel, as many as the server takes in one request. */
export const HANDOVER_BATCHES = 128;

/** The most signed weeks one record carries; more go in several records. */
export const HANDOVER_WEEKS = 64;

/** The most records one class's weeks take in one sending. */
export const HANDOVER_PARTS = 64;

/** A record passing classes between a holder and a substitute, with some signed weeks of one of them. */
export interface PassedClasses extends OnChannel {
  /** The appointment's ID in the director's store. */
  readonly appointment: string;
  /** The holder's and the substitute's names, as the staff list writes them. */
  readonly holder: string;
  readonly substitute: string;
  readonly decision: string;
  readonly from: Day;
  readonly classes: readonly string[];
  /** The class this record carries weeks of, one of the classes. */
  readonly class: string;
  /** The sending this record belongs to, one ID for every record put at once. */
  readonly sending: string;
  /** This record's place among the records that carry that class's weeks in one sending, from 0, and how many. */
  readonly part: number;
  readonly parts: number;
  /** Some signed weeks of that class, as their teacher signed them. */
  readonly weeks: readonly SignedWeek[];
}

/** The fields a record passing classes carries beside its channel's. */
export const PASSED = [
  'appointment',
  'holder',
  'substitute',
  'decision',
  'from',
  'classes',
  'class',
  'sending',
  'part',
  'parts',
  'weeks',
];

const written = (value: unknown): value is string => named(value) && clean(value) === value;

const signedWeek = (value: unknown): value is SignedWeek =>
  record(value) &&
  Object.keys(value).length === 3 &&
  typeof value.text === 'string' &&
  typeof value.signature === 'string' &&
  isCertificate(value.certificate);

/** Whether a record's fields passing classes are each of their shape. */
export function passedShape(value: Record<string, unknown>): boolean {
  const { appointment, holder, substitute, decision, from, classes, class: of, sending, part, parts, weeks } = value;
  if (typeof sending !== 'string' || !ID.test(sending)) return false;
  if (!whole(parts, 1, HANDOVER_PARTS) || !whole(part, 0, parts - 1)) return false;
  if (typeof appointment !== 'string' || !ID.test(appointment) || !isDecision(decision)) return false;
  if (!written(holder) || !written(substitute) || typeof from !== 'string' || !isDay(from)) return false;
  if (!Array.isArray(classes) || classes.length === 0 || classes.length > SUBSTITUTION_CLASSES) return false;
  if (!classes.every(written) || !distinctClasses(classes) || !written(of)) return false;
  if (!classes.some((one) => timetableNameKey(one) === timetableNameKey(of))) return false;
  return Array.isArray(weeks) && weeks.length <= HANDOVER_WEEKS && weeks.every(signedWeek);
}

/** A signed record's batches on its own code's channel, numbered from `first`. */
export async function sealOnChannel<T extends OnChannel>(
  code: JoinCode,
  format: string,
  shaped: (one: unknown) => one is T,
  signed: SignedTimetable<T>,
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<{ readonly stream: string; readonly batches: readonly SealedBatch[] }> {
  const { value, text, signature, certificate } = signed;
  if (!shaped(value) || !onChannel(value, code)) throw new RangeError('A record goes on its own code’s channel');
  const place = await placeOfCode(code, mac);
  const batches = await sealRecord(place, { format, text, signature, certificate }, first, HANDOVER_BATCHES, cipher);
  return { stream: place.stream, batches };
}

/** What every record of one appointment repeats: the appointment, the names, the decision, the day and the classes. */
export const repeatedFields = (value: PassedClasses, ...more: readonly unknown[]) => {
  const { appointment, holder, substitute, decision, from, classes } = value;
  return JSON.stringify([appointment, holder, substitute, decision, from, classes, ...more]);
};

/**
 * Adds a record to its appointment's records: the first, or a later one signed
 * under the first's certificate subject repeating what it says.
 */
export function joinPassed<T extends PassedClasses>(
  records: Map<string, SignedTimetable<T>[]>,
  one: SignedTimetable<T>,
  repeated: (value: T) => string,
): void {
  const before = records.get(one.value.appointment) ?? [];
  const first = before[0] ?? one;
  if (first.certificate.subject === one.certificate.subject && repeated(first.value) === repeated(one.value))
    records.set(one.value.appointment, [...before, one]);
}

/**
 * One appointment's weeks that check under the world's CA, of the channel's
 * school and of their record's class, kept by `within`, signed by neither
 * `theirs`, the records' subject nor any record's key, each course's week once
 * at its highest version, the lower text winning a tie; and its classes whose
 * records of one sending all arrived.
 */
export async function passedWeeks<T extends PassedClasses>(
  records: readonly SignedTimetable<T>[],
  code: JoinCode,
  ca: TimetableCa,
  theirs: (certificate: Certificate) => boolean,
  mac: WorldMac,
  within: (week: WeekRecord, value: T) => boolean = () => true,
): Promise<{ readonly weeks: WeekVersion[]; readonly complete: string[] }> {
  const signer = records[0]?.certificate.subject;
  const keys = new Set(records.map((one) => one.certificate.publicKey));
  const sent = new Map<string, Map<string, { parts: number; seen: Set<number> }>>();
  const weeks = new Map<string, WeekVersion>();
  for (const { value } of records) {
    const of = sent.get(timetableNameKey(value.class)) ?? new Map<string, { parts: number; seen: Set<number> }>();
    const one = of.get(`${value.sending}\n${value.parts}`) ?? { parts: value.parts, seen: new Set<number>() };
    of.set(`${value.sending}\n${value.parts}`, { ...one, seen: one.seen.add(value.part) });
    sent.set(timetableNameKey(value.class), of);
    for (const each of value.weeks) {
      const checked = await checkSignedWeek(each, code.world, ca.key, ca.checker);
      if (typeof checked === 'string' || theirs(checked.certificate)) continue;
      if (checked.certificate.subject === signer || keys.has(checked.certificate.publicKey)) continue;
      const week = readWeekRecord(checked.text);
      if (week === null || timetableNameKey(week.class) !== timetableNameKey(value.class)) continue;
      if (!within(week, value) || !(await ofSchool(week, code.school, mac))) continue;
      const at = `${week.course}\n${week.week}`;
      const before = weeks.get(at);
      const higher = before === undefined || week.version > before.week.version;
      if (higher || (week.version === before.week.version && checked.text < before.signed.text))
        weeks.set(at, { week, signed: checked });
    }
  }
  const arrived = (of: string) =>
    [...(sent.get(timetableNameKey(of))?.values() ?? [])].some((one) => one.seen.size === one.parts);
  return { weeks: [...weeks.values()], complete: (records[0]?.value.classes ?? []).filter(arrived) };
}
