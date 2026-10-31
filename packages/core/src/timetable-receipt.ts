// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teacher's receipt of a version of their part (#579, R-7.4-06, R-7.4-16,
// answer 607), a signed record on the teacher's own channel beside their parts
// and proposals (timetable-record.ts), which replaces signing the paper notice.
// It names the version received and the world's day it was confirmed on, and
// counts only when signed by the device that joined on the channel, with the
// key its certificate names, and only when a part of that version came before
// it on the channel, signed by another device and another key, so a version is
// never confirmed ahead of its sending. The first receipt of a version is kept,
// and a later one is left out. As with proposals, only the device that joined
// now counts, so a teacher who joins again with another device confirms each
// version anew. Every receipt names the code's world, school, assignment and
// issue, and one naming another is left out.

import type { SealedBatch } from './batches.ts';
import type { Certificate, KeySigner } from './certify.ts';
import { isDay, type Day } from './day.ts';
import type { Joined, JoinCode } from './school-join.ts';
import { openRecords } from './sealed-stream.ts';
import { channelParts, onChannel, PART_BATCHES } from './timetable-package.ts';
import { CHANNEL, onChannelShape, placeOfCode, record, signedRecord, signedTimetable } from './timetable-record.ts';
import { whole, type OnChannel, type SignedTimetable, type TimetableCa } from './timetable-record.ts';
import type { WorldCipher, WorldMac } from './world-keys.ts';

/** The format a receipt's record and signed text carry. */
export const TIMETABLE_RECEIPT_FORMAT = 'minhajna/timetable-receipt/1';

/** A teacher's receipt of a version of their part, and the world's day it was confirmed on. */
export interface TimetableReceipt extends OnChannel {
  readonly version: number;
  readonly day: Day;
}

const RECEIPT = [...CHANNEL, 'version', 'day'];

/** Whether a value is a receipt, its fields only, each of its shape. */
export function isTimetableReceipt(value: unknown): value is TimetableReceipt {
  if (!record(value) || !onChannelShape(value, RECEIPT) || !whole(value.version, 1, 999_999_999)) return false;
  return typeof value.day === 'string' && isDay(value.day);
}

/** A receipt signed on the teacher's device with the key its joining certificate names. */
export const signReceipt = (receipt: TimetableReceipt, certificate: Certificate, signer: KeySigner) =>
  signedTimetable(receipt, isTimetableReceipt, TIMETABLE_RECEIPT_FORMAT, certificate, signer);

/**
 * The receipts on a code's channel, the first of each version, in its order;
 * `joined` is the device that joined on the channel, whose key alone signs a
 * receipt, or null when none has.
 */
export async function channelReceipts(
  code: JoinCode,
  batches: readonly SealedBatch[],
  ca: TimetableCa,
  joined: Joined | null,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<SignedTimetable<TimetableReceipt>[]> {
  if (joined === null) return [];
  const { device, certificate } = joined;
  const parts = (await channelParts(code, batches, ca, device, cipher, mac)).filter(
    (one) => one.certificate.publicKey !== certificate.publicKey,
  );
  const sent = new Map(parts.map((one) => [one.signature, one.part.version]));
  const seen = new Set<number>();
  const found = new Map<number, SignedTimetable<TimetableReceipt>>();
  for (const value of await openRecords(await placeOfCode(code, mac), batches, PART_BATCHES, cipher)) {
    const part = record(value) && typeof value.signature === 'string' ? sent.get(value.signature) : undefined;
    if (part !== undefined) seen.add(part);
    const receipt = await signedRecord(value, TIMETABLE_RECEIPT_FORMAT, isTimetableReceipt, code.world, ca);
    if (receipt === null || !onChannel(receipt.value, code) || found.has(receipt.value.version)) continue;
    const ours = receipt.certificate.subject === device && receipt.certificate.publicKey === certificate.publicKey;
    if (ours && seen.has(receipt.value.version)) found.set(receipt.value.version, receipt);
  }
  return [...found.values()];
}
