// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school key and the devices that hold it (#550, PRD §5.10, §6.5). The
// key comes in epochs: the director's device makes the first, and removing a
// device makes the next, sealed only for the devices that remain, so a
// removed device opens nothing added after its removal. Each epoch is sealed
// for each holder's public key, bound to the school, the epoch and the
// device; adding a device seals every epoch for it. Any holder may add or
// remove a device, and each keyring names the device that made it (answer
// 555), which any holder could write, so it records who acted among honest
// holders and proves nothing against a dishonest one. A keyring carries a tag
// under its latest key, so neither the server that relays it nor a removed
// device can change it; each epoch is linked from the one before; and each
// keyring names the tag of the one it changed, one version up. Devices read
// the keyrings in the order the school's space holds them and adopt each that
// changes the one they hold, so of two changes to the same keyring the first
// in that order wins, and a removed device cannot get ahead of its removal
// once that is in the space. A device's own change is therefore only
// proposed: it keeps the keyring it holds, sends the change, and adopts it
// only when the space gives it back as the next keyring; when another came
// first, it adopts that one and makes its change again on top. A new device
// shows a one-time QR code with its ID, its public key and a one-time secret;
// the device that scans it admits it with a MAC under that secret, which the
// server never sees, so the server cannot hand it a keyring of its own, and
// whoever only photographs the code can do nothing without the server. A
// device's ID and keypair are its own for each school, so the server, which
// sees them and how many come and go, cannot link them elsewhere. Records are
// sealed under keys derived from an epoch's key for their purpose, never the
// epoch's key itself. Every removal adds an epoch for every holder, so a
// keyring grows with the years; re-keying it is for later.

import { canonicalJson } from './canonical.ts';
import { toHex, type RandomBytes } from './id.ts';
import {
  ascii,
  fromHex,
  ID,
  isHolder,
  isKeyring,
  SCHOOL,
  sameMac,
  type Holder,
  type KeyCrypto,
  type KeyringProblem,
  type SchoolEpoch,
  type SchoolKeyring,
} from './school-key-shape.ts';

export type { Holder, KeyCrypto, KeyringProblem, SchoolEpoch, SchoolKeyring } from './school-key-shape.ts';

/** A keyring this device has opened. Its keys serve only the keyring's own changes and `purposeKey`. */
export interface OpenedKeyring {
  readonly ring: SchoolKeyring;
  readonly keys: readonly Uint8Array[];
}

/** What a new device's QR code holds before its ID, public key and one-time secret. */
export const HOLDER_QR_PREFIX = 'minhajna-holder:1:';
export const SCHOOL_KEY_BYTES = 32;
const SECRET_BYTES = 16;
const PURPOSE = /^[a-z]+(?:-[a-z]+)*$/u;

async function macHex(crypto: KeyCrypto, key: Uint8Array, text: string): Promise<string> {
  return toHex(await crypto.mac(key, ascii(text)));
}

/** What binds a sealed key to its school, epoch and device. */
export function sealInfo(school: string, epoch: number, device: string): string {
  return `minhajna/school-key/1\n${school}\n${epoch}\n${device}`;
}

function commitOf(crypto: KeyCrypto, key: Uint8Array): Promise<string> {
  return macHex(crypto, key, 'minhajna/school-key/commit');
}

function linkOf(crypto: KeyCrypto, school: string, epoch: number, commit: string, before: Uint8Array): Promise<string> {
  return macHex(crypto, before, `minhajna/school-key/link\n${school}\n${epoch}\n${commit}`);
}

function tagOf(crypto: KeyCrypto, ring: Omit<SchoolKeyring, 'tag'>, latest: Uint8Array): Promise<string> {
  const { school, version, previous, by, holders, epochs } = ring;
  const text = canonicalJson({ school, version, previous, by, holders, epochs });
  return macHex(crypto, latest, `minhajna/school-key/ring\n${text}`);
}

async function sealFor(crypto: KeyCrypto, school: string, epoch: number, key: Uint8Array, holders: readonly Holder[]) {
  const sealed: Record<string, string> = {};
  for (const { id, publicKey } of holders) {
    sealed[id] = toHex(await crypto.seal(key, fromHex(publicKey), sealInfo(school, epoch, id)));
  }
  return sealed;
}

async function tagged(crypto: KeyCrypto, ring: Omit<SchoolKeyring, 'tag'>, keys: readonly Uint8Array[]) {
  return { ring: { ...ring, tag: await tagOf(crypto, ring, keys.at(-1)!) }, keys };
}

function checkHolder(holder: Holder, crypto: KeyCrypto): void {
  if (!isHolder(holder, crypto.publicKeyBytes)) throw new RangeError('Not a device that can hold the key');
}

/** A new school's keyring, made on the director's device, which holds its first key. */
export async function startKeyring(
  school: string,
  director: Holder,
  crypto: KeyCrypto,
  random: RandomBytes,
): Promise<OpenedKeyring> {
  if (!SCHOOL.test(school)) throw new RangeError('A school is named by its space ID');
  checkHolder(director, crypto);
  const key = random(SCHOOL_KEY_BYTES);
  const commit = await commitOf(crypto, key);
  const link = await linkOf(crypto, school, 0, commit, key);
  const epoch = { number: 0, commit, link, sealed: await sealFor(crypto, school, 0, key, [director]) };
  const ring = { school, version: 1, previous: '', by: director.id, holders: [director], epochs: [epoch] };
  return tagged(crypto, ring, [key]);
}

/**
 * The keyring with one more device, every epoch sealed for it, made by the device `by`. It is a proposal: the
 * device sends it and keeps the keyring it holds until `acceptKeyring` gives this one back from the space.
 */
export async function addHolder(
  opened: OpenedKeyring,
  holder: Holder,
  by: string,
  crypto: KeyCrypto,
): Promise<OpenedKeyring> {
  const { ring, keys } = opened;
  checkHolder(holder, crypto);
  if (ring.holders.some((one) => one.id === holder.id)) throw new RangeError('The device already holds the key');
  if (!ring.holders.some((one) => one.id === by)) throw new RangeError('Only a holder changes the keyring');
  const epochs: SchoolEpoch[] = [];
  for (const [index, epoch] of ring.epochs.entries()) {
    const added = await sealFor(crypto, ring.school, epoch.number, keys[index]!, [holder]);
    epochs.push({ ...epoch, sealed: { ...epoch.sealed, ...added } });
  }
  const change = { school: ring.school, version: ring.version + 1, previous: ring.tag, by };
  return tagged(crypto, { ...change, holders: [...ring.holders, holder], epochs }, keys);
}

/**
 * The keyring without a device, under a new key it is never given, made by the device `by`. It is a proposal:
 * the device sends it and keeps the keyring it holds until `acceptKeyring` gives this one back from the space.
 */
export async function removeHolder(
  opened: OpenedKeyring,
  device: string,
  by: string,
  crypto: KeyCrypto,
  random: RandomBytes,
): Promise<OpenedKeyring> {
  const { ring, keys } = opened;
  const holders = ring.holders.filter((one) => one.id !== device);
  if (holders.length === ring.holders.length) throw new RangeError('The device does not hold the key');
  if (holders.length === 0) throw new RangeError('The last device cannot be removed');
  if (!ring.holders.some((one) => one.id === by)) throw new RangeError('Only a holder changes the keyring');
  const key = random(SCHOOL_KEY_BYTES);
  const number = ring.epochs.length;
  const commit = await commitOf(crypto, key);
  const epochs: SchoolEpoch[] = ring.epochs.map((epoch) => {
    const sealed = Object.fromEntries(Object.entries(epoch.sealed).filter(([id]) => id !== device));
    return { ...epoch, sealed };
  });
  const link = await linkOf(crypto, ring.school, number, commit, keys.at(-1)!);
  epochs.push({ number, commit, link, sealed: await sealFor(crypto, ring.school, number, key, holders) });
  const change = { school: ring.school, version: ring.version + 1, previous: ring.tag, by };
  return tagged(crypto, { ...change, holders, epochs }, [...keys, key]);
}

/** Opens a keyring on this device, checking its shape, every key, link and its tag. */
export async function openKeyring(
  ring: unknown,
  device: string,
  crypto: KeyCrypto,
): Promise<OpenedKeyring | KeyringProblem> {
  if (!isKeyring(ring, crypto.publicKeyBytes)) return 'forged';
  const keys: Uint8Array[] = [];
  for (const [index, epoch] of ring.epochs.entries()) {
    const sealed = epoch.sealed[device];
    if (sealed === undefined) return 'removed';
    const key = await crypto.open(fromHex(sealed), sealInfo(ring.school, index, device));
    if (key === null) return 'removed';
    if (!sameMac(await commitOf(crypto, key), epoch.commit)) return 'forged';
    const before = index === 0 ? key : keys[index - 1]!;
    if (!sameMac(await linkOf(crypto, ring.school, index, epoch.commit, before), epoch.link)) return 'forged';
    keys.push(key);
  }
  return sameMac(await tagOf(crypto, ring, keys.at(-1)!), ring.tag) ? { ring, keys } : 'forged';
}

/**
 * Adopts the next keyring of the school's space on a device that holds
 * `held`: only one that changes it, one version up, made by one of its
 * holders, keeping every epoch it holds. The one it holds again changes
 * nothing. The order is checked before the keyring is opened, so a device
 * is told it was removed only by the keyring that follows the one it holds,
 * never by a change that lost. The server can make any keyring read as
 * 'older' or 'forked', so both mean only that the device skips it and reads
 * the next, not that anything was attacked.
 */
export async function acceptKeyring(
  held: OpenedKeyring,
  ring: unknown,
  device: string,
  crypto: KeyCrypto,
): Promise<OpenedKeyring | KeyringProblem> {
  if (!isKeyring(ring, crypto.publicKeyBytes) || ring.school !== held.ring.school) return 'forged';
  if (ring.version < held.ring.version) return 'older';
  if (ring.version === held.ring.version) return sameMac(ring.tag, held.ring.tag) ? held : 'forked';
  if (ring.version !== held.ring.version + 1 || !sameMac(ring.previous, held.ring.tag)) return 'forked';
  const kept = held.ring.epochs.every((epoch, index) => ring.epochs[index]?.commit === epoch.commit);
  if (!kept || !held.ring.holders.some((one) => one.id === ring.by)) return 'forked';
  return openKeyring(ring, device, crypto);
}

/** The latest epoch, under which new records are sealed. */
export function latestEpoch(opened: OpenedKeyring): number {
  return opened.keys.length - 1;
}

/** The key for one purpose in one epoch, such as 'records', derived from the epoch's key. */
export async function purposeKey(
  opened: OpenedKeyring,
  epoch: number,
  purpose: string,
  crypto: KeyCrypto,
): Promise<Uint8Array> {
  const key = opened.keys[epoch];
  if (key === undefined || !PURPOSE.test(purpose)) throw new RangeError('No such epoch or purpose');
  return crypto.mac(key, ascii(`minhajna/school-key/purpose\n${opened.ring.school}\n${epoch}\n${purpose}`));
}

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
  return fine && /^[0-9a-f]{32}$/u.test(secret) ? { holder: { id, publicKey }, secret } : null;
}

/** The admission the scanning device sends with the keyring: a MAC of its tag under the new device's secret. */
export function admission(ring: SchoolKeyring, secret: string, crypto: KeyCrypto): Promise<string> {
  return macHex(crypto, fromHex(secret), `minhajna/school-key/admit\n${ring.school}\n${ring.tag}`);
}

/**
 * Opens the first keyring a new device receives, only when the device that
 * scanned its QR code admitted it. The new device forgets its secret once
 * this succeeds.
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
