// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.calendar

import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.ByteArrayInputStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith

/**
 * A statement's file in reader mode (#246, answer 489): a signed file reads as its text, a PDF gives only its
 * statement link, the first whole one with base64 after it, or the bare scheme when it has none, and malformed UTF-8
 * or a file too large is refused. Made-up bytes only.
 */
@RunWith(AndroidJUnit4::class)
class StatementFileTest {
  private fun read(text: String) = StatementFile.read(ByteArrayInputStream(text.toByteArray(Charsets.ISO_8859_1)))

  @Test
  fun readsASignedFileAsItsText() {
    val text = "{\"format\":\"minhajna.signed-statement\"}"
    assertEquals(text, StatementFile.read(ByteArrayInputStream(text.toByteArray(Charsets.UTF_8))))
  }

  @Test
  fun takesOnlyTheLinkOutOfAPdf() {
    val pdf = "%PDF-1.4\n1 0 obj << /URI (minhajna-statement:) >> endobj\n" +
      "2 0 obj << /S /URI /URI (minhajna-statement:eyJhIjoxfQ==) >> endobj\n%%EOF"
    assertEquals("minhajna-statement:eyJhIjoxfQ==", read(pdf))
  }

  @Test
  fun givesTheBareSchemeForAPdfWithoutALinkAndRefusesMalformedText() {
    assertEquals("minhajna-statement:", read("%PDF-1.4\n<< /URI (https://example.org) >>\n%%EOF"))
    val long = "%PDF-1.4\n(minhajna-statement:" + "A".repeat(87_385) + ")\n(minhajna-statement:eyJhIjoxfQ==)"
    assertEquals("minhajna-statement:eyJhIjoxfQ==", read(long))
    val broken = byteArrayOf(0x7b, 0xc3.toByte(), 0x28, 0x7d)
    assertThrows(Exception::class.java) { StatementFile.read(ByteArrayInputStream(broken)) }
    val large = ByteArray(StatementFile.MAX_BYTES + 1) { 0x20 }
    assertThrows(IllegalArgumentException::class.java) { StatementFile.read(ByteArrayInputStream(large)) }
  }
}
