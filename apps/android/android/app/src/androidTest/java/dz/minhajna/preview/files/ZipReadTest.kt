// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.files

import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.SecureRandom
import java.util.zip.CRC32
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith

/**
 * A file read back from the app's ZIP archives (#247, answer 478): an AES-256
 * one with its password, among several files, in AE-2 or AE-1 form, and a
 * plain one; a wrong or missing password told apart from a changed file, and
 * a file that is not an archive, lacks the file, holds it twice, or is too
 * large, refused, and a plain one where a password is wanted. The texts are
 * made up.
 */
@RunWith(AndroidJUnit4::class)
class ZipReadTest {
  private val name = "minhajna-archive.json"
  private val key = listOf("K7QF", "3M9T", "WX2R", "8HDN", "P4VC", "6JYE").joinToString("")
  private val text = "{\"format\":\"minhajna-archive\",\"note\":\"ملاحظة مختلقة\"}".repeat(2_000).toByteArray()

  private fun aes(files: List<Pair<String, ByteArray>> = listOf(name to text)) =
    ByteArrayOutputStream().also { AesZip.writeAll(it, files, key) }.toByteArray()

  private fun plain(files: List<Pair<String, ByteArray>> = listOf(name to text)) =
    ByteArrayOutputStream().also { MinhajnaFilesModule.plainZip(it, files) }.toByteArray()

  private fun refused(
    reason: ZipRead.Reason,
    bytes: ByteArray,
    password: String = key,
    limit: Int = LIMIT,
    sealed: Boolean = false,
  ) {
    val error = assertThrows(ZipRead.Refused::class.java) { ZipRead.read(bytes, name, password, limit, sealed) }
    assertEquals(reason, error.reason)
  }

  /** Where the first file's data starts, after its local header. */
  private fun dataStart(bytes: ByteArray): Int {
    val zip = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
    return 30 + zip.getShort(26) + zip.getShort(28)
  }

  @Test
  fun readsTheFileBackWithItsPasswordFromAmongOthers() {
    assertArrayEquals(text, ZipRead.read(aes(), name, key, LIMIT))
    val several = aes(listOf("marks.csv" to "1;2\r\n".toByteArray(), name to text))
    assertArrayEquals(text, ZipRead.read(several, name, key, LIMIT))
    val big = ByteArray(3 * 1024 * 1024).also { SecureRandom().nextBytes(it) }
    assertArrayEquals(big, ZipRead.read(aes(listOf(name to big)), name, key, LIMIT))
  }

  @Test
  fun readsAPlainArchiveWhateverThePassword() {
    assertArrayEquals(text, ZipRead.read(plain(), name, "", LIMIT))
    assertArrayEquals(text, ZipRead.read(plain(), name, key, LIMIT))
  }

  @Test
  fun refusesAPlainArchiveWhereAPasswordIsWanted() {
    refused(ZipRead.Reason.PLAIN, plain(), sealed = true)
    refused(ZipRead.Reason.PLAIN, plain(), "", sealed = true)
    assertArrayEquals(text, ZipRead.read(aes(), name, key, LIMIT, sealed = true))
  }

  @Test
  fun tellsAWrongOrMissingPasswordApartFromAChangedFile() {
    refused(ZipRead.Reason.PASSWORD, aes(), key.dropLast(1) + "0")
    refused(ZipRead.Reason.PASSWORD, aes(), "")
    val changed = aes()
    changed[dataStart(changed) + 40] = (changed[dataStart(changed) + 40].toInt() xor 1).toByte()
    refused(ZipRead.Reason.CHANGED, changed)
    val coded = aes()
    val end = coded.size - 22 - ByteBuffer.wrap(coded).order(ByteOrder.LITTLE_ENDIAN).getInt(coded.size - 10)
    coded[end - 1] = (coded[end - 1].toInt() xor 1).toByte()
    refused(ZipRead.Reason.CHANGED, coded)
    val flat = plain()
    flat[dataStart(flat) + 10] = (flat[dataStart(flat) + 10].toInt() xor 0x55).toByte()
    refused(ZipRead.Reason.CHANGED, flat)
  }

  @Test
  fun readsTheOlderAesFormOnlyWhenItsCrcMatches() {
    val bytes = aes()
    val zip = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
    val central = zip.getInt(bytes.size - 6)
    val crc = CRC32().apply { update(text) }.value.toInt()
    for ((header, extra) in listOf(0 to 30 + name.length, central to central + 46 + name.length)) {
      val shift = if (header == 0) 0 else 2
      zip.putInt(header + 14 + shift, crc)
      zip.putShort(extra + 4, 1)
    }
    assertArrayEquals(text, ZipRead.read(bytes, name, key, LIMIT))
    zip.putInt(central + 16, crc xor 1)
    refused(ZipRead.Reason.CHANGED, bytes)
  }

  @Test
  fun refusesWhatIsNotTheArchiveItShouldBe() {
    refused(ZipRead.Reason.NOT_ARCHIVE, "{\"format\":\"minhajna-archive\"}".toByteArray())
    refused(ZipRead.Reason.NOT_ARCHIVE, ByteArray(0))
    refused(ZipRead.Reason.NOT_ARCHIVE, aes(listOf("marks.csv" to text)))
    refused(ZipRead.Reason.CHANGED, aes(listOf(name to text, name to "{}".toByteArray())))
    refused(ZipRead.Reason.TOO_LARGE, aes(), limit = text.size - 1)
    val cut = aes()
    refused(ZipRead.Reason.NOT_ARCHIVE, cut.copyOf(cut.size - 1))
    val moved = aes()
    val zip = ByteBuffer.wrap(moved).order(ByteOrder.LITTLE_ENDIAN)
    zip.putInt(zip.getInt(moved.size - 6) + 42, moved.size)
    refused(ZipRead.Reason.CHANGED, moved)
    for (size in listOf(text.size - 1, -1)) {
      val lying = plain()
      ByteBuffer.wrap(lying).order(ByteOrder.LITTLE_ENDIAN).let { it.putInt(it.getInt(lying.size - 6) + 24, size) }
      refused(ZipRead.Reason.CHANGED, lying)
    }
  }

  private companion object {
    const val LIMIT = 64 * 1024 * 1024
  }
}
