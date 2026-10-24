// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.files

import android.net.Uri
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith

/**
 * An archive picked for a restore (#247, answer 478): copied whole into its
 * folder and read back from there, its one file as UTF-8 text, as often as
 * a key is typed again; a file that is not UTF-8 is not an archive, one over
 * 16 MB is refused and not kept, and nothing is read once the copy is gone.
 * The texts are made up.
 */
@RunWith(AndroidJUnit4::class)
class PickedFilesTest {
  private val context = InstrumentationRegistry.getInstrumentation().targetContext
  private val place = File(context.cacheDir, "picked-test").apply { mkdirs() }
  private val name = "minhajna-archive.json"
  private val key = listOf("K7QF", "3M9T", "WX2R", "8HDN", "P4VC", "6JYE").joinToString("")
  private val text = "{\"format\":\"minhajna-archive\",\"note\":\"ملاحظة مختلقة\"}"

  @After
  fun clear() {
    place.deleteRecursively()
  }

  private fun picked(bytes: ByteArray): Uri =
    Uri.fromFile(File(context.cacheDir, "picked-source.zip").apply { writeBytes(bytes) })

  private fun aes(content: ByteArray) =
    ByteArrayOutputStream().also { AesZip.writeAll(it, listOf(name to content), key) }.toByteArray()

  @Test
  fun keepsTheArchiveAndReadsItsFileAgainAndAgain() {
    PickedFiles.keep(context.contentResolver, picked(aes(text.toByteArray())), place)
    val wrong = assertThrows(ZipRead.Refused::class.java) {
      PickedFiles.archiveText(place, name, key.dropLast(1) + "0", true)
    }
    assertEquals(ZipRead.Reason.PASSWORD, wrong.reason)
    assertEquals(text, PickedFiles.archiveText(place, name, key, true))
    assertEquals(text, PickedFiles.archiveText(place, name, key, false))
  }

  @Test
  fun refusesAFileThatIsNotUtf8AndReadsNothingOnceDropped() {
    PickedFiles.keep(context.contentResolver, picked(aes(byteArrayOf(0x7B, 0xC3.toByte(), 0x28, 0x7D))), place)
    val error = assertThrows(ZipRead.Refused::class.java) { PickedFiles.archiveText(place, name, key, true) }
    assertEquals(ZipRead.Reason.NOT_ARCHIVE, error.reason)
    place.deleteRecursively()
    assertThrows(IOException::class.java) { PickedFiles.archiveText(place, name, key, true) }
  }

  @Test
  fun refusesAnArchiveOverItsLimitAndKeepsNothing() {
    val error = assertThrows(ZipRead.Refused::class.java) {
      PickedFiles.keep(context.contentResolver, picked(ByteArray(PickedFiles.ZIP_LIMIT + 1)), place)
    }
    assertEquals(ZipRead.Reason.TOO_LARGE, error.reason)
  }
}
