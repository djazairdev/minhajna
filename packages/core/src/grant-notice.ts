// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's notice of an inspector's grant over their weeks (#593, answer
// 621), as the director's visa travels (week-visa.ts): a signed record on the
// teacher's own channel, sealed under the channel's key, which the teacher and
// the school key's holders read. It names the grant, the inspector as the
// request labels them, the signed weeks it opens by course and first day, each
// once, as the director's device wrote them from that teacher's own channel,
// and the days the grant runs, from the world's day it was made, and nothing
// else: no other teacher, no clock time. It counts when signed by a key the
// world's CA certified, neither the joined device's subject nor its key, and
// the first notice of a grant counts; a record that is not of its shape is left
// out without stopping the others. Every record names the code's world, school,
// assignment and issue, and one naming another is left out. In the demo the CA
// certifies any device a request names (answer 564), so the teacher's page says
// a notice is shown as given in the school's space, without proof.

import type { SealedBatch } from './batches.ts';
import type { Certificate, KeySigner } from './certify.ts';
import { compareDays, isDay, type Day } from './day.ts';
import type { Joined, JoinCode } from './school-join.ts';
import { ID } from './school-key-shape.ts';
import { openRecords, sealRecord } from './sealed-stream.ts';
import { onChannel } from './timetable-package.ts';
import { CHANNEL, clean, named, onChannelShape, placeOfCode, record, signedRecord } from './timetable-record.ts';
import { signedTimetable, type OnChannel, type SignedTimetable, type TimetableCa } from './timetable-record.ts';
import { WEEK_BATCHES } from './week-record.ts';
import type { WorldCipher, WorldMac } from './world-keys.ts';

/** The format a notice's record and signed text carry. */
export const GRANT_NOTICE_FORMAT = 'minhajna/grant-notice/1';
/** The most weeks one notice names. */
export const MOST_NOTICE_WEEKS = 256;

/** A teacher's notice of a grant over their signed weeks. */
export interface GrantNotice extends OnChannel {
  readonly grant: string;
  /** The inspector, as the request labels them. */
  readonly inspector: string;
  readonly weeks: readonly { readonly course: string; readonly week: Day }[];
  /** The world's day the grant was made, from which it runs. */
  readonly from: Day;
  readonly until: Day;
}

const NOTICE = [...CHANNEL, 'grant', 'inspector', 'weeks', 'from', 'until'];

const day = (value: unknown): value is Day => typeof value === 'string' && isDay(value);

/** Whether a value is a notice, its fields only, each of its shape. */
export function isGrantNotice(value: unknown): value is GrantNotice {
  if (!record(value) || !onChannelShape(value, NOTICE)) return false;
  const { grant, inspector, weeks, from, until } = value;
  if (typeof grant !== 'string' || !ID.test(grant) || !named(inspector) || clean(inspector) !== inspector) return false;
  if (!day(from) || !day(until) || compareDays(from, until) > 0) return false;
  if (!Array.isArray(weeks) || weeks.length === 0 || weeks.length > MOST_NOTICE_WEEKS) return false;
  const shaped = (one: unknown) =>
    record(one) &&
    Object.keys(one).length === 2 &&
    typeof one['course'] === 'string' &&
    ID.test(one['course']) &&
    day(one['week']);
  if (!weeks.every(shaped)) return false;
  const names = new Set((weeks as { course: string; week: string }[]).map((one) => `${one.course}/${one.week}`));
  return names.size === weeks.length;
}

/** A notice signed on the director's device with the key its certificate names. */
export const signGrantNotice = (notice: GrantNotice, certificate: Certificate, signer: KeySigner) =>
  signedTimetable(notice, isGrantNotice, GRANT_NOTICE_FORMAT, certificate, signer);

/** A signed notice's batches on its code's channel, numbered from `first`. */
export async function sealGrantNotice(
  code: JoinCode,
  signed: SignedTimetable<GrantNotice>,
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<{ readonly stream: string; readonly batches: readonly SealedBatch[] }> {
  const { value, text, signature, certificate } = signed;
  if (!isGrantNotice(value) || !onChannel(value, code)) throw new RangeError('A notice goes on its own code’s channel');
  const place = await placeOfCode(code, mac);
  const record = { format: GRANT_NOTICE_FORMAT, text, signature, certificate };
  return { stream: place.stream, batches: await sealRecord(place, record, first, WEEK_BATCHES, cipher) };
}

/**
 * The notices on a code's channel, the first of each grant, in the channel's
 * order; `joined` is the device that joined on the channel, whose key never
 * gives a notice, or null when none has.
 */
export async function channelGrantNotices(
  code: JoinCode,
  batches: readonly SealedBatch[],
  ca: TimetableCa,
  joined: Joined | null,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<SignedTimetable<GrantNotice>[]> {
  if (joined === null) return [];
  const found = new Map<string, SignedTimetable<GrantNotice>>();
  for (const value of await openRecords(await placeOfCode(code, mac), batches, WEEK_BATCHES, cipher)) {
    const notice = await signedRecord(value, GRANT_NOTICE_FORMAT, isGrantNotice, code.world, ca);
    if (notice === null || !onChannel(notice.value, code) || found.has(notice.value.grant)) continue;
    const { subject, publicKey } = notice.certificate;
    if (subject !== joined.device && publicKey !== joined.certificate.publicKey) found.set(notice.value.grant, notice);
  }
  return [...found.values()];
}
