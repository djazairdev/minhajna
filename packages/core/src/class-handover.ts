// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The classes a substitute takes over, passed through the school's space (#587,
// Handover-school, §3.10, §7.5, R-3.10-15, R-4.7-40, R-7.5-07, answer 615): a
// handover the director signs onto the substitute's own channel, sealed under
// the channel's key, in one record or more, each naming the appointment, the
// holder's and the substitute's names as the staff list writes them, the
// decision, the first day and the classes, each named once, and carrying some
// of the holder's signed weeks of one of those classes as the holder signed
// them, at most 64 a record so a record fits the 128 batches the server takes
// in one request; nothing else passes, no unsigned week, reason, note, roll
// call or pupil list. A handover counts from its first record signed by a key
// the world's CA certified, neither the joined device's subject nor its key,
// with the later records of the same appointment the same key signed naming the
// same. The substitute's device checks each week's signature against the
// world's CA itself and keeps a week of the channel's school and of its
// record's class, signed by neither the handover's key nor the joined device,
// each course's week once at its highest version, the lower text winning a tie.
// The substitute's receipt, signed by the device that joined on the channel on
// the world's day, replaces the paper record of handover, and counts after its
// handover, the first of each appointment. Every record names the code's world,
// school, assignment and issue, and one naming another is left out; neither is
// sealed on another code's channel. In the demo the CA certifies any device a
// request names (answer 564), so the handover is shown as given in the school's
// space, not as proven to be the director's, and its weeks as checked against
// the world's CA, not as proven to be the holder's.

import type { SealedBatch } from './batches.ts';
import { checkSignedWeek, isCertificate, type Certificate, type KeySigner, type SignedWeek } from './certify.ts';
import { isDay, type Day } from './day.ts';
import type { Joined, JoinCode } from './school-join.ts';
import { ID } from './school-key-shape.ts';
import { distinctClasses, isDecision, SUBSTITUTION_CLASSES } from './school-substitution.ts';
import { openRecords, sealRecord } from './sealed-stream.ts';
import { timetableNameKey } from './timetable-import.ts';
import { onChannel } from './timetable-package.ts';
import { CHANNEL, clean, named, onChannelShape, placeOfCode, record, signedRecord } from './timetable-record.ts';
import { signedTimetable, type OnChannel, type SignedTimetable, type TimetableCa } from './timetable-record.ts';
import { ofSchool, readWeekRecord, type WeekVersion } from './week-record.ts';
import type { WorldCipher, WorldMac } from './world-keys.ts';

/** The format a handover's record and signed text carry. */
export const CLASS_HANDOVER_FORMAT = 'minhajna/class-handover/1';

/** The format the substitute's receipt carries. */
export const HANDOVER_RECEIPT_FORMAT = 'minhajna/handover-receipt/1';

/** The most batches one handover record may take on a channel, as many as the server takes in one request. */
export const HANDOVER_BATCHES = 128;

/** The most signed weeks one handover record carries; a longer handover goes in several records. */
export const HANDOVER_WEEKS = 64;

/** A record of the classes a substitute takes over, with some of the holder's signed weeks of one of them. */
export interface ClassHandover extends OnChannel {
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
  /** Some of the holder's signed weeks of that class, as the holder signed them. */
  readonly weeks: readonly SignedWeek[];
}

/** The substitute's receipt of a handover, signed on their device on the world's day. */
export interface HandoverReceipt extends OnChannel {
  readonly appointment: string;
  readonly day: Day;
}

/** A handover read from the substitute's channel, from all its records. */
export interface ReadHandover {
  /** Its first record, which names the appointment. */
  readonly signed: SignedTimetable<ClassHandover>;
  /** The weeks its records carry that check, one a course's week at its highest version, as each first appears. */
  readonly weeks: readonly WeekVersion[];
  /** The day the substitute's device signed its receipt, or null. */
  readonly received: Day | null;
}

const HANDOVER = [...CHANNEL, 'appointment', 'holder', 'substitute', 'decision', 'from', 'classes', 'class', 'weeks'];
const RECEIPT = [...CHANNEL, 'appointment', 'day'];

const written = (value: unknown): value is string => named(value) && clean(value) === value;

const signedWeek = (value: unknown): value is SignedWeek =>
  record(value) &&
  Object.keys(value).length === 3 &&
  typeof value.text === 'string' &&
  typeof value.signature === 'string' &&
  isCertificate(value.certificate);

/** Whether a value is a handover, its fields only, each of its shape. */
export function isClassHandover(value: unknown): value is ClassHandover {
  if (!record(value) || !onChannelShape(value, HANDOVER)) return false;
  const { appointment, holder, substitute, decision, from, classes, class: of, weeks } = value;
  if (typeof appointment !== 'string' || !ID.test(appointment) || !isDecision(decision)) return false;
  if (!written(holder) || !written(substitute) || typeof from !== 'string' || !isDay(from)) return false;
  if (!Array.isArray(classes) || classes.length === 0 || classes.length > SUBSTITUTION_CLASSES) return false;
  if (!classes.every(written) || !distinctClasses(classes) || !written(of)) return false;
  if (!classes.some((one) => timetableNameKey(one) === timetableNameKey(of))) return false;
  return Array.isArray(weeks) && weeks.length <= HANDOVER_WEEKS && weeks.every(signedWeek);
}

/** Whether a value is a receipt, its fields only, each of its shape. */
export function isHandoverReceipt(value: unknown): value is HandoverReceipt {
  if (!record(value) || !onChannelShape(value, RECEIPT)) return false;
  const { appointment, day } = value;
  return typeof appointment === 'string' && ID.test(appointment) && typeof day === 'string' && isDay(day);
}

/** A handover signed on the director's device with the key its certificate names. */
export const signHandover = (handover: ClassHandover, certificate: Certificate, signer: KeySigner) =>
  signedTimetable(handover, isClassHandover, CLASS_HANDOVER_FORMAT, certificate, signer);

/** A receipt signed on the substitute's device with the key its certificate names. */
export const signHandoverReceipt = (receipt: HandoverReceipt, certificate: Certificate, signer: KeySigner) =>
  signedTimetable(receipt, isHandoverReceipt, HANDOVER_RECEIPT_FORMAT, certificate, signer);

async function seal<T extends OnChannel>(
  code: JoinCode,
  format: string,
  shaped: (one: unknown) => one is T,
  signed: SignedTimetable<T>,
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<{ readonly stream: string; readonly batches: readonly SealedBatch[] }> {
  const { value, text, signature, certificate } = signed;
  if (!shaped(value) || !onChannel(value, code)) throw new RangeError('A handover goes on its own code’s channel');
  const place = await placeOfCode(code, mac);
  const batches = await sealRecord(place, { format, text, signature, certificate }, first, HANDOVER_BATCHES, cipher);
  return { stream: place.stream, batches };
}

/** A signed handover's batches on the substitute's code's channel, numbered from `first`. */
export const sealHandover = (
  code: JoinCode,
  signed: SignedTimetable<ClassHandover>,
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
) => seal(code, CLASS_HANDOVER_FORMAT, isClassHandover, signed, first, cipher, mac);

/** A signed receipt's batches on the substitute's code's channel, numbered from `first`. */
export const sealHandoverReceipt = (
  code: JoinCode,
  signed: SignedTimetable<HandoverReceipt>,
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
) => seal(code, HANDOVER_RECEIPT_FORMAT, isHandoverReceipt, signed, first, cipher, mac);

/** What every record of one handover repeats: the appointment, the names, the decision, the day and the classes. */
const repeated = ({ appointment, holder, substitute, decision, from, classes }: ClassHandover) =>
  JSON.stringify([appointment, holder, substitute, decision, from, classes]);

/**
 * The handovers on a substitute's code's channel, in the channel's order, each
 * from its first record and the later records of the same appointment the same
 * key signed naming the same, with the weeks that check and the receipt the
 * joined device signed first after it; `joined` is the device that joined on
 * the channel, whose key never signs a handover or one of its weeks, or null.
 */
export async function channelHandovers(
  code: JoinCode,
  batches: readonly SealedBatch[],
  ca: TimetableCa,
  joined: Joined | null,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<ReadHandover[]> {
  if (joined === null) return [];
  const own = ({ subject, publicKey }: Certificate) =>
    subject === joined.device && publicKey === joined.certificate.publicKey;
  const theirs = ({ subject, publicKey }: Certificate) =>
    subject === joined.device || publicKey === joined.certificate.publicKey;
  const handovers = new Map<string, SignedTimetable<ClassHandover>[]>();
  const receipts = new Map<string, Day>();
  for (const value of await openRecords(await placeOfCode(code, mac), batches, HANDOVER_BATCHES, cipher)) {
    const handover = await signedRecord(value, CLASS_HANDOVER_FORMAT, isClassHandover, code.world, ca);
    if (handover !== null && onChannel(handover.value, code) && !theirs(handover.certificate)) {
      const first = handovers.get(handover.value.appointment)?.[0] ?? handover;
      const same = first.certificate.publicKey === handover.certificate.publicKey;
      if (same && repeated(first.value) === repeated(handover.value))
        handovers.set(handover.value.appointment, [...(handovers.get(handover.value.appointment) ?? []), handover]);
    }
    const receipt = await signedRecord(value, HANDOVER_RECEIPT_FORMAT, isHandoverReceipt, code.world, ca);
    if (receipt === null || !onChannel(receipt.value, code) || !own(receipt.certificate)) continue;
    const { appointment, day } = receipt.value;
    if (handovers.has(appointment) && !receipts.has(appointment)) receipts.set(appointment, day);
  }
  const read: ReadHandover[] = [];
  for (const records of handovers.values()) {
    const signer = records[0]!.certificate.publicKey;
    const weeks = new Map<string, WeekVersion>();
    for (const { value } of records) {
      for (const one of value.weeks) {
        const checked = await checkSignedWeek(one, code.world, ca.key, ca.checker);
        if (typeof checked === 'string' || theirs(checked.certificate) || checked.certificate.publicKey === signer)
          continue;
        const week = readWeekRecord(checked.text);
        if (week === null || timetableNameKey(week.class) !== timetableNameKey(value.class)) continue;
        if (!(await ofSchool(week, code.school, mac))) continue;
        const at = `${week.course}\n${week.week}`;
        const before = weeks.get(at);
        const higher = before === undefined || week.version > before.week.version;
        if (higher || (week.version === before.week.version && checked.text < before.signed.text))
          weeks.set(at, { week, signed: checked });
      }
    }
    const signed = records[0]!;
    read.push({ signed, weeks: [...weeks.values()], received: receipts.get(signed.value.appointment) ?? null });
  }
  return read;
}
