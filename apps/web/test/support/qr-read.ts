// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reads a code's rows back with ZXing's own reader, as the phone's tests do,
// so a test checks what a scanner would see rather than the cells alone.

import { BinaryBitmap, DecodeHintType, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from '@zxing/library';

/** The text a code holds, read back by ZXing's own reader. */
export function decoded(rows: string[]): string {
  const scale = 4;
  const size = rows.length * scale;
  const pixels = new Uint8ClampedArray(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      pixels[y * size + x] = rows[Math.floor(y / scale)]?.[Math.floor(x / scale)] === '1' ? 0 : 255;
    }
  }
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, size, size)));
  return new QRCodeReader().decode(bitmap, new Map([[DecodeHintType.PURE_BARCODE, true]])).getText();
}
