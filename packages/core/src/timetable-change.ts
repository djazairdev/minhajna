// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A change of the timetable keyring as its space holds it (#552), and what
// vouches for it: its shape; the grant, a MAC under the school key's
// purpose key for timetable grants, which names the epoch of the school key
// it was made under, which holders are preparers and which devices of the
// school key are kept out until their removal lands; and for each preparer
// that held the keyring before, a MAC under a key from its secret and the
// keyring's latest key before the change, over the change and the new
// secret sealed for it, if any. A preparer's secret is derived from the
// school key's epoch, so every device that holds the school key works it
// out and none keeps a list. The key a preparer uses for timetables is
// here too; the operations are in timetable-key.ts.

import { canonicalJson } from './canonical.ts';
import { toHex } from './id.ts';
import { ascii, fromHex, ID, isKeyring, MAC, type KeyCrypto, type SchoolKeyring } from './school-key-shape.ts';
import { purposeKey, type OpenedKeyring } from './school-key.ts';

export interface TimetableChange {
  readonly ring: SchoolKeyring;
  /** The epoch of the school key whose purpose keys made `grant` and the preparers' secrets. */
  readonly epoch: number;
  /** The holders that are preparers, by device ID, in order. */
  readonly preparers: readonly string[];
  /** Devices of the school key kept out of the timetable keyring until their removal lands, in order. */
  readonly dropped: readonly string[];
  readonly grant: string;
  /** For each preparer that held the keyring before, a MAC of the change under a key from its secret. */
  readonly vouched: Readonly<Record<string, string>>;
  /** A preparer's secret for `epoch`, sealed for its device, when it is new to the preparer. */
  readonly renewed: Readonly<Record<string, string>>;
}

/** The timetable keyring as a device holds it: opened, the change that made it, and a preparer's secret. */
export interface HeldTimetable {
  readonly opened: OpenedKeyring;
  readonly change: TimetableChange;
  readonly secret: string | null;
}

/** What the timetable key opens: the school's timetables and the assignments they are built from. */
export const TIMETABLE_PURPOSES = ['timetables', 'assignments'] as const;
export type TimetablePurpose = (typeof TIMETABLE_PURPOSES)[number];

const SECRET_BYTES = 16;
const HEX = /^(?:[0-9a-f]{2})+$/u;

type Granted = Pick<TimetableChange, 'ring' | 'epoch' | 'preparers' | 'dropped'>;

function changeText({ ring, epoch, preparers, dropped }: Granted): string {
  const lists = `${preparers.join(',')}\n${dropped.join(',')}`;
  return `minhajna/timetable/change\n${ring.school}\n${epoch}\n${lists}\n${canonicalJson(ring)}`;
}

function isIds(value: unknown): value is readonly string[] {
  if (!Array.isArray(value) || !value.every((id) => typeof id === 'string' && ID.test(id))) return false;
  return value.every((id: string, index) => index === 0 || value[index - 1] < id);
}

/** The grant a device that holds the school key makes for a change. */
export async function grantOf(school: OpenedKeyring, change: Granted, crypto: KeyCrypto): Promise<string> {
  const key = await purposeKey(school, change.epoch, 'timetable-grant', crypto);
  return toHex(await crypto.mac(key, ascii(changeText(change))));
}

/** A preparer's secret in one epoch of the school key, which every device that holds the school key works out. */
export async function preparerSecret(
  school: OpenedKeyring,
  epoch: number,
  preparer: string,
  crypto: KeyCrypto,
): Promise<string> {
  const key = await purposeKey(school, epoch, 'timetable-preparer', crypto);
  return toHex(await crypto.mac(key, ascii(`minhajna/timetable/preparer\n${preparer}`))).slice(0, SECRET_BYTES * 2);
}

/** A preparer's MAC of a change, under its secret and the latest key of the keyring the change follows. */
export async function vouchOf(
  secret: string,
  before: OpenedKeyring,
  change: Granted & Pick<TimetableChange, 'renewed'>,
  preparer: string,
  crypto: KeyCrypto,
): Promise<string> {
  const key = await crypto.mac(before.keys.at(-1)!, ascii(`minhajna/timetable/vouch\n${secret}`));
  const text = `${changeText(change)}\n${preparer}\n${change.renewed[preparer] ?? ''}`;
  return toHex(await crypto.mac(key, ascii(text)));
}

/** What binds a preparer's secret to the keyring it came with. */
export function renewInfo(ring: SchoolKeyring, preparer: string): string {
  return `minhajna/timetable/secret\n${ring.school}\n${ring.tag}\n${preparer}`;
}

/** A preparer's secret sealed for its device. */
export async function sealSecret(ring: SchoolKeyring, preparer: string, secret: string, crypto: KeyCrypto) {
  const { publicKey } = ring.holders.find((one) => one.id === preparer)!;
  return toHex(await crypto.seal(fromHex(secret), fromHex(publicKey), renewInfo(ring, preparer)));
}

/** A preparer's new secret, opened on its device, or null. */
export async function openRenewed(change: TimetableChange, device: string, crypto: KeyCrypto): Promise<string | null> {
  const sealed = change.renewed[device];
  if (sealed === undefined) return null;
  const bytes = await crypto.open(fromHex(sealed), renewInfo(change.ring, device));
  return bytes === null || bytes.length !== SECRET_BYTES ? null : toHex(bytes);
}

function isMap(value: unknown, form: RegExp): value is Readonly<Record<string, string>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.entries(value).every(([id, one]) => ID.test(id) && typeof one === 'string' && form.test(one));
}

/** Whether a change that came through the server has exactly the shape of one. */
export function isTimetableChange(value: unknown, publicKeyBytes: number): value is TimetableChange {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const { ring, epoch, preparers, dropped, grant, vouched, renewed, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length > 0 || !isKeyring(ring, publicKeyBytes)) return false;
  if (typeof epoch !== 'number' || !Number.isSafeInteger(epoch) || epoch < 0) return false;
  if (typeof grant !== 'string' || !MAC.test(grant) || !isMap(vouched, MAC) || !isMap(renewed, HEX)) return false;
  if (!isIds(preparers) || !isIds(dropped)) return false;
  const holders = new Set(ring.holders.map((one) => one.id));
  return preparers.every((id) => holders.has(id)) && !dropped.some((id) => preparers.includes(id));
}

/** The key for the school's timetables or assignments in one epoch of the timetable keyring. */
export async function timetableKey(
  timetable: OpenedKeyring,
  epoch: number,
  purpose: TimetablePurpose,
  crypto: KeyCrypto,
): Promise<Uint8Array> {
  if (!TIMETABLE_PURPOSES.includes(purpose)) throw new RangeError('The timetable key opens only timetables');
  return purposeKey(timetable, epoch, `timetable-${purpose}`, crypto);
}
