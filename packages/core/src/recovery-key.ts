// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The recovery key (#247, Recovery-sheet, R-6.5-05, answer 478): 24
// characters in six groups of four, from the 32 digits and letters without
// I, L, O and U, so 120 random bits. It is the password of the backups' AES-256
// ZIP, and a one-time key of the same form opens a transfer file, which the
// old phone shows as a QR code. A key is read as the teacher types it: in
// either case, with spaces or dashes, in Arabic-Indic digits, with O read as
// zero and I or L as one.

import type { RandomBytes } from './id.ts';

export const RECOVERY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const RECOVERY_LENGTH = 24;
export const RECOVERY_GROUP = 4;

/** What a transfer QR code holds before its key. */
export const TRANSFER_QR_PREFIX = 'minhajna-key:1:';

const BYTES = 15;
const BITS = 5;
const MASK = 31;
const MISREAD: Readonly<Record<string, string>> = { O: '0', I: '1', L: '1' };
const ARABIC_ZERO = 0x0660;
const PERSIAN_ZERO = 0x06f0;

/** A new key, as stored and as the ZIP's password: 24 characters, no spaces. */
export function makeRecoveryKey(random: RandomBytes): string {
  const bytes = random(BYTES);
  if (bytes.length !== BYTES) throw new RangeError('A recovery key needs 15 random bytes');
  return recoverySymbols(bytes);
}

/** Bytes as characters of the recovery alphabet, five bits each, in order; leftover bits are dropped. */
export function recoverySymbols(bytes: Uint8Array): string {
  let key = '';
  let value = 0;
  let bits = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= BITS) {
      bits -= BITS;
      key += RECOVERY_ALPHABET[(value >> bits) & MASK];
    }
    value &= (1 << bits) - 1;
  }
  return key;
}

/** Arabic-Indic and Persian digits as ASCII ones. */
function asciiDigits(text: string): string {
  return text.replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code - (code >= PERSIAN_ZERO ? PERSIAN_ZERO : ARABIC_ZERO));
  });
}

/** What was typed, in capitals with ASCII digits, O as zero, I and L as one, and no spaces or dashes. */
export function plainTyped(text: string): string {
  return asciiDigits(text)
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[OIL]/g, (letter) => MISREAD[letter]!);
}

/** The key the teacher typed, as stored, or null when it is not one. */
export function readRecoveryKey(text: string): string | null {
  const plain = plainTyped(text);
  const fine = plain.length === RECOVERY_LENGTH && [...plain].every((one) => RECOVERY_ALPHABET.includes(one));
  return fine ? plain : null;
}

/** The key in its six groups of four, as the sheet shows it. */
export function recoveryGroups(key: string): readonly string[] {
  return key.match(/.{4}/g) ?? [];
}

/** What the old phone's QR code holds for a transfer file's one-time key. */
export function transferQr(key: string): string {
  return `${TRANSFER_QR_PREFIX}${key}`;
}

/** The one-time key a scanned QR code holds, exactly as the old phone made it, or null. */
export function readTransferQr(text: string): string | null {
  if (!text.startsWith(TRANSFER_QR_PREFIX)) return null;
  const key = text.slice(TRANSFER_QR_PREFIX.length);
  return readRecoveryKey(key) === key ? key : null;
}
