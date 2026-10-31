// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How the school's keyring travels between its holders (#571, answers 555 and
// 600). Each keyring goes on one stream of the school's space, whose name and
// sealing key come from the space's ID, so every device that knows the space,
// the relay and the teachers too, reads it and can write to it: a keyring
// holds nothing secret, and the sealing only gives it the relay's one batch
// size. No one but a holder can change a keyring, whose tag is under the
// latest key, or tell a device it was removed (school-key.ts); a writer can
// only take the stream's next number, which delays a holder's change until it
// is made again. A keyring may take up to KEYRING_BATCHES batches; each batch
// is opened once, and what does not open as a keyring of the school is
// skipped. A holder follows the stream from the keyring it holds, adopting
// each next one, and stops when one removes it. A new device, which knows
// neither the space nor the key, is reached through a drop space: its ID,
// stream and sealing key come from the one-time secret its QR code shows,
// which the relay never sees; the holder that scanned it puts there the
// school's space ID, the keyring and the admission. Whoever photographed the
// code could put another there, so two admitted keyrings that differ are
// refused, and the new device shows the keyring's fingerprint to compare with
// the holder's before it keeps anything.

import type { SealedBatch } from './batches.ts';
import { HOLDER_SECRET, openAdmitted } from './school-holder.ts';
import { acceptKeyring, type OpenedKeyring } from './school-key.ts';
import { ascii, fromHex, isKeyring, MAC, SCHOOL, type KeyCrypto, type SchoolKeyring } from './school-key-shape.ts';
import { openRecords, placeOf, sealRecord } from './sealed-stream.ts';
import { toBase64Url, type WorldCipher, type WorldMac } from './world-keys.ts';

/** The format of what a holder puts in a new device's drop space. */
export const ADMITTED_FORMAT = 'minhajna/holder-admitted/1';
/** The most batches one keyring may take, about 128 KB; a longer one is never sealed, and a reader stops there. */
export const KEYRING_BATCHES = 32;

function dropKey(secret: string): Uint8Array {
  if (!HOLDER_SECRET.test(secret)) throw new RangeError('Not a one-time secret');
  return fromHex(secret);
}

/** The stream of the school's space that carries its keyrings. */
export async function keyringStream(school: string, mac: WorldMac): Promise<string> {
  return (await placeOf(ascii(school), 'keyring', mac)).stream;
}

/** A keyring's batches on the school's stream, numbered from `first`, the stream's next number. */
export async function sealKeyring(
  ring: SchoolKeyring,
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<{ readonly stream: string; readonly batches: readonly SealedBatch[] }> {
  const place = await placeOf(ascii(ring.school), 'keyring', mac);
  return { stream: place.stream, batches: await sealRecord(place, ring, first, KEYRING_BATCHES, cipher) };
}

/** The school's keyrings its stream holds, in order, leaving out what is not one. */
export async function readKeyrings(
  school: string,
  batches: readonly SealedBatch[],
  publicKeyBytes: number,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<readonly SchoolKeyring[]> {
  const sets = await openRecords(await placeOf(ascii(school), 'keyring', mac), batches, KEYRING_BATCHES, cipher);
  return sets.filter((one): one is SchoolKeyring => isKeyring(one, publicKeyBytes) && one.school === school);
}

/**
 * Follows the keyrings of the school's stream from the one a device holds,
 * adopting each that changes it, one version up; the ones it adopted, in
 * order, with the latest, or 'removed' once one removes the device, which
 * drops what it adopted before, since a removed device gains nothing by it.
 */
export async function followKeyrings(
  held: OpenedKeyring,
  rings: readonly unknown[],
  device: string,
  crypto: KeyCrypto,
): Promise<{ readonly latest: OpenedKeyring; readonly adopted: readonly OpenedKeyring[] } | 'removed'> {
  let latest = held;
  const adopted: OpenedKeyring[] = [];
  for (const ring of rings) {
    const next = await acceptKeyring(latest, ring, device, crypto);
    if (next === 'removed') return 'removed';
    if (typeof next === 'string' || next.ring.tag === latest.ring.tag) continue;
    adopted.push(next);
    latest = next;
  }
  return { latest, adopted };
}

/** The drop space a new device opens, as its one-time secret names it, and the stream there. */
export async function holderDrop(
  secret: string,
  mac: WorldMac,
): Promise<{ readonly space: string; readonly stream: string }> {
  const key = dropKey(secret);
  const space = toBase64Url((await mac(key, ascii('minhajna/holder-drop/space'))).subarray(0, 16));
  return { space, stream: (await placeOf(key, 'holder-drop', mac)).stream };
}

/** What the holder that scanned a new device's QR code puts in its drop space, numbered from `first`. */
export async function sealAdmitted(
  secret: string,
  admitted: { readonly ring: SchoolKeyring; readonly admission: string },
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<{ readonly space: string; readonly stream: string; readonly batches: readonly SealedBatch[] }> {
  const { space } = await holderDrop(secret, mac);
  const place = await placeOf(dropKey(secret), 'holder-drop', mac);
  const { ring, admission } = admitted;
  const record = { format: ADMITTED_FORMAT, school: ring.school, ring, admission };
  return { space, stream: place.stream, batches: await sealRecord(place, record, first, KEYRING_BATCHES, cipher) };
}

/**
 * The keyring a new device was admitted to, opened, with the school's space,
 * from the records of its drop space whose admission holds under its secret;
 * null while there is none, and 'contested' when two that differ hold, since
 * whoever photographed the code put one of them there; both stay, so the new
 * device then starts over with a new code, and so a new drop space.
 */
export async function readAdmitted(
  secret: string,
  batches: readonly SealedBatch[],
  device: string,
  crypto: KeyCrypto,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<{ readonly school: string; readonly opened: OpenedKeyring } | null | 'contested'> {
  let found: { readonly school: string; readonly opened: OpenedKeyring } | null = null;
  const place = await placeOf(dropKey(secret), 'holder-drop', mac);
  for (const one of await openRecords(place, batches, KEYRING_BATCHES, cipher)) {
    if (typeof one !== 'object' || one === null || Array.isArray(one)) continue;
    const { format, school, ring, admission, ...rest } = one as Record<string, unknown>;
    if (format !== ADMITTED_FORMAT || Object.keys(rest).length > 0) continue;
    if (typeof school !== 'string' || !SCHOOL.test(school) || typeof admission !== 'string' || !MAC.test(admission)) {
      continue;
    }
    if (!isKeyring(ring, crypto.publicKeyBytes) || ring.school !== school) continue;
    const held = await openAdmitted(ring, admission, device, secret, crypto);
    if (typeof held === 'string') continue;
    if (found !== null && found.opened.ring.tag !== held.ring.tag) return 'contested';
    found = { school, opened: held };
  }
  return found;
}
