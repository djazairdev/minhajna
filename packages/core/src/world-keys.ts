// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A demo world's keys (#556, choice D4 of the 0.7.0 demo, answer 568). From the
// code's secret, which never leaves the device, a slow derivation salted with
// the world's ID (the platform's PBKDF2-SHA256, WORLD_KDF_ROUNDS rounds) gives
// one master key, and from it two: the world's pass, which the device sends in
// X-World-Pass and the server keeps only hashed, and the key that seals the
// world's private keys. The sealed world, with the world's kind (part of
// format 1 since #560, before any world was live), is what the starting
// device sends the server and every joining device opens: the world's
// stand-ins for the state's signing keys, each with what it may sign
// (calendars, plan packs), its public half, its fingerprint and its private
// half, as ASCII JSON, sealed with the platform's AES-256-GCM bound to the
// world's ID. Every file a world's key signs names the world (signed-read.ts):
// real mode refuses it, and another world refuses it too. The certificates of
// the world's stand-in CA are a stand-in's and name their world as well
// (certify.ts). Timetable packages are signed with a teacher's or a school's
// key, never a world's, once #577 signs them.

import { canonicalJson } from './canonical.ts';
import { readWorldCode, worldCodeSecret, worldIdOfCode } from './world-code.ts';
import { ascii } from './school-key-shape.ts';
import {
  parseTrustedKeys,
  SIGNED_FORMAT,
  utf8Length,
  WORLD_KEY_PREFIX,
  worldSignedText,
  type TrustedKey,
  type Verifier,
} from './signed-read.ts';

/** PBKDF2-SHA256 rounds: OWASP's figure for 2023, about a second on a mid-range phone. */
export const WORLD_KDF_ROUNDS = 600_000;
export const WORLD_KEYS_FORMAT = 'minhajna/world-keys/1';
/** The most the server keeps of a sealed world, in base64url characters. */
export const MOST_SEALED_WORLD = 48 * 1024;

/** The platform's PBKDF2-SHA256, giving 32 bytes. */
export type WorldKdf = (secret: Uint8Array, salt: Uint8Array, rounds: number) => Promise<Uint8Array>;
/** The platform's HMAC-SHA256. */
export type WorldMac = (key: Uint8Array, data: Uint8Array) => Promise<Uint8Array>;

/**
 * The platform's AES-256-GCM, its nonce first. `seal` draws a fresh random
 * 12-byte nonce every time, never a counter, since one key seals each time
 * the world's keys are sealed again; `open` answers null for anything it
 * cannot open.
 */
export interface WorldCipher {
  readonly seal: (key: Uint8Array, plain: Uint8Array, additional: Uint8Array) => Promise<Uint8Array>;
  readonly open: (key: Uint8Array, sealed: Uint8Array, additional: Uint8Array) => Promise<Uint8Array | null>;
}

export interface WorldSecrets {
  readonly world: string;
  /** What the device sends in X-World-Pass: 32 bytes in base64url. */
  readonly pass: string;
  readonly sealing: Uint8Array;
}

/** The world's kind: every role from the Ministry to the teacher, or teachers in teacher mode (answer 572). */
export const WORLD_KINDS = ['national', 'teachers'] as const;
export type WorldKind = (typeof WORLD_KINDS)[number];

/** A world's keys: their public halves as the app trusts them, and their private halves by key ID. */
export interface WorldKeys {
  readonly world: string;
  readonly kind: WorldKind;
  readonly trusted: readonly TrustedKey[];
  /** PKCS #8, DER, base64. */
  readonly private: Readonly<Record<string, string>>;
}

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** A private half as a world keeps it: PKCS #8 DER in base64, at most 400 characters. */
export const PKCS8_TEXT = /^[A-Za-z0-9+/]{4,400}={0,2}$/u;

/** Bytes in base64url without padding, as the relay and the world's pass carry them. */
export function toBase64Url(bytes: Uint8Array): string {
  let text = '';
  for (let at = 0; at < bytes.length; at += 3) {
    const chunk = (bytes[at]! << 16) | ((bytes[at + 1] ?? 0) << 8) | (bytes[at + 2] ?? 0);
    const count = Math.min(4, Math.ceil(((bytes.length - at) * 8) / 6));
    for (let one = 0; one < count; one++) text += BASE64URL[(chunk >> (18 - 6 * one)) & 63];
  }
  return text;
}

/** The bytes of base64url without padding, or null when it is not written the one way. */
export function fromBase64Url(text: string): Uint8Array | null {
  if (text.length % 4 === 1 || [...text].some((one) => !BASE64URL.includes(one))) return null;
  const bytes = new Uint8Array(Math.floor((text.length * 6) / 8));
  let bits = 0;
  let value = 0;
  let at = 0;
  for (const one of text) {
    value = (value << 6) | BASE64URL.indexOf(one);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[at++] = (value >> bits) & 255;
    }
  }
  return (value & ((1 << bits) - 1)) === 0 ? bytes : null;
}

/** The world's ID, its pass and the key that seals its keys, worked out on the device from its code. */
export async function worldSecrets(code: string, kdf: WorldKdf, mac: WorldMac): Promise<WorldSecrets> {
  const read = readWorldCode(code);
  if ('problem' in read) throw new RangeError('Not a world code');
  const world = worldIdOfCode(read.code);
  const master = await kdf(ascii(worldCodeSecret(read.code)), ascii(`minhajna/world/${world}`), WORLD_KDF_ROUNDS);
  if (master.length !== 32) throw new RangeError('The derivation gives 32 bytes');
  const [pass, sealing] = [
    await mac(master, ascii('minhajna/world/pass')),
    await mac(master, ascii('minhajna/world/sealing')),
  ];
  if (pass.length !== 32 || sealing.length !== 32) throw new RangeError('The derivation gives 32 bytes');
  return { world, pass: toBase64Url(pass), sealing };
}

function sealedFor(world: string): Uint8Array {
  return ascii(`${WORLD_KEYS_FORMAT}\n${world}`);
}

function readKeys(value: unknown, world: string): WorldKeys | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { format, world: named, kind, trusted, private: halves, ...rest } = value as Record<string, unknown>;
  if (format !== WORLD_KEYS_FORMAT || named !== world || Object.keys(rest).length > 0) return null;
  if (!WORLD_KINDS.includes(kind as WorldKind)) return null;
  const parsed = parseTrustedKeys({ format: 1, keys: trusted });
  if (!parsed.ok || typeof halves !== 'object' || halves === null || Array.isArray(halves)) return null;
  const ids = parsed.value.map((key) => key.id);
  if (!ids.every((id) => id.startsWith(WORLD_KEY_PREFIX))) return null;
  const entries = Object.entries(halves);
  if (entries.length !== ids.length || !entries.every(([id, half]) => ids.includes(id) && typeof half === 'string'))
    return null;
  if (!entries.every(([, half]) => PKCS8_TEXT.test(half as string))) return null;
  return { world, kind: kind as WorldKind, trusted: parsed.value, private: halves as Record<string, string> };
}

/** The platform's ECDSA P-256 over a text's UTF-8 bytes with a private half, as signed-read.ts checks it. */
export type WorldSigner = (pkcs8: string, text: string) => Promise<string>;

/** Whether each private half signs what its public half checks. */
async function pairsHold(keys: WorldKeys, sign: WorldSigner, verify: Verifier): Promise<boolean> {
  const probe = worldSignedText(keys.world, 'minhajna/world/probe');
  for (const key of keys.trusted) {
    try {
      if (!(await verify(key.spki, probe, await sign(keys.private[key.id]!, probe)))) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/** A world's keys sealed for the server, as base64url; only its code opens them. */
export async function sealWorldKeys(
  keys: WorldKeys,
  secrets: WorldSecrets,
  cipher: WorldCipher,
  pair: { readonly sign: WorldSigner; readonly verify: Verifier },
): Promise<string> {
  const plain = {
    format: WORLD_KEYS_FORMAT,
    world: keys.world,
    kind: keys.kind,
    trusted: keys.trusted,
    private: keys.private,
  };
  if (keys.world !== secrets.world || readKeys(plain, secrets.world) === null) {
    throw new RangeError('Not keys of this world');
  }
  if (!(await pairsHold(keys, pair.sign, pair.verify))) throw new RangeError('Not keys of this world: a pair differs');
  const text = canonicalJson(plain).replace(/[^\x20-\x7e]/gu, (one) => {
    return one
      .split('')
      .map((unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, '0')}`)
      .join('');
  });
  const bytes = ascii(text);
  const sealed = toBase64Url(await cipher.seal(secrets.sealing, bytes, sealedFor(secrets.world)));
  if (sealed.length > MOST_SEALED_WORLD) throw new RangeError('Too many keys for the server to keep');
  return sealed;
}

/** A sealed world's keys, opened with its code's secrets, or null when they do not open or are not its keys. */
export async function openWorldKeys(
  sealed: string,
  secrets: WorldSecrets,
  cipher: WorldCipher,
): Promise<WorldKeys | null> {
  const bytes = sealed.length > MOST_SEALED_WORLD ? null : fromBase64Url(sealed);
  const plain = bytes === null ? null : await cipher.open(secrets.sealing, bytes, sealedFor(secrets.world));
  if (plain === null) return null;
  if (plain.some((byte) => byte < 0x20 || byte > 0x7e)) return null;
  try {
    let text = '';
    for (const byte of plain) text += String.fromCharCode(byte);
    return readKeys(JSON.parse(text), secrets.world);
  } catch {
    return null;
  }
}

/** A file signed with one of a world's keys, naming the world, as its stand-in for the state writes it. */
export async function worldSignedFile(
  keys: WorldKeys,
  key: string,
  payload: string,
  sign: WorldSigner,
): Promise<string> {
  const half = keys.private[key];
  if (half === undefined || payload === '' || utf8Length(payload) === null) {
    throw new RangeError('Not a key of this world, or not a payload');
  }
  const signature = await sign(half, worldSignedText(keys.world, payload));
  const version = { major: 1, minor: 0 };
  return JSON.stringify({ format: SIGNED_FORMAT, version, world: keys.world, key, payload, signature });
}
