// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.files

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.charset.Charset
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Checks the AES-256 ZIP's headers, that the plain text never shows in it, and
 * the files' rules: names, types, a file known not to be text, and text read
 * as UTF-8, as UTF-16 after its byte-order mark, or as Arabic Windows' code
 * page. It also leaves `aes-check.zip` in the app's external files, with the
 * made-up text below under the password «مفتاح 2026», so that a reader on a
 * computer can open it with that password.
 */
@RunWith(AndroidJUnit4::class)
class AesZipTest {
  private val text = "\uFEFFداخلي · سري;4م1\r\n1;تلميذة أولى;16,50;10,25;13,00\r\n"
  private val password = "مفتاح 2026"

  @Test
  fun anArchiveHasOneEncryptedEntryWithItsAesHeader() {
    val content = text.toByteArray(Charsets.UTF_8)
    val bytes = ByteArrayOutputStream().also { AesZip.write(it, "كشف 4م1.csv", content, password) }.toByteArray()
    val head = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
    assertEquals(0x04034b50, head.getInt(0))
    assertEquals(51, head.getShort(4).toInt())
    assertEquals(0x0801, head.getShort(6).toInt())
    assertEquals(99, head.getShort(8).toInt())
    assertEquals(0, head.getInt(14))
    assertEquals(content.size, head.getInt(22))
    val nameLength = head.getShort(26).toInt()
    assertEquals(11, head.getShort(28).toInt())
    assertEquals("كشف 4م1.csv", String(bytes, 30, nameLength, Charsets.UTF_8))
    val extra = 30 + nameLength
    assertEquals(0x9901, head.getShort(extra).toInt() and 0xffff)
    assertArrayEquals(byteArrayOf(0x41, 0x45, 0x03, 0x08, 0x00), bytes.copyOfRange(extra + 6, extra + 11))
    assertEquals(head.getInt(bytes.size - 6) - extra - 11, head.getInt(18))
    assertEquals(0x06054b50, head.getInt(bytes.size - 22))
    assertFalse(String(bytes, Charsets.ISO_8859_1).contains("16,50"))
    val again = ByteArrayOutputStream().also { AesZip.write(it, "كشف 4م1.csv", content, password) }.toByteArray()
    assertFalse(bytes.contentEquals(again))
    assertTrue(MinhajnaFilesModule.binary(bytes))
    assertFalse(MinhajnaFilesModule.binary(content))
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    File(context.getExternalFilesDir(null), "aes-check.zip").writeBytes(bytes)
  }

  @Test
  fun filesKeepTheirRules() {
    assertTrue(MinhajnaFilesModule.fileNameAllowed("كشف النقاط 4م1 · اللغة العربية.csv"))
    assertFalse(MinhajnaFilesModule.fileNameAllowed("../x.csv"))
    assertFalse(MinhajnaFilesModule.fileNameAllowed(".hidden"))
    assertFalse(MinhajnaFilesModule.fileNameAllowed(" "))
    val xls = intArrayOf(0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0).map { it.toByte() }.toByteArray()
    assertTrue(MinhajnaFilesModule.binary(xls))
    assertTrue(MinhajnaFilesModule.binary("%PDF-1.7".toByteArray()))
    assertFalse(MinhajnaFilesModule.binary("PK".toByteArray()))
    assertEquals("application/zip", MinhajnaFilesModule.mimeOf(File("a.csv.zip")))
    assertEquals("text/csv", MinhajnaFilesModule.mimeOf(File("a.csv")))
    assertEquals(text, MinhajnaFilesModule.textOf(text.toByteArray(Charsets.UTF_8)))
    val windows = "1;تلميذة أولى;16,50"
    assertEquals(windows, MinhajnaFilesModule.textOf(windows.toByteArray(Charset.forName("windows-1256"))))
    val unicode = byteArrayOf(0xFF.toByte(), 0xFE.toByte()) + "1\tتلميذة".toByteArray(Charsets.UTF_16LE)
    assertEquals("1\tتلميذة", MinhajnaFilesModule.textOf(unicode))
    val big = byteArrayOf(0xFE.toByte(), 0xFF.toByte()) + "1\tتلميذة".toByteArray(Charsets.UTF_16BE)
    assertEquals("1\tتلميذة", MinhajnaFilesModule.textOf(big))
  }
}
