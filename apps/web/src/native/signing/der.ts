// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// ECDSA P-256 signatures in the two forms they take: the DER the phone and
// its colleagues exchange (SignatureCheck.kt), and the 64 bytes of r and s
// that Web Crypto signs and checks. Base64 is read strictly, as Java's
// decoder does, so text with spaces or stray characters is no key.

const HALF = 32;

/** Strict base64, no whitespace; null when the text is not. */
export function fromBase64(text: string): Uint8Array<ArrayBuffer> | null {
  if (text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(text)) return null;
  const binary = atob(text);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function toBase64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
}

/** One DER INTEGER, as its 32 bytes, from `at`; null when it is not one a P-256 signature holds. */
function integer(der: Uint8Array, at: number): { value: Uint8Array; next: number } | null {
  if (der[at] !== 0x02) return null;
  const length = der[at + 1] ?? 0;
  if (length < 1 || length > HALF + 1 || at + 2 + length > der.length) return null;
  let value = der.subarray(at + 2, at + 2 + length);
  if (value.length > 1 && value[0] === 0 && ((value[1] ?? 0) & 0x80) === 0) return null;
  if ((value[0] ?? 0) & 0x80) return null;
  if (value[0] === 0 && value.length > 1) value = value.subarray(1);
  if (value.length > HALF) return null;
  const padded = new Uint8Array(HALF);
  padded.set(value, HALF - value.length);
  return { value: padded, next: at + 2 + length };
}

/** A DER signature as r and s, 64 bytes; null when it is not exactly one SEQUENCE of two INTEGERs. */
export function rawOf(der: Uint8Array): Uint8Array<ArrayBuffer> | null {
  if (der[0] !== 0x30 || (der[1] ?? 0) !== der.length - 2) return null;
  const r = integer(der, 2);
  const s = r === null ? null : integer(der, r.next);
  if (r === null || s === null || s.next !== der.length) return null;
  const raw = new Uint8Array(HALF * 2);
  raw.set(r.value, 0);
  raw.set(s.value, HALF);
  return raw;
}

function derInteger(value: Uint8Array): number[] {
  let start = 0;
  while (start < value.length - 1 && value[start] === 0) start += 1;
  const bytes = Array.from(value.subarray(start));
  if ((bytes[0] ?? 0) & 0x80) bytes.unshift(0);
  return [0x02, bytes.length, ...bytes];
}

/** r and s, 64 bytes, as a DER signature. */
export function derOf(raw: Uint8Array): Uint8Array {
  const body = [...derInteger(raw.subarray(0, HALF)), ...derInteger(raw.subarray(HALF))];
  return Uint8Array.from([0x30, body.length, ...body]);
}
