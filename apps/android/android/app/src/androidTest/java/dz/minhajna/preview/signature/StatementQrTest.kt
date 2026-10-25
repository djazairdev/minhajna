// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.signature

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.zxing.BinaryBitmap
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/** Reads the real writer's matrix as an image with ZXing's QRCodeReader, not with a mock decoder. */
@RunWith(AndroidJUnit4::class)
class StatementQrTest {
  private fun decoded(rows: List<String>): String {
    val side = rows.size * 6
    val pixels = IntArray(side * side) { i ->
      if (rows[(i / side) / 6][(i % side) / 6] == '1') 0xff000000.toInt() else 0xffffffff.toInt()
    }
    return QRCodeReader().decode(BinaryBitmap(HybridBinarizer(RGBLuminanceSource(side, side, pixels)))).text
  }

  @Test
  fun readsAsciiArabicAndEmojiWithoutNetwork() {
    val arabic = "\u0628\u064a\u0627\u0646 \u062a\u062c\u0631\u064a\u0628\u064a"
    for (text in listOf("{\"example\":1}", arabic, "\ud83d\ude00")) {
      val rows = statementQr(text)
      assertEquals(text, decoded(rows))
      assertTrue(rows.size in 29..125)
      assertTrue(rows.all { it.length == rows.size && it.all { cell -> cell == '0' || cell == '1' } })
      assertTrue(rows.take(4).all { it.all { cell -> cell == '0' } })
      assertTrue(rows.takeLast(4).all { it.all { cell -> cell == '0' } })
      assertTrue(rows.all { it.take(4) == "0000" && it.takeLast(4) == "0000" })
    }
  }

  @Test
  fun theComplete996ByteUtf8LimitFitsVersion25M() {
    assertEquals(996, STATEMENT_QR_LIMIT)
    for (text in listOf("x".repeat(996), "\u0645".repeat(498), "\ud83d\ude00".repeat(249))) {
      val rows = statementQr(text)
      assertEquals(125, rows.size)
      assertEquals(text, decoded(rows))
    }
  }

  @Test
  fun refusesOversizedOrMalformedTextRatherThanTruncatingIt() {
    for (text in listOf("", "\ud800", "\udc00", "x".repeat(997), "\u0645".repeat(498) + "x")) {
      assertThrows(Exception::class.java) { statementQr(text) }
    }
  }
}
