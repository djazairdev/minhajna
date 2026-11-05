// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A plan-error report from a teacher in a national demo world, as the curators
// read it (#616, R-4.3-20, answer 770): the pack and item IDs, the release, the
// kind of error, the note, and a name only when the teacher chose credit. It
// goes sealed on a stream of the national space, under a key from the world's
// sealing key, so the server sees batches of the one size and neither a name
// nor a note; it says nothing of a class, school or device. Reports are what
// someone said, signed by nobody: a reader keeps those that read and shows them
// as text.

import { isDay, type Day } from './day.ts';
import { isName } from './reference-fields.ts';
import { ITEM_ID } from './pack-fields.ts';
import { isFields, RELEASE } from './read.ts';
import { openRecords, placeOf, sealRecord, type Place } from './sealed-stream.ts';
import type { SealedBatch } from './batches.ts';
import type { WorldCipher, WorldMac } from './world-keys.ts';

export const REPORT_KINDS = ['title', 'page', 'duration', 'order', 'other'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export interface PackReport {
  readonly id: string;
  readonly release: string;
  readonly item: string;
  readonly kind: ReportKind;
  readonly note: string;
  /** The name to credit; null when the teacher did not choose credit. */
  readonly name: string | null;
  readonly day: Day;
}

export const REPORT_NOTE_MOST = 1000;
export const REPORT_NAME_MOST = 80;
/** A note and a name at their longest, every character escaped, in batches of the one size. */
const REPORT_BATCHES = 4;
const FIELDS = ['id', 'release', 'item', 'kind', 'note', 'name', 'day'];
const PACK_ID = /^[a-z0-9-]+(?:\.[a-z0-9-]+){4,5}$/u;
const CONTROL = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const CONTROLS = new RegExp(CONTROL.source, 'gu');

const reads = (text: unknown, most: number): text is string =>
  typeof text === 'string' && text.trim() !== '' && text.length <= most && !CONTROL.test(text);

/** What a person typed, as a report holds it: no control or format characters, nor spaces at its ends. */
export const reportText = (text: string) => text.replace(CONTROLS, '').trim();

/** A report as the stream may hold it, or null when it does not read. */
export function readPackReport(value: unknown): PackReport | null {
  if (!isFields(value) || Object.keys(value).some((key) => !FIELDS.includes(key))) return null;
  const { id, release, item, kind, note, name, day } = value;
  if (typeof id !== 'string' || !PACK_ID.test(id) || typeof release !== 'string' || !RELEASE.test(release)) return null;
  if (!isName(item, ITEM_ID) || !REPORT_KINDS.includes(kind as ReportKind)) return null;
  if (!reads(note, REPORT_NOTE_MOST) || typeof day !== 'string' || !isDay(day)) return null;
  if (name !== null && !reads(name, REPORT_NAME_MOST)) return null;
  return { id, release, item, kind: kind as ReportKind, note, name, day };
}

export const packReportPlace = (sealing: Uint8Array, mac: WorldMac): Promise<Place> =>
  placeOf(sealing, 'pack-report', mac);

export async function sealPackReport(place: Place, report: PackReport, first: number, cipher: WorldCipher) {
  if (readPackReport(report) === null) throw new RangeError('A report must read');
  return sealRecord(place, report, first, REPORT_BATCHES, cipher);
}

/** The reports that read, in the order they were sent; what doesn't open or read is left out. */
export async function openPackReports(place: Place, batches: readonly SealedBatch[], cipher: WorldCipher) {
  const records = await openRecords(place, batches, REPORT_BATCHES, cipher);
  return records.flatMap((record) => readPackReport(record) ?? []);
}
