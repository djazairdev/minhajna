// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The uses of an inspector's grant, for the teacher's access log (#594, answer
// 622). Each time the inspector's device takes a week's key through a grant,
// the use that comes with it (grants.ts) goes on a stream of the school's space
// named and sealed from that week's use key, which the inspector's device gets
// with the week's key and the school's devices derive from the grant's own log
// key; the director's device gives each teacher the keys of their own weeks in
// their notice (grant-notice.ts), so a teacher reads the uses of their own
// weeks and of no other teacher's, even one sharing a course. A use reads only
// when every field is of its shape, a record repeated once, in the stream's
// order; anyone holding a week's key, such as its teacher, can post a use with
// a forged proof, which stands beside the genuine one. The teacher sees each
// use as the inspector's device reported it; the school's devices check it
// against their record of the grant (checkUse), so neither the server nor
// anyone else can forge one that checks, though the server can drop it.

import type { SealedBatch } from './batches.ts';
import { isDay } from './day.ts';
import type { GrantUse } from './grants.ts';
import { ID } from './school-key-shape.ts';
import { openRecords, placeOf, sealRecord, type Place } from './sealed-stream.ts';
import { record } from './timetable-record.ts';
import type { WorldCipher, WorldMac } from './world-keys.ts';

/** The format a use's record carries. */
export const GRANT_USE = 'minhajna/grant-use/1';
/** The most batches one use takes. */
export const GRANT_USE_BATCHES = 2;

const FIELDS = ['format', 'grant', 'inspector', 'course', 'week', 'epoch', 'day', 'proof'];
const PROOF = /^[0-9a-f]{64}$/u;

/** Where the uses of a week go, from its use key. */
export const usePlace = (key: Uint8Array, mac: WorldMac): Promise<Place> => placeOf(key, 'grant-use', mac);

/** A use, its fields only, each of its shape, or null when it does not read. */
export function readGrantUse(value: unknown): GrantUse | null {
  if (!record(value) || Object.keys(value).length !== FIELDS.length - 1) return null;
  if (!Object.keys(value).every((key) => FIELDS.includes(key))) return null;
  const { grant, inspector, course, week, epoch, day, proof } = value;
  const ids = [grant, inspector, course].every((one) => typeof one === 'string' && ID.test(one));
  const days = [week, day].every((one) => typeof one === 'string' && isDay(one));
  if (!ids || !days || typeof proof !== 'string' || !PROOF.test(proof)) return null;
  if (typeof epoch !== 'number' || !Number.isSafeInteger(epoch) || epoch < 0) return null;
  return { grant, inspector, course, week, epoch, day, proof } as GrantUse;
}

/** A use's batches on its week's stream, numbered from `first`. */
export function sealGrantUse(place: Place, use: GrantUse, first: number, cipher: WorldCipher) {
  const { grant, inspector, course, week, epoch, day, proof } = use;
  const plain = { grant, inspector, course, week, epoch, day, proof };
  if (readGrantUse(plain) === null) throw new RangeError('Not a use of a grant');
  return sealRecord(place, { format: GRANT_USE, ...plain }, first, GRANT_USE_BATCHES, cipher);
}

/**
 * The uses on a week's stream that read, in the stream's order, a record repeated
 * once: a use with a forged proof stands beside the genuine one, for the
 * school's devices to tell apart (checkUse).
 */
export async function openGrantUses(
  place: Place,
  batches: readonly SealedBatch[],
  cipher: WorldCipher,
): Promise<GrantUse[]> {
  const found = new Map<string, GrantUse>();
  for (const value of await openRecords(place, batches, GRANT_USE_BATCHES, cipher)) {
    if (!record(value) || value['format'] !== GRANT_USE) continue;
    const use = readGrantUse(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'format')));
    const name = use === null ? '' : JSON.stringify(use);
    if (use !== null && !found.has(name)) found.set(name, use);
  }
  return [...found.values()];
}
