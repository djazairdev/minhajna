// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A directorate's space in a demo world, where its schools and its inspectors
// reach it (#593, M-Grant, answer 621). Its ID is worked out from the world and
// the directorate's seeded ID, so every device of the world finds the same
// space, which the relay opens as a directorate's. On it, a school whose key a
// device holds lists itself, its random space beside its seeded ID, so the
// directorate can read that space's keyring for its holders' public keys; and
// an inspector's device posts the public half of the key pair it keeps in the
// world, whose fingerprint the inspectorate sends the school in its official
// message (answer 563). Both streams are named from the space's ID, which is
// not secret, so their sealing gives them only the relay's batch size: neither
// names a record. On M-Grant the directorate types the fingerprint, and the key
// posted for it is found with the first device it was posted for, since a copy
// under another device's ID cannot open what is sealed to the key; so no list
// of inspectors' devices is ever shown. A listing from another world, or a
// record that does not read, is left out; the latest listing of a school wins,
// so whoever can write the stream, the server too, could point a school at
// another space, which would only misdirect a request that names no teacher and
// no secret (answer 621). Builders write each record in its one format, sealed
// and opened at its place with the relay's batch size.

import type { SealedBatch } from './batches.ts';
import type { InspectorDevice } from './device-events.ts';
import { eventOf } from './events.ts';
import { inspectorFingerprint, plainFingerprint as plain } from './grant-fingerprint.ts';
import type { Entry } from './history.ts';
import { ascii, ID, isHolder, SCHOOL, type Holder, type KeyCrypto } from './school-key-shape.ts';
import { openRecords, placeOf, sealRecord, type Place } from './sealed-stream.ts';
import { record } from './timetable-record.ts';
import { isWorldId } from './world-code.ts';
import { PKCS8_TEXT, toBase64Url, type WorldCipher, type WorldMac } from './world-keys.ts';

export type { InspectorDevice } from './device-events.ts';

export const SCHOOL_LISTED = 'minhajna/school-listed/1';
export const INSPECTOR_KEY = 'minhajna/inspector-key/1';
/** The most batches a listing or an inspector's key may take. */
export const DIRECTORATE_RECORD_BATCHES = 2;

/** A school's listing in its directorate's space: its seeded ID and its space. */
export interface SchoolListed {
  readonly format: typeof SCHOOL_LISTED;
  readonly world: string;
  readonly seed: string;
  readonly space: string;
}

/** An inspector's device as posted in its directorate's space. */
export interface InspectorKey {
  readonly format: typeof INSPECTOR_KEY;
  readonly world: string;
  readonly holder: Holder;
}

/** A seeded ID as demo-world.ts numbers it: a kind and a counter shared by the whole seed, far under a million. */
const SEED = /^[a-z]+-[1-9][0-9]{0,5}$/u;
const HEX = /^(?:[0-9a-f]{2})+$/u;

/** A directorate's space in a world: 16 bytes of an HMAC keyed by the world, in base64url. */
export async function directorateSpace(world: string, directorate: string, mac: WorldMac): Promise<string> {
  if (!isWorldId(world) || !SEED.test(directorate)) throw new RangeError('A directorate is named in its world');
  return toBase64Url((await mac(ascii(world), ascii(`minhajna/directorate-space\n${directorate}`))).subarray(0, 16));
}

/** Where a directorate's space keeps its schools' listings. */
export const listingPlace = (space: string, mac: WorldMac): Promise<Place> =>
  placeOf(ascii(space), 'school-listed', mac);

/** Where a directorate's space keeps its inspectors' keys. */
export const inspectorKeyPlace = (space: string, mac: WorldMac): Promise<Place> =>
  placeOf(ascii(space), 'inspector-key', mac);

/** A listing's or an inspector's key's batches at its place in a directorate's space, numbered from `first`. */
export const sealDirectorateRecord = (
  place: Place,
  value: SchoolListed | InspectorKey,
  first: number,
  cipher: WorldCipher,
): Promise<SealedBatch[]> => sealRecord(place, value, first, DIRECTORATE_RECORD_BATCHES, cipher);

/** The records at a place in a directorate's space, in their order, for the readers below. */
export const openDirectorateRecords = (place: Place, batches: readonly SealedBatch[], cipher: WorldCipher) =>
  openRecords(place, batches, DIRECTORATE_RECORD_BATCHES, cipher);

/** A school's listing in its directorate's space. */
export const schoolListing = (world: string, seed: string, space: string): SchoolListed => ({
  format: SCHOOL_LISTED,
  world,
  seed,
  space,
});

/** An inspector's device as posted in its directorate's space. */
export const inspectorKey = (world: string, holder: Holder): InspectorKey => ({
  format: INSPECTOR_KEY,
  world,
  holder: { id: holder.id, publicKey: holder.publicKey },
});

/** A school's listing, or null when it does not read. */
export function readSchoolListed(value: unknown): SchoolListed | null {
  if (!record(value)) return null;
  const { format, world, seed, space, ...rest } = value;
  if (Object.keys(rest).length > 0 || format !== SCHOOL_LISTED || !isWorldId(world)) return null;
  if (typeof seed !== 'string' || !SEED.test(seed) || typeof space !== 'string' || !SCHOOL.test(space)) return null;
  return { format, world, seed, space };
}

/** Each school listed in a world's directorate space, by its seeded ID, the latest listing winning. */
export function listedSchools(records: readonly unknown[], world: string): ReadonlyMap<string, string> {
  const listed = new Map<string, string>();
  for (const one of records) {
    const read = readSchoolListed(one);
    if (read?.world === world) listed.set(read.seed, read.space);
  }
  return listed;
}

/** An inspector's posted key, or null when it does not read. */
export function readInspectorKey(value: unknown, publicKeyBytes: number): InspectorKey | null {
  if (!record(value)) return null;
  const { format, world, holder, ...rest } = value;
  if (Object.keys(rest).length > 0 || format !== INSPECTOR_KEY || !isWorldId(world)) return null;
  return isHolder(holder, publicKeyBytes)
    ? { format, world, holder: { id: holder.id, publicKey: holder.publicKey } }
    : null;
}

/** The inspector's device posted in a world whose key gives the fingerprint typed, the first posted for it, or null. */
export async function inspectorByFingerprint(
  records: readonly unknown[],
  world: string,
  typed: string,
  crypto: KeyCrypto,
): Promise<Holder | null> {
  if (plain(typed) === '') return null;
  for (const one of records) {
    const read = readInspectorKey(one, crypto.publicKeyBytes);
    if (read?.world !== world) continue;
    if (plain(await inspectorFingerprint(read.holder.publicKey, crypto)) === plain(typed)) return read.holder;
  }
  return null;
}

/** An inspector's device as the world's store keeps it, or null when it does not read. */
export function readInspectorDevice(value: unknown, publicKeyBytes: number): InspectorDevice | null {
  if (!record(value)) return null;
  const { device, publicKey, pkcs8, ...rest } = value;
  if (Object.keys(rest).length > 0 || typeof device !== 'string' || !ID.test(device)) return null;
  if (typeof publicKey !== 'string' || publicKey.length !== publicKeyBytes * 2 || !HEX.test(publicKey)) return null;
  return typeof pkcs8 === 'string' && PKCS8_TEXT.test(pkcs8) ? { device, publicKey, pkcs8 } : null;
}

/** The inspector's device this store keeps, the first that reads, since its key, once posted, is the one granted. */
export function keptInspectorDevice(entries: readonly Entry[], publicKeyBytes: number): InspectorDevice | null {
  for (const entry of entries) {
    const event = eventOf(entry);
    const read = event?.kind === 'inspector.device' ? readInspectorDevice(event.inspector, publicKeyBytes) : null;
    if (read !== null) return read;
  }
  return null;
}
