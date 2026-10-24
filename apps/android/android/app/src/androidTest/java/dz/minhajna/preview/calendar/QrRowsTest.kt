// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.calendar

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.zxing.BinaryBitmap
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * A transfer's QR code drawn from its rows (#247, answer 480): square, of
 * ones and zeros only, and read back by the same scanner the new phone uses
 * once drawn with a quiet zone; text too long to draw is refused. The key is
 * made up.
 */
@RunWith(AndroidJUnit4::class)
class QrRowsTest {
  private val text = "minhajna-key:1:" + listOf("K7QF", "3M9T", "WX2R", "8HDN", "P4VC", "6JYE").joinToString("")

  @Test
  fun drawsRowsTheScannerReadsBack() {
    val rows = QrRows.of(text).split("\n")
    assertTrue(rows.all { it.length == rows.size && it.all { c -> c == '0' || c == '1' } })
    val scale = 4
    val quiet = 4
    val side = (rows.size + 2 * quiet) * scale
    val pixels = IntArray(side * side) { 0xFFFFFFFF.toInt() }
    for ((y, row) in rows.withIndex()) for ((x, c) in row.withIndex()) if (c == '1') {
      for (dy in 0 until scale) for (dx in 0 until scale) {
        pixels[((y + quiet) * scale + dy) * side + (x + quiet) * scale + dx] = 0xFF000000.toInt()
      }
    }
    val bitmap = BinaryBitmap(HybridBinarizer(RGBLuminanceSource(side, side, pixels)))
    assertEquals(text, QRCodeReader().decode(bitmap).text)
  }

  @Test
  fun refusesTextTooLongOrEmpty() {
    assertThrows(IllegalArgumentException::class.java) { QrRows.of("x".repeat(QrRows.MAX_CHARS + 1)) }
    assertThrows(IllegalArgumentException::class.java) { QrRows.of("") }
  }
}
