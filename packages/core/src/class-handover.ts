// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The classes a substitute takes over, passed through the school's space (#587,
// Handover-school, §3.10, §7.5, R-3.10-15, R-4.7-40, R-7.5-07, answer 615): a
// handover the director signs onto the substitute's own channel, sealed under
// the channel's key, in one record or more (passed-classes.ts), each naming the
// appointment, the holder's and the substitute's names as the staff list writes
// them, the decision, the first day and the classes, each named once, and
// carrying some of the holder's signed weeks of one of those classes as the
// holder signed them, with the ID of the sending it was put in, its place among
// that class's records of that sending and how many there are, at most 64 a
// record so a record fits the 128 batches the server takes in one request;
// nothing else passes, no unsigned week, reason, note, roll call or pupil list.
// A handover counts from its first record signed by a key the world's CA
// certified, neither the joined device's subject nor its key, with the later
// records of the same appointment signed under the same certificate subject,
// the director's device, naming the same, so a handover sent again after a
// reload, under a new key, joins it and brings it up to date; the classes all
// of whose records of one sending arrived are said. The substitute's device
// checks each week's signature against the world's CA itself and keeps a week
// of the channel's school and of its record's class, signed by neither the
// handover's subject or keys nor the joined device, each course's week once at
// its highest version, the lower text winning a tie. The substitute's receipt,
// signed by the device that joined on the channel on the world's day, replaces
// the paper record of handover, and counts after its handover and before its
// end, the first of each appointment. The end the director puts at the holder's
// return (class-return.ts, #588) ends the handover when signed under its
// subject, after it and after its first day, the first of each appointment.
// Every record names the code's world, school, assignment and issue, and one
// naming another is left out; neither is sealed on another code's channel. In
// the demo the CA certifies any device a request names (answer 564), so the
// handover is shown as given in the school's space, not as proven to be the
// director's, and its weeks as checked against the world's CA, not as proven to
// be the holder's.

import type { SealedBatch } from './batches.ts';
import type { Certificate, KeySigner } from './certify.ts';
import { HANDOVER_END_FORMAT, isHandoverEnd } from './class-return.ts';
import { isDay, type Day } from './day.ts';
import { HANDOVER_BATCHES, joinPassed, PASSED, passedShape, passedWeeks, repeatedFields } from './passed-classes.ts';
import { sealOnChannel, type PassedClasses } from './passed-classes.ts';
import type { Joined, JoinCode } from './school-join.ts';
import { ID } from './school-key-shape.ts';
import { openRecords } from './sealed-stream.ts';
import { onChannel } from './timetable-package.ts';
import { CHANNEL, onChannelShape, placeOfCode, record, signedRecord, signedTimetable } from './timetable-record.ts';
import type { OnChannel, SignedTimetable, TimetableCa } from './timetable-record.ts';
import type { WeekVersion } from './week-record.ts';
import type { WorldCipher, WorldMac } from './world-keys.ts';

export { HANDOVER_BATCHES, HANDOVER_PARTS, HANDOVER_WEEKS } from './passed-classes.ts';

/** The format a handover's record and signed text carry. */
export const CLASS_HANDOVER_FORMAT = 'minhajna/class-handover/1';

/** The format the substitute's receipt carries. */
export const HANDOVER_RECEIPT_FORMAT = 'minhajna/handover-receipt/1';

/** A record of the classes a substitute takes over, with some of the holder's signed weeks of one of them. */
export type ClassHandover = PassedClasses;

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
  /** The classes, as the handover names them, whose records of one sending all arrived. */
  readonly complete: readonly string[];
  /** The day the holder returned, as the director put it, or null while the appointment lasts. */
  readonly ended: Day | null;
}

const HANDOVER = [...CHANNEL, ...PASSED];
const RECEIPT = [...CHANNEL, 'appointment', 'day'];

/** Whether a value is a handover, its fields only, each of its shape. */
export const isClassHandover = (value: unknown): value is ClassHandover =>
  record(value) && onChannelShape(value, HANDOVER) && passedShape(value);

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

/** A signed handover's batches on the substitute's code's channel, numbered from `first`. */
export const sealHandover = (
  code: JoinCode,
  signed: SignedTimetable<ClassHandover>,
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
) => sealOnChannel(code, CLASS_HANDOVER_FORMAT, isClassHandover, signed, first, cipher, mac);

/** A signed receipt's batches on the substitute's code's channel, numbered from `first`. */
export const sealHandoverReceipt = (
  code: JoinCode,
  signed: SignedTimetable<HandoverReceipt>,
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
) => sealOnChannel(code, HANDOVER_RECEIPT_FORMAT, isHandoverReceipt, signed, first, cipher, mac);

/**
 * The handovers on a substitute's code's channel, in the channel's order, each
 * from its first record and the later records of the same appointment signed
 * under the same subject naming the same, with the weeks that check, the
 * receipt the joined device signed first after it and before its end, and the
 * end its subject put first after it, after its first day; `joined` is the
 * device that joined on the channel, whose key never signs a handover or one of
 * its weeks, or null.
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
  const ends = new Map<string, Day>();
  for (const value of await openRecords(await placeOfCode(code, mac), batches, HANDOVER_BATCHES, cipher)) {
    const handover = await signedRecord(value, CLASS_HANDOVER_FORMAT, isClassHandover, code.world, ca);
    if (handover !== null && onChannel(handover.value, code) && !theirs(handover.certificate))
      joinPassed(handovers, handover, (one) => repeatedFields(one));
    const receipt = await signedRecord(value, HANDOVER_RECEIPT_FORMAT, isHandoverReceipt, code.world, ca);
    if (receipt !== null && onChannel(receipt.value, code) && own(receipt.certificate)) {
      const { appointment, day } = receipt.value;
      if (handovers.has(appointment) && !receipts.has(appointment) && !ends.has(appointment))
        receipts.set(appointment, day);
    }
    const end = await signedRecord(value, HANDOVER_END_FORMAT, isHandoverEnd, code.world, ca);
    if (end === null || !onChannel(end.value, code)) continue;
    const first = handovers.get(end.value.appointment)?.[0];
    if (first?.certificate.subject !== end.certificate.subject || end.value.day <= first.value.from) continue;
    if (!ends.has(end.value.appointment)) ends.set(end.value.appointment, end.value.day);
  }
  const read: ReadHandover[] = [];
  for (const records of handovers.values()) {
    const { weeks, complete } = await passedWeeks(records, code, ca, theirs, mac);
    const signed = records[0]!;
    const { appointment } = signed.value;
    read.push({
      signed,
      weeks,
      received: receipts.get(appointment) ?? null,
      complete,
      ended: ends.get(appointment) ?? null,
    });
  }
  return read;
}
