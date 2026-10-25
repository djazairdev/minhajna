// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.signature

import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

/**
 * ZXing alone encodes (#437). The 996-byte contract matches #436's
 * STATEMENT_QR_LIMIT: version 25-M, UTF-8 ECI, normal byte mode. The writer
 * chooses the smallest version, with a four-cell white quiet zone. Rows
 * include that zone: future drawing must keep it white and square.
 * No bitmap, payload copy or QR image is saved to disk.
 */
internal fun statementQr(text: String): List<String> {
  signatureBytes(text, STATEMENT_QR_LIMIT)
  val matrix = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 0, 0, mapOf(
    EncodeHintType.CHARACTER_SET to "UTF-8",
    EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
    EncodeHintType.MARGIN to 4,
  ))
  check(matrix.width <= 125 && matrix.width == matrix.height) { "QR exceeds maximum version" }
  return List(matrix.height) { y ->
    String(CharArray(matrix.width) { x -> if (matrix[x, y]) '1' else '0' })
  }
}

/** Mirrors #436 until its exported constant is available to the app; the Kotlin boundary stays tested. */
internal const val STATEMENT_QR_LIMIT = 996
