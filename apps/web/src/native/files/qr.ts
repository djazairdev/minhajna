// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// QR codes drawn on a PC, with the JavaScript port of the ZXing encoder the
// phone uses, so the same text gives the same code: error correction M,
// UTF-8 named in the code itself, the smallest version that holds it. A
// transfer's short key comes with no quiet zone, which the screen draws
// (QrRows.kt); a statement's text up to 996 bytes comes with the four-cell
// white zone included, at most version 25 (StatementQr.kt). Nothing is kept.
// The port differs from the Java 3.5 the phone runs in two places, which
// are replaced with Java's: it divided bits by eight without rounding down,
// so a text filling a version went one version up and 996 bytes did not
// fit; and its mask penalty counted cells past the code's edge as white, so
// it chose another mask than the phone for some texts.

import {
  BarcodeFormat,
  EncodeHintType,
  QRCodeDecoderErrorCorrectionLevel,
  QRCodeEncoder,
  QRCodeMaskUtil,
  QRCodeVersion,
  QRCodeWriter,
} from '@zxing/library';

const SHORT_CHARS = 200;
const STATEMENT_BYTES = 996;
const MAX_WIDTH = 125;

/** Java's check that `bits` fit a version's data codewords, rounding to whole bytes. */
function willFit(bits: number, version: QRCodeVersion, level: QRCodeDecoderErrorCorrectionLevel): boolean {
  return version.getTotalCodewords() - version.getECBlocksForLevel(level).getTotalECCodewords() >= Math.ceil(bits / 8);
}

/** Java's check that a row's cells from `from` to `to` are all light, false when they leave the row. */
function isWhiteHorizontal(row: Uint8Array, from: number, to: number): boolean {
  return from >= 0 && to <= row.length && row.subarray(from, to).every((cell) => cell !== 1);
}

/** Java's check that a column's cells from `from` to `to` are all light, false when they leave it. */
function isWhiteVertical(rows: readonly Uint8Array[], column: number, from: number, to: number): boolean {
  return from >= 0 && to <= rows.length && rows.slice(from, to).every((row) => row[column] !== 1);
}

for (const [target, name, step] of [
  [QRCodeEncoder, 'willFit', willFit],
  [QRCodeMaskUtil, 'isWhiteHorizontal', isWhiteHorizontal],
  [QRCodeMaskUtil, 'isWhiteVertical', isWhiteVertical],
] as const) {
  if (typeof Reflect.get(target, name) !== 'function' || !Reflect.set(target, name, step)) {
    throw new Error(`The QR encoder has no ${name} to replace`);
  }
}

function rowsOf(text: string, margin: number): string[] {
  const hints = new Map<EncodeHintType, unknown>([
    [EncodeHintType.CHARACTER_SET, 'UTF-8'],
    [EncodeHintType.ERROR_CORRECTION, QRCodeDecoderErrorCorrectionLevel.M],
    [EncodeHintType.MARGIN, margin],
  ]);
  const matrix = new QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 0, 0, hints);
  return Array.from({ length: matrix.getHeight() }, (_, y) =>
    Array.from({ length: matrix.getWidth() }, (__, x) => (matrix.get(x, y) ? '1' : '0')).join(''),
  );
}

/** A short text's code, one line a row, with no quiet zone. */
export function shortRows(text: string): string {
  if (text === '' || text.length > SHORT_CHARS) throw new RangeError('A QR code holds short text only');
  return rowsOf(text, 0).join('\n');
}

/** The UTF-8 bytes of non-empty, well-formed text within `limit`, counted as characters and as bytes. */
export function boundedBytes(text: string, limit: number): Uint8Array<ArrayBuffer> {
  if (text === '' || text.length > limit || !text.isWellFormed()) throw new RangeError('Invalid signing text');
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > limit) throw new RangeError('Signing text exceeds limit');
  return bytes;
}

/** A statement's code with its quiet zone, as rows. */
export function statementRows(text: string): string[] {
  boundedBytes(text, STATEMENT_BYTES);
  const rows = rowsOf(text, 4);
  if (rows.length > MAX_WIDTH || rows.some((row) => row.length !== rows.length)) {
    throw new RangeError('QR exceeds maximum version');
  }
  return rows;
}
