// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.calendar

import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

/**
 * A QR code's modules for the screen to draw (#247, answer 478): one line
 * per row, `1` for a dark module and `0` for a light one, with no quiet zone,
 * which the screen draws around it. Only short text is drawn, such as a
 * transfer's one-time key; nothing is written or kept.
 */
object QrRows {
  const val MAX_CHARS = 200

  fun of(text: String): String {
    require(text.isNotEmpty() && text.length <= MAX_CHARS) { "A QR code holds short text only" }
    val hints = mapOf(
      EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
      EncodeHintType.CHARACTER_SET to "UTF-8",
      EncodeHintType.MARGIN to 0,
    )
    val matrix = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 0, 0, hints)
    return (0 until matrix.height).joinToString("\n") { y ->
      String(CharArray(matrix.width) { x -> if (matrix.get(x, y)) '1' else '0' })
    }
  }
}
