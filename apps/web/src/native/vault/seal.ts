// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How the PC seals the history (#250, answer 502), with the browser's own
// Web Crypto and no cryptography of the project's (PRD §6.5). The history's
// key is 32 random bytes for AES-GCM; while the history is open, the page
// holds it only in memory, as a key it cannot read back. On disk it is kept
// sealed with a key drawn from the teacher's passphrase by
// PBKDF2-HMAC-SHA256, 600,000 rounds, with a random salt, and the format,
// salt and rounds are bound to that seal. The page keeps that sealing key
// while the history is open too, so it can seal a new history key when
// content is erased. The passphrase is at least 12 characters, compared in
// one Unicode form, so the same words typed on another keyboard still open
// it. Each row is sealed with a fresh 12-byte nonce and bound to its place,
// so rows cannot be swapped.

export const ITERATIONS = 600_000;
const MAX_ITERATIONS = 10_000_000;
export const MIN_PASSPHRASE = 12;
const MAX_PASSPHRASE = 1024;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const FORMAT = 1;

/** The history's key as it is kept on disk. */
export interface SealedKey {
  readonly format: typeof FORMAT;
  readonly salt: Uint8Array;
  readonly iterations: number;
  readonly nonce: Uint8Array;
  readonly sealed: ArrayBuffer;
}

/** A row as it is kept on disk. */
export interface Sealed {
  readonly nonce: Uint8Array;
  readonly data: ArrayBuffer;
}

const AES = { name: 'AES-GCM', length: 256 } as const;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

/** Whether the passphrase may be chosen: well-formed, and 12 to 1024 characters. */
export function passphraseFits(passphrase: string): boolean {
  if (!passphrase.isWellFormed()) return false;
  const length = [...passphrase.normalize('NFC')].length;
  return length >= MIN_PASSPHRASE && length <= MAX_PASSPHRASE;
}

function bytes(value: unknown, length: number): value is Uint8Array {
  return value instanceof Uint8Array && value.length === length;
}

/** Whether a value read from disk is a sealed key this version can open. */
export function isSealedKey(value: unknown): value is SealedKey {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<SealedKey>;
  return (
    record.format === FORMAT &&
    bytes(record.salt, SALT_BYTES) &&
    Number.isSafeInteger(record.iterations) &&
    (record.iterations ?? 0) >= ITERATIONS &&
    (record.iterations ?? 0) <= MAX_ITERATIONS &&
    bytes(record.nonce, NONCE_BYTES) &&
    record.sealed instanceof ArrayBuffer
  );
}

/** Whether a value read from disk has the shape of a sealed row. */
export function isSealed(value: unknown): value is Sealed {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<Sealed>;
  return bytes(record.nonce, NONCE_BYTES) && record.data instanceof ArrayBuffer;
}

function header(salt: Uint8Array, iterations: number): Uint8Array<ArrayBuffer> {
  const hex = Array.from(salt, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return encoder.encode(`minhajna-key:${FORMAT}:${hex}:${iterations}`);
}

/** The key drawn from the passphrase, which seals the history's key; the page keeps it while the history is open. */
export interface Wrapping {
  readonly key: CryptoKey;
  readonly salt: Uint8Array<ArrayBuffer>;
  readonly iterations: number;
}

/** Draws the sealing key from the passphrase, with a new salt unless one is given. */
export async function wrapping(
  passphrase: string,
  salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES)),
  iterations = ITERATIONS,
): Promise<Wrapping> {
  const bytes = encoder.encode(passphrase.normalize('NFC'));
  try {
    const base = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, AES, false, [
      'encrypt',
      'decrypt',
    ]);
    return { key, salt, iterations };
  } finally {
    bytes.fill(0);
  }
}

/** A sealed key's nonce as text, which tells one sealing from another. */
export function stampOf(record: SealedKey): string {
  return Array.from(record.nonce, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** 32 new random bytes for a history's key. */
export function newKeyBytes(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(KEY_BYTES));
}

/** Seals the key's bytes with the sealing key, under a new nonce. */
export async function sealKey(raw: Uint8Array<ArrayBuffer>, wrap: Wrapping): Promise<SealedKey> {
  const { salt, iterations } = wrap;
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: header(salt, iterations) },
    wrap.key,
    raw,
  );
  return { format: FORMAT, salt, iterations, nonce, sealed };
}

/** The key's bytes and the sealing key, or null when the passphrase is not the one it was sealed under. */
export async function openKey(
  record: SealedKey,
  passphrase: string,
): Promise<{ raw: Uint8Array<ArrayBuffer>; wrap: Wrapping } | null> {
  const wrap = await wrapping(passphrase, new Uint8Array(record.salt), record.iterations);
  try {
    const raw = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(record.nonce), additionalData: header(wrap.salt, wrap.iterations) },
      wrap.key,
      record.sealed,
    );
    return { raw: new Uint8Array(raw), wrap };
  } catch (error) {
    if (error instanceof Error && error.name === 'OperationError') return null;
    throw error;
  }
}

/** The history's key for this page, which the page cannot read back. The bytes are wiped. */
export async function historyKey(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  try {
    return await crypto.subtle.importKey('raw', raw, AES, false, ['encrypt', 'decrypt']);
  } finally {
    raw.fill(0);
  }
}

/** Seals the text for its place, such as `entry:12`. */
export async function seal(key: CryptoKey, text: string, place: string): Promise<Sealed> {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: encoder.encode(place) },
    key,
    encoder.encode(text),
  );
  return { nonce, data };
}

/** The text sealed for that place; rejects a row changed on disk or moved from another place. */
export async function unseal(key: CryptoKey, row: Sealed, place: string): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(row.nonce), additionalData: encoder.encode(place) },
    key,
    row.data,
  );
  return decoder.decode(plain);
}
