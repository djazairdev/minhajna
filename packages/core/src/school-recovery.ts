// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school key's recovery, split between the school and its directorate
// (#551, PRD §6.5, §7.11). The director's device makes two parts in the form
// of the teacher's recovery key: the school's, printed for its safe, and the
// directorate's, printed on a second sheet or sealed for a directorate
// device's public key, as the school chooses (answer 556). Both together give
// the keypair of one more holder of the keyring, so every epoch is sealed for
// it as for any device and neither part alone opens anything. The
// directorate's public key must come from the directorate itself, such as
// from its QR code, never from the server. The device that makes the parts
// forgets both once they are printed or sealed, and since it could have kept
// them, removing it replaces the recovery with new parts (answer 558). The
// recovery's ID marks it as one in its first half, derived from its public
// key, and names the device that made it in its second, so the latest keyring
// alone tells who made it; like `by`, that is written by honest holders. A
// device that recovers adds itself as a holder in the recovery's name and
// then replaces the recovery with new parts at once, since it has seen both
// (answer 557). Any holder could give a device an ID that looks like a
// recovery's; the app shows the recovery among the holders and warns when
// more than one looks like it, and a renewal removes them all. A device that
// recovers trusts the server to show every keyring of the space: one that
// withholds the later ones leaves it on an old keyring, whose changes the
// holders refuse as forked. So after a recovery the app shows the keyring's
// fingerprint, to compare with a remaining holder or the directorate.

import { toHex, type RandomBytes } from './id.ts';
import { makeRecoveryKey, readRecoveryKey } from './recovery-key.ts';
import {
  ascii,
  fromHex,
  isKeyring,
  SCHOOL,
  type Holder,
  type KeyCrypto,
  type SchoolKeyring,
} from './school-key-shape.ts';
import { acceptKeyring, addHolder, openKeyring, removeHolder, type OpenedKeyring } from './school-key.ts';

/** The two parts of a school's recovery, each a recovery key of 24 characters. */
export interface RecoveryParts {
  readonly school: string;
  readonly directorate: string;
}

/** The recovery's keypair from its seed, the same each time for the same seed, as the platform makes it. */
export type RecoveryDevice = (
  seed: Uint8Array,
) => Promise<{ readonly crypto: KeyCrypto; readonly publicKey: Uint8Array }>;

/** The recovery as a holder of the keyring, with the crypto that opens what is sealed for it. */
export interface Recovery {
  readonly holder: Holder;
  readonly crypto: KeyCrypto;
}

export interface Recovered {
  readonly opened: OpenedKeyring;
  readonly recovery: Recovery;
}

/** New parts for a school's recovery. */
export function makeRecoveryParts(random: RandomBytes): RecoveryParts {
  const parts = { school: makeRecoveryKey(random), directorate: makeRecoveryKey(random) };
  if (parts.school === parts.directorate) throw new RangeError('The two parts must differ');
  return parts;
}

function partsOf(parts: RecoveryParts): readonly [string, string] {
  const school = readRecoveryKey(parts.school);
  const directorate = readRecoveryKey(parts.directorate);
  if (school === null || directorate === null) throw new RangeError('A part is not a recovery key');
  return [school, directorate];
}

async function macHex(crypto: KeyCrypto, publicKey: Uint8Array, text: string): Promise<string> {
  return toHex(await crypto.mac(publicKey, ascii(text))).slice(0, 16);
}

const marked = (crypto: KeyCrypto, publicKey: Uint8Array) =>
  macHex(crypto, publicKey, 'minhajna/school-key/recovery-holder');
const madeBy = (crypto: KeyCrypto, publicKey: Uint8Array, maker: string) =>
  macHex(crypto, publicKey, `minhajna/school-key/recovery-maker\n${maker}`);

async function recoveryKeypair(school: string, parts: RecoveryParts, crypto: KeyCrypto, device: RecoveryDevice) {
  if (!SCHOOL.test(school)) throw new RangeError('A school is named by its space ID');
  const [own, theirs] = partsOf(parts);
  const seed = await crypto.mac(ascii(own), ascii(`minhajna/school-key/recovery\n${school}\n${theirs}`));
  const made = await device(seed);
  if (made.publicKey.length !== crypto.publicKeyBytes) throw new RangeError('Not a recovery keypair');
  return made;
}

/**
 * The holder that both parts make for this school, made by the device
 * `maker`: its ID marks it as a recovery in its first half, and names its
 * maker in its second, so the latest keyring alone tells who made it.
 */
export async function recoveryHolder(
  school: string,
  parts: RecoveryParts,
  maker: string,
  crypto: KeyCrypto,
  device: RecoveryDevice,
): Promise<Recovery> {
  const made = await recoveryKeypair(school, parts, crypto, device);
  const id = `${await marked(crypto, made.publicKey)}${await madeBy(crypto, made.publicKey, maker)}`;
  return { holder: { id, publicKey: toHex(made.publicKey) }, crypto: made.crypto };
}

/** Whether a holder of the keyring is its recovery rather than a device. */
export async function isRecoveryHolder(holder: Holder, crypto: KeyCrypto): Promise<boolean> {
  return holder.id.slice(0, 16) === (await marked(crypto, fromHex(holder.publicKey)));
}

async function recoveriesOf(ring: SchoolKeyring, crypto: KeyCrypto): Promise<readonly Holder[]> {
  const found: Holder[] = [];
  for (const holder of ring.holders) if (await isRecoveryHolder(holder, crypto)) found.push(holder);
  return found;
}

async function checkMaker(ring: SchoolKeyring, by: string, crypto: KeyCrypto): Promise<void> {
  const maker = ring.holders.find((one) => one.id === by);
  if (maker === undefined || (await isRecoveryHolder(maker, crypto))) {
    throw new RangeError('Only a device that holds the key makes a recovery');
  }
}

/** What a holder compares after a recovery: the keyring's version and 64 bits of its tag, in groups of four. */
export function keyringFingerprint(ring: SchoolKeyring): string {
  return [String(ring.version), ...(ring.tag.slice(0, 16).match(/.{4}/gu) ?? [])].join('-');
}

/** The keyring with a recovery made from the parts, by the device `by`; a proposal, as `addHolder` makes. */
export async function addRecovery(
  opened: OpenedKeyring,
  parts: RecoveryParts,
  by: string,
  crypto: KeyCrypto,
  device: RecoveryDevice,
): Promise<OpenedKeyring> {
  if ((await recoveriesOf(opened.ring, crypto)).length > 0) throw new RangeError('The keyring has a recovery already');
  await checkMaker(opened.ring, by, crypto);
  const recovery = await recoveryHolder(opened.ring.school, parts, by, crypto, device);
  return addHolder(opened, recovery.holder, by, crypto);
}

/**
 * Replaces the recovery with one from new parts (answers 557, 558): the
 * keyring with the new recovery, then without each holder that looked like
 * one, each under a new epoch they are never given. All are proposals, sent
 * in this order; when another change wins first, the rest come back forked
 * and are made again on top of it.
 */
export async function renewRecovery(
  opened: OpenedKeyring,
  parts: RecoveryParts,
  by: string,
  crypto: KeyCrypto,
  device: RecoveryDevice,
  random: RandomBytes,
): Promise<readonly OpenedKeyring[]> {
  const old = await recoveriesOf(opened.ring, crypto);
  if (old.length === 0) throw new RangeError('The keyring has no recovery');
  await checkMaker(opened.ring, by, crypto);
  const recovery = await recoveryHolder(opened.ring.school, parts, by, crypto, device);
  const changes = [await addHolder(opened, recovery.holder, by, crypto)];
  for (const { id } of old) changes.push(await removeHolder(changes.at(-1)!, id, by, crypto, random));
  return changes;
}

/** Whether a device made a recovery that the keyring holds, as the recovery's ID names it. */
export async function madeRecovery(ring: SchoolKeyring, device: string, crypto: KeyCrypto): Promise<boolean> {
  for (const one of await recoveriesOf(ring, crypto)) {
    if (one.id.slice(16) === (await madeBy(crypto, fromHex(one.publicKey), device))) return true;
  }
  return false;
}

/**
 * Whether the keyring holds a recovery whose maker no longer holds the key,
 * as when it was removed without `removeDevice`. The app checks each
 * keyring it adopts and, when this is true, asks for new parts.
 */
export async function recoveryOrphaned(ring: SchoolKeyring, crypto: KeyCrypto): Promise<boolean> {
  for (const one of await recoveriesOf(ring, crypto)) {
    let made = false;
    for (const holder of ring.holders)
      made ||= one.id.slice(16) === (await madeBy(crypto, fromHex(one.publicKey), holder.id));
    if (!made) return true;
  }
  return false;
}

/**
 * Removes a device from the keyring, as `removeHolder` does, but when it
 * made the current recovery, first replaces the recovery with `renewal`'s
 * new parts (answer 558), so the removed device opens nothing added after.
 * The changes are proposals, sent in order.
 */
export async function removeDevice(
  opened: OpenedKeyring,
  removed: string,
  by: string,
  crypto: KeyCrypto,
  random: RandomBytes,
  renewal?: { readonly parts: RecoveryParts; readonly device: RecoveryDevice },
): Promise<readonly OpenedKeyring[]> {
  if (!(await madeRecovery(opened.ring, removed, crypto)))
    return [await removeHolder(opened, removed, by, crypto, random)];
  if (renewal === undefined) throw new RangeError('The device made the recovery, so new parts are needed');
  const changes = await renewRecovery(opened, renewal.parts, by, crypto, renewal.device, random);
  return [...changes, await removeHolder(changes.at(-1)!, removed, by, crypto, random)];
}

/**
 * Opens a school's keyring with both parts on a device that holds no key,
 * reading the keyrings of the school's space in order and trusting the
 * server to show them all: from the first the recovery opens, it adopts
 * each next one as a holder would. 'wrong' when the parts open none, and
 * 'replaced' when a later keyring dropped them.
 */
export async function recoverKeyring(
  school: string,
  rings: readonly unknown[],
  parts: RecoveryParts,
  crypto: KeyCrypto,
  device: RecoveryDevice,
): Promise<Recovered | 'wrong' | 'replaced'> {
  const made = await recoveryKeypair(school, parts, crypto, device);
  const publicKey = toHex(made.publicKey);
  let held: Recovered | undefined;
  for (const ring of rings) {
    if (held !== undefined) {
      const next = await acceptKeyring(held.opened, ring, held.recovery.holder.id, made.crypto);
      if (next === 'removed') return 'replaced';
      if (typeof next !== 'string') held = { ...held, opened: next };
    } else if (isKeyring(ring, crypto.publicKeyBytes) && ring.school === school) {
      const holder = ring.holders.find((one) => one.publicKey === publicKey);
      if (holder === undefined) continue;
      const opened = await openKeyring(ring, holder.id, made.crypto);
      if (typeof opened !== 'string') held = { opened, recovery: { holder, crypto: made.crypto } };
    }
  }
  return held ?? 'wrong';
}

function partInfo(school: string): string {
  return `minhajna/school-key/directorate-part\n${school}`;
}

/** The directorate's part sealed for a directorate device's public key, in hex, when the school chooses that. */
export async function sealDirectoratePart(
  school: string,
  parts: RecoveryParts,
  directorateKey: string,
  crypto: KeyCrypto,
): Promise<string> {
  const publicKey = fromHex(directorateKey);
  if (publicKey.length !== crypto.publicKeyBytes) throw new RangeError('Not a directorate device’s public key');
  const [, theirs] = partsOf(parts);
  return toHex(await crypto.seal(ascii(theirs), publicKey, partInfo(school)));
}

/** The directorate's part, opened on the directorate device it was sealed for, or null. */
export async function openDirectoratePart(school: string, sealed: string, crypto: KeyCrypto): Promise<string | null> {
  let bytes: Uint8Array | null;
  try {
    bytes = await crypto.open(fromHex(sealed), partInfo(school));
  } catch {
    return null;
  }
  const text = bytes === null ? '' : String.fromCharCode(...bytes);
  return readRecoveryKey(text) === text ? text : null;
}
