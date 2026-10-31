// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The classes coming back to their holder at the end of a substitution, through
// the school's space (#588, Handover-end, Handover-end-sub, §7.5, R-7.5-07,
// answer 616): a return the director signs onto the holder's own channel, in
// one record or more as a handover goes (passed-classes.ts), naming besides the
// return day, after the first day, and carrying the substitute's signed weeks
// of one class as the substitute signed them; and the end of the appointment,
// the appointment and the return day, signed onto the substitute's channel,
// which ends the handover there, as class-handover.ts reads it, and after which
// no receipt counts. The holder's device keeps a return's weeks that fall in
// the substitution, some of their seven days from the first day and before the
// return, never one the holder's own device signed. Nothing else passes: no
// week the substitute did not sign, no reason, no private note. In the demo the
// CA certifies any device a request names (answer 564), so a return is shown as
// given in the school's space, not as proven to be the director's, and its
// weeks as checked against the world's CA, not as proven to be the
// substitute's.

import type { SealedBatch } from './batches.ts';
import type { Certificate, KeySigner } from './certify.ts';
import { addDays, isDay, type Day } from './day.ts';
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

/** The format a return's record and signed text carry. */
export const CLASS_RETURN_FORMAT = 'minhajna/class-return/1';

/** The format the end of an appointment carries. */
export const HANDOVER_END_FORMAT = 'minhajna/handover-end/1';

/** A record of the classes coming back to their holder, with some of the substitute's signed weeks of one of them. */
export interface ClassReturn extends PassedClasses {
  /** The day the holder returned, after the first day. */
  readonly until: Day;
}

/** The end of an appointment on the substitute's channel: the day the holder returned. */
export interface HandoverEnd extends OnChannel {
  readonly appointment: string;
  readonly day: Day;
}

/** A return read from the holder's channel, from all its records. */
export interface ReadReturn {
  /** Its first record, which names the appointment. */
  readonly signed: SignedTimetable<ClassReturn>;
  /** The weeks its records carry that check, one a course's week at its highest version, as each first appears. */
  readonly weeks: readonly WeekVersion[];
  /** The classes, as the return names them, whose records of one sending all arrived. */
  readonly complete: readonly string[];
}

const RETURN = [...CHANNEL, ...PASSED, 'until'];
const END = [...CHANNEL, 'appointment', 'day'];

/** Whether a week, by its first day, has some of its seven days from the first day and before the return. */
export const inSubstitution = (week: Day, from: Day, until: Day) => addDays(week, 6) >= from && week < until;

/** Whether a value is a return, its fields only, each of its shape, returning after its first day. */
export function isClassReturn(value: unknown): value is ClassReturn {
  if (!record(value) || !onChannelShape(value, RETURN) || !passedShape(value)) return false;
  const { from, until } = value;
  return typeof until === 'string' && isDay(until) && typeof from === 'string' && until > from;
}

/** Whether a value is the end of an appointment, its fields only, each of its shape. */
export function isHandoverEnd(value: unknown): value is HandoverEnd {
  if (!record(value) || !onChannelShape(value, END)) return false;
  const { appointment, day } = value;
  return typeof appointment === 'string' && ID.test(appointment) && typeof day === 'string' && isDay(day);
}

/** A return signed on the director's device with the key its certificate names. */
export const signClassReturn = (one: ClassReturn, certificate: Certificate, signer: KeySigner) =>
  signedTimetable(one, isClassReturn, CLASS_RETURN_FORMAT, certificate, signer);

/** An end signed on the director's device with the key its certificate names. */
export const signHandoverEnd = (end: HandoverEnd, certificate: Certificate, signer: KeySigner) =>
  signedTimetable(end, isHandoverEnd, HANDOVER_END_FORMAT, certificate, signer);

/** A signed return's batches on the holder's code's channel, numbered from `first`. */
export const sealClassReturn = (
  code: JoinCode,
  signed: SignedTimetable<ClassReturn>,
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
) => sealOnChannel(code, CLASS_RETURN_FORMAT, isClassReturn, signed, first, cipher, mac);

/** A signed end's batches on the substitute's code's channel, numbered from `first`. */
export const sealHandoverEnd = (
  code: JoinCode,
  signed: SignedTimetable<HandoverEnd>,
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
) => sealOnChannel(code, HANDOVER_END_FORMAT, isHandoverEnd, signed, first, cipher, mac);

/**
 * The returns on a holder's code's channel, in the channel's order, each from
 * its first record and the later records of the same appointment signed under
 * the same subject naming the same, with the weeks that check and fall in the
 * substitution; `joined` is the device that joined on the channel, whose key
 * never signs a return or one of its weeks, or null.
 */
export async function channelReturns(
  code: JoinCode,
  batches: readonly SealedBatch[],
  ca: TimetableCa,
  joined: Joined | null,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<ReadReturn[]> {
  if (joined === null) return [];
  const theirs = ({ subject, publicKey }: Certificate) =>
    subject === joined.device || publicKey === joined.certificate.publicKey;
  const returns = new Map<string, SignedTimetable<ClassReturn>[]>();
  for (const value of await openRecords(await placeOfCode(code, mac), batches, HANDOVER_BATCHES, cipher)) {
    const one = await signedRecord(value, CLASS_RETURN_FORMAT, isClassReturn, code.world, ca);
    if (one !== null && onChannel(one.value, code) && !theirs(one.certificate))
      joinPassed(returns, one, (each) => repeatedFields(each, each.until));
  }
  const read: ReadReturn[] = [];
  for (const records of returns.values()) {
    const within = (week: { week: Day }, value: ClassReturn) => inSubstitution(week.week, value.from, value.until);
    const { weeks, complete } = await passedWeeks(records, code, ca, theirs, mac, within);
    read.push({ signed: records[0]!, weeks, complete });
  }
  return read;
}
