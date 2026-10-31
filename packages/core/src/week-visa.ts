// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's visa on a signed week (#585, D-Record, D-Record-fix, §7.5,
// R-7.5-14, answer 613): a comment on one version of a course's week, never an
// edit, as a signed record on the teacher's own channel beside the weeks
// (week-record.ts), sealed under the channel's key, which the teacher and the
// school key's holders read. A visa names the course, the week's first day and
// the version it was given on, with the world's day it was given, never before
// the week's first day, and nothing else: no text, no clock time. It counts
// when signed by a key the world's CA certified, neither the joined device's
// subject nor its key, and only once the joined device's week at that version
// came before it on the channel, the text the channel keeps for that version:
// when two texts share a version, a visa between them waits for the kept one;
// the first visa on a version counts and a later one is left out, so a visa on
// the original stays when a correction comes, and the correction takes its own.
// Every record names the code's world, school, assignment and issue, and one
// naming another is left out. In the demo the CA certifies any device a request
// names (answer 564), so anyone holding the channel's key can have a key
// certified and give a visa; the state's CA will bind the visa's key to the
// school.

import type { SealedBatch } from './batches.ts';
import type { Certificate, KeySigner } from './certify.ts';
import { isDay, type Day } from './day.ts';
import type { Joined, JoinCode } from './school-join.ts';
import { ID } from './school-key-shape.ts';
import { openRecords, sealRecord } from './sealed-stream.ts';
import { onChannel } from './timetable-package.ts';
import { CHANNEL, onChannelShape, placeOfCode, record, signedRecord, signedTimetable } from './timetable-record.ts';
import { whole, type OnChannel, type SignedTimetable, type TimetableCa } from './timetable-record.ts';
import { channelWeeks, WEEK_BATCHES } from './week-record.ts';
import type { WorldCipher, WorldMac } from './world-keys.ts';

/** The format a visa's record and signed text carry. */
export const WEEK_VISA_FORMAT = 'minhajna/week-visa/1';

/** The director's visa on a version of a course's week, and the world's day it was given. */
export interface WeekVisa extends OnChannel {
  readonly course: string;
  /** The week's first day. */
  readonly week: Day;
  readonly version: number;
  readonly day: Day;
}

const VISA = [...CHANNEL, 'course', 'week', 'version', 'day'];

/** A version of a course's week, as a visa and a signed week name it. */
const versionKey = (one: { course: string; week: Day; version: number }) =>
  `${one.course}\n${one.week}\n${one.version}`;

/** Whether a value is a visa, its fields only, each of its shape. */
export function isWeekVisa(value: unknown): value is WeekVisa {
  if (!record(value) || !onChannelShape(value, VISA)) return false;
  const { course, week, version, day } = value;
  if (typeof course !== 'string' || !ID.test(course) || !whole(version, 0, Number.MAX_SAFE_INTEGER)) return false;
  return typeof week === 'string' && isDay(week) && typeof day === 'string' && isDay(day) && day >= week;
}

/** A visa signed on the director's device with the key its certificate names. */
export const signVisa = (visa: WeekVisa, certificate: Certificate, signer: KeySigner) =>
  signedTimetable(visa, isWeekVisa, WEEK_VISA_FORMAT, certificate, signer);

/** A signed visa's batches on its code's channel, numbered from `first`. */
export async function sealVisa(
  code: JoinCode,
  signed: SignedTimetable<WeekVisa>,
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<{ readonly stream: string; readonly batches: readonly SealedBatch[] }> {
  const { value, text, signature, certificate } = signed;
  if (!isWeekVisa(value) || !onChannel(value, code)) throw new RangeError('A visa goes on its own code’s channel');
  const place = await placeOfCode(code, mac);
  const batches = await sealRecord(
    place,
    { format: WEEK_VISA_FORMAT, text, signature, certificate },
    first,
    WEEK_BATCHES,
    cipher,
  );
  return { stream: place.stream, batches };
}

/**
 * The visas on a code's channel, the first on each version of a week, in the
 * channel's order; `joined` is the device that joined on the channel, whose
 * key never gives a visa and whose week must come first, or null when none has.
 */
export async function channelVisas(
  code: JoinCode,
  batches: readonly SealedBatch[],
  ca: TimetableCa,
  joined: Joined | null,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<SignedTimetable<WeekVisa>[]> {
  if (joined === null) return [];
  const weeks = await channelWeeks(code, batches, ca, joined, cipher, mac);
  const signedBy = new Map(
    weeks.flatMap((one) => [...one.earlier, one]).map((one) => [one.signed.signature, versionKey(one.week)]),
  );
  const seen = new Set<string>();
  const found = new Map<string, SignedTimetable<WeekVisa>>();
  for (const value of await openRecords(await placeOfCode(code, mac), batches, WEEK_BATCHES, cipher)) {
    const week = record(value) && typeof value.signature === 'string' ? signedBy.get(value.signature) : undefined;
    if (week !== undefined) seen.add(week);
    const visa = await signedRecord(value, WEEK_VISA_FORMAT, isWeekVisa, code.world, ca);
    if (visa === null || !onChannel(visa.value, code)) continue;
    const { subject, publicKey } = visa.certificate;
    const theirs = subject === joined.device || publicKey === joined.certificate.publicKey;
    const at = versionKey(visa.value);
    if (!theirs && seen.has(at) && !found.has(at)) found.set(at, visa);
  }
  return [...found.values()];
}
