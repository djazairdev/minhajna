// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A statement PDF's link (#438, answer 485). The printed page links its
// signature line to `minhajna-statement:` and the signed text's UTF-8 bytes
// in standard base64, which the phone's web engine keeps in the PDF as the
// link's address, so a PDF carries the whole signed text even when it is too
// long for one QR code. Reader mode (#246) takes the text back from that
// address and checks it with `checkStatement`, as any other; the link holds
// nothing the signed text does not.

import { utf8Length } from './signed-read.ts';
import { STATEMENT_BYTES } from './statement-read.ts';

/** The scheme of a statement PDF's link. */
export const STATEMENT_LINK = 'minhajna-statement:';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** Well-formed text's UTF-8 bytes. */
function utf8(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const point = char.codePointAt(0)!;
    if (point < 0x80) bytes.push(point);
    else if (point < 0x800) bytes.push(0xc0 | (point >> 6), 0x80 | (point & 63));
    else if (point < 0x10000) bytes.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 63), 0x80 | (point & 63));
    else bytes.push(0xf0 | (point >> 18), 0x80 | ((point >> 12) & 63), 0x80 | ((point >> 6) & 63), 0x80 | (point & 63));
  }
  return bytes;
}

/** The link for a signed statement's text; throws for text no statement file could be. */
export function statementLink(text: string): string {
  const size = typeof text === 'string' && text.length <= STATEMENT_BYTES ? utf8Length(text) : null;
  if (size === null || size === 0 || size > STATEMENT_BYTES) throw new TypeError('Invalid signed statement text');
  const bytes = utf8(text);
  let encoded = '';
  for (let at = 0; at < bytes.length; at += 3) {
    const [a, b, c] = [bytes[at]!, bytes[at + 1], bytes[at + 2]];
    const group = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    encoded += ALPHABET[group >> 18]! + ALPHABET[(group >> 12) & 63]!;
    encoded += b === undefined ? '==' : ALPHABET[(group >> 6) & 63]! + (c === undefined ? '=' : ALPHABET[group & 63]!);
  }
  return STATEMENT_LINK + encoded;
}

/** The signed text a link carries, still to be checked, or null when it is not a well-formed statement link. */
export function linkedStatement(uri: string): string | null {
  if (typeof uri !== 'string' || !uri.startsWith(STATEMENT_LINK)) return null;
  const encoded = uri.slice(STATEMENT_LINK.length);
  if (encoded === '' || encoded.length > Math.ceil(STATEMENT_BYTES / 3) * 4 || !BASE64.test(encoded)) return null;
  let escaped = '';
  for (let at = 0; at < encoded.length; at += 4) {
    const values = [...encoded.slice(at, at + 4)].map((char) => (char === '=' ? -1 : ALPHABET.indexOf(char)));
    const group = values.reduce((sum, value) => (sum << 6) | Math.max(value, 0), 0);
    const padding = values.filter((value) => value < 0).length;
    escaped += [group >> 16, (group >> 8) & 255, group & 255]
      .slice(0, 3 - padding)
      .map((byte) => `%${byte.toString(16).padStart(2, '0')}`)
      .join('');
  }
  try {
    const text = decodeURIComponent(escaped);
    return utf8Length(text) === escaped.length / 3 ? text : null;
  } catch {
    return null;
  }
}
