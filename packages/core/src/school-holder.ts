// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A new device that comes to hold the school key (#550, #571, answers 555 and
// 600): its one-time secret and the QR code that shows its ID, its public key
// and the secret; the admission the device that scans it sends with the
// keyring, a MAC under the secret, which the server never sees; opening that
// first keyring only when the admission holds; and the device's fingerprint,
// over its ID and public key, which both screens show so the holder confirms
// the device it scanned is the one in front of it, not a code put in its place.
// Until it is admitted, a new device keeps its pair and secret in the world's
// store, so closing the page shows the same code again; holding the key, or
// giving up, ends the wait, after which the secret is never used again, though
// the store, which only adds, keeps it until the world is erased. The keyring
// itself is in school-key.ts.

import type { SchoolWaiting } from './device-events.ts';
import { eventOf } from './events.ts';
import type { Entry } from './history.ts';
import { toHex, type RandomBytes } from './id.ts';
import { openKeyring, type OpenedKeyring } from './school-key.ts';
import {
  ascii,
  fromHex,
  ID,
  isKeyring,
  sameMac,
  type Holder,
  type KeyCrypto,
  type KeyringProblem,
  type SchoolKeyring,
} from './school-key-shape.ts';
import { PKCS8_TEXT } from './world-keys.ts';

export type { SchoolWaiting } from './device-events.ts';

/** What a new device's QR code holds before its ID, public key and one-time secret. */
export const HOLDER_QR_PREFIX = 'minhajna-holder:1:';
const SECRET_BYTES = 16;
/** A one-time secret as a QR code shows it. */
export const HOLDER_SECRET = /^[0-9a-f]{32}$/u;
/** The bytes of a device's fingerprint, three groups of four hex characters. */
const FINGERPRINT_BYTES = 6;

/** A new device's one-time secret, which its QR code shows and nothing else holds. */
export function newHolderSecret(random: RandomBytes): string {
  return toHex(random(SECRET_BYTES));
}

/** What a new device's QR code holds. */
export function holderQr(holder: Holder, secret: string): string {
  return `${HOLDER_QR_PREFIX}${holder.id}:${holder.publicKey}:${secret}`;
}

/** The device and secret a scanned QR code holds, exactly as the new device made it, or null. */
export function readHolderQr(text: string): { readonly holder: Holder; readonly secret: string } | null {
  if (!text.startsWith(HOLDER_QR_PREFIX)) return null;
  const [id = '', publicKey = '', secret = '', ...rest] = text.slice(HOLDER_QR_PREFIX.length).split(':');
  const fine = rest.length === 0 && ID.test(id) && /^(?:[0-9a-f]{2})+$/u.test(publicKey);
  return fine && HOLDER_SECRET.test(secret) ? { holder: { id, publicKey }, secret } : null;
}

/** The admission the scanning device sends with the keyring: a MAC of its tag under the new device's secret. */
export async function admission(ring: SchoolKeyring, secret: string, crypto: KeyCrypto): Promise<string> {
  return toHex(await crypto.mac(fromHex(secret), ascii(`minhajna/school-key/admit\n${ring.school}\n${ring.tag}`)));
}

/**
 * Opens the first keyring a new device receives, only when the device that
 * scanned its QR code admitted it. The new device stops using its secret
 * once this succeeds.
 */
export async function openAdmitted(
  ring: unknown,
  admitted: string,
  device: string,
  secret: string,
  crypto: KeyCrypto,
): Promise<OpenedKeyring | KeyringProblem> {
  if (!isKeyring(ring, crypto.publicKeyBytes)) return 'forged';
  if (!sameMac(await admission(ring, secret, crypto), admitted)) return 'forged';
  return openKeyring(ring, device, crypto);
}

/** A device's fingerprint over its ID and public key, such as 'ab12-cd34-ef56', which both screens show. */
export async function holderFingerprint(holder: Holder, crypto: KeyCrypto): Promise<string> {
  const bytes = await crypto.mac(ascii('minhajna/school-key/holder'), ascii(`${holder.id}\n${holder.publicKey}`));
  return (toHex(bytes.subarray(0, FINGERPRINT_BYTES)).match(/.{4}/gu) ?? []).join('-');
}

/** A kept wait that reads exactly as this device made it, or null. */
export function readSchoolWaiting(value: unknown, publicKeyBytes: number): SchoolWaiting | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { device, publicKey, pkcs8, secret, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length > 0 || typeof device !== 'string' || !ID.test(device)) return null;
  if (typeof publicKey !== 'string' || publicKey.length !== publicKeyBytes * 2 || !/^[0-9a-f]+$/u.test(publicKey)) {
    return null;
  }
  if (typeof pkcs8 !== 'string' || !PKCS8_TEXT.test(pkcs8) || typeof secret !== 'string') return null;
  return HOLDER_SECRET.test(secret) ? { device, publicKey, pkcs8, secret } : null;
}

/** The wait this store keeps, or null when there is none, it gave up, or a school's key is held since. */
export function keptWaiting(entries: readonly Entry[], publicKeyBytes: number): SchoolWaiting | null {
  let waiting: SchoolWaiting | null = null;
  for (const entry of entries) {
    const event = eventOf(entry);
    if (event?.kind === 'school.held') waiting = null;
    if (event?.kind === 'school.waiting') waiting = readSchoolWaiting(event.waiting, publicKeyBytes);
  }
  return waiting;
}
