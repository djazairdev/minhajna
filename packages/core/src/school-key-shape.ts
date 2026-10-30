// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school keyring's shape (#550): its types, and the strict check a
// keyring must pass before a device reads anything in it, since it comes
// through the server. Every field is ASCII of a fixed form, with no field
// beyond those named, so the text its tag covers is the text a device
// reads. The school key itself is in school-key.ts.

export interface KeyCrypto {
  /** Seals a key so that only the device holding the public key's private key opens it, bound to `info`. */
  readonly seal: (key: Uint8Array, publicKey: Uint8Array, info: string) => Promise<Uint8Array>;
  /** Opens what was sealed for this device under `info`, or null when it cannot. */
  readonly open: (sealed: Uint8Array, info: string) => Promise<Uint8Array | null>;
  readonly mac: (key: Uint8Array, data: Uint8Array) => Promise<Uint8Array>;
  /** The length of a public key on this platform, such as 32 for X25519. */
  readonly publicKeyBytes: number;
}

export interface Holder {
  readonly id: string;
  /** The device's public key, in hex. */
  readonly publicKey: string;
}

export interface SchoolEpoch {
  readonly number: number;
  /** The key's commitment, so that a wrong key opened is found. */
  readonly commit: string;
  /** The link from the epoch before, under its key, or under this one for the first. */
  readonly link: string;
  /** The key sealed for each holder, by device ID, in hex. */
  readonly sealed: Readonly<Record<string, string>>;
}

export interface SchoolKeyring {
  readonly school: string;
  /** 1 for the first keyring, and one more at each change. */
  readonly version: number;
  /** The tag of the keyring this one changed, or '' for the first. */
  readonly previous: string;
  /** The device that made this keyring. */
  readonly by: string;
  readonly holders: readonly Holder[];
  readonly epochs: readonly SchoolEpoch[];
  /** A MAC of all the above under the latest epoch's key. */
  readonly tag: string;
}

export type KeyringProblem = 'removed' | 'forged' | 'older' | 'forked';

export const ID = /^[0-9a-f]{32}$/u;
export const MAC = /^[0-9a-f]{64}$/u;
const HEX = /^(?:[0-9a-f]{2})+$/u;
/** A school's space ID, as the relay takes it. */
export const SCHOOL = /^[A-Za-z0-9_-]{16,43}$/u;

/** Text as bytes; anything but printable ASCII and line feeds is refused, so no two texts give the same bytes. */
export function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, (one) => {
    const code = one.charCodeAt(0);
    if ((code < 0x20 && code !== 0x0a) || code > 0x7e) throw new RangeError('Only ASCII is MACed');
    return code;
  });
}

export function fromHex(hex: string): Uint8Array {
  if (!HEX.test(hex)) throw new RangeError('Not hex');
  return Uint8Array.from(hex.match(/../gu) ?? [], (pair) => parseInt(pair, 16));
}

/** Whether two MACs in hex are the same, in a time that does not depend on where they differ. */
export function sameMac(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let differ = 0;
  for (let index = 0; index < a.length; index++) differ |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return differ === 0;
}

export function isHolder(value: unknown, publicKeyBytes: number): value is Holder {
  if (typeof value !== 'object' || value === null || Object.keys(value).length !== 2) return false;
  const { id, publicKey } = value as Record<string, unknown>;
  return (
    typeof id === 'string' &&
    ID.test(id) &&
    typeof publicKey === 'string' &&
    publicKey.length === publicKeyBytes * 2 &&
    HEX.test(publicKey)
  );
}

function hasOnly(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === fields.length && fields.every((field) => keys.includes(field));
}

function isEpoch(value: unknown, index: number, holders: ReadonlySet<string>, latest: boolean): boolean {
  if (!hasOnly(value, ['number', 'commit', 'link', 'sealed'])) return false;
  const { number, commit, link, sealed } = value;
  if (number !== index || typeof commit !== 'string' || !MAC.test(commit)) return false;
  if (typeof link !== 'string' || !MAC.test(link)) return false;
  if (typeof sealed !== 'object' || sealed === null || Array.isArray(sealed)) return false;
  const entries = Object.entries(sealed);
  const fine = entries.every(([id, one]) => holders.has(id) && typeof one === 'string' && HEX.test(one));
  return fine && (!latest || entries.length === holders.size);
}

/** Whether a keyring that came from elsewhere has exactly the shape of one. */
export function isKeyring(value: unknown, publicKeyBytes: number): value is SchoolKeyring {
  const fields = ['school', 'version', 'previous', 'by', 'holders', 'epochs', 'tag'];
  if (!hasOnly(value, fields)) return false;
  const { school, version, previous, by, holders, epochs, tag } = value;
  if (typeof school !== 'string' || !SCHOOL.test(school) || typeof tag !== 'string' || !MAC.test(tag)) return false;
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) return false;
  if (typeof previous !== 'string' || (version === 1 ? previous !== '' : !MAC.test(previous))) return false;
  if (typeof by !== 'string' || !ID.test(by) || !Array.isArray(holders) || !Array.isArray(epochs)) return false;
  if (holders.length === 0 || epochs.length === 0) return false;
  if (!holders.every((holder) => isHolder(holder, publicKeyBytes))) return false;
  const ids = new Set(holders.map((holder: Holder) => holder.id));
  if (ids.size !== holders.length) return false;
  return epochs.every((epoch, index) => isEpoch(epoch, index, ids, index === epochs.length - 1));
}
