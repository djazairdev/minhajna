// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.files

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.Charset
import java.nio.charset.CodingErrorAction

/**
 * What a file the teacher picks gives the app. A text file gives its text
 * (#242): UTF-16 after its byte-order mark, as Excel saves Unicode text, else
 * UTF-8, or Arabic Windows' code page when it is not, as Excel saves a CSV
 * file; a ZIP archive, an old .xls workbook or a PDF is not text. A ZIP
 * archive the teacher restores from (#247, answer 478) is copied whole into
 * the app's cache, under the name the picker shows, and read from there, so a
 * key typed again needs no second pick; its one file is read as UTF-8. A
 * year's backup is a few megabytes, so an archive over 16 MB, or a file in it
 * over 32 MB, is refused before it can fill the app's memory.
 */
object PickedFiles {
  const val TEXT_LIMIT = 2 * 1024 * 1024
  const val ZIP_LIMIT = 16 * 1024 * 1024
  const val ENTRY_LIMIT = 32 * 1024 * 1024
  private const val ARCHIVE = "picked.zip"

  private val BINARY_STARTS = listOf(
    intArrayOf(0x50, 0x4B, 0x03, 0x04),
    intArrayOf(0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1),
    intArrayOf(0x25, 0x50, 0x44, 0x46, 0x2D),
  )

  /** At most one byte over the limit, so a larger file is known to be one. */
  fun read(input: InputStream, limit: Int): ByteArray {
    val out = ByteArrayOutputStream()
    val buffer = ByteArray(8192)
    while (out.size() <= limit) {
      val count = input.read(buffer, 0, minOf(buffer.size, limit + 1 - out.size()))
      if (count < 0) break
      out.write(buffer, 0, count)
    }
    return out.toByteArray()
  }

  /** Whether the bytes begin as a ZIP archive, an old Office file or a PDF does. */
  fun binary(bytes: ByteArray): Boolean = BINARY_STARTS.any { start ->
    bytes.size >= start.size && start.indices.all { bytes[it] == start[it].toByte() }
  }

  /** The bytes as text: UTF-16 after its mark, UTF-8 when they are, else Arabic Windows' code page. */
  fun textOf(bytes: ByteArray): String = if (bytes.size >= 2 && unicode(bytes[0], bytes[1])) {
    String(bytes, 2, bytes.size - 2, if (bytes[0] == 0xFF.toByte()) Charsets.UTF_16LE else Charsets.UTF_16BE)
  } else try {
    strict(bytes)
  } catch (error: CharacterCodingException) {
    String(bytes, Charset.forName("windows-1256"))
  }

  /**
   * Copies the picked archive into `place` as it reads it, refusing one over
   * the limit, by the size the picker gives or by the bytes read, with
   * ZipRead's TOO_LARGE, and gives the name the picker shows for it.
   */
  fun keep(resolver: ContentResolver, uri: Uri, place: File): String {
    val (name, size) = factsOf(resolver, uri)
    if (size > ZIP_LIMIT) throw ZipRead.Refused(ZipRead.Reason.TOO_LARGE)
    val input = resolver.openInputStream(uri) ?: throw IOException("Not readable")
    input.use { from ->
      File(place, ARCHIVE).outputStream().use { to ->
        val buffer = ByteArray(8192)
        var total = 0L
        while (true) {
          val count = from.read(buffer)
          if (count < 0) break
          total += count
          if (total > ZIP_LIMIT) throw ZipRead.Refused(ZipRead.Reason.TOO_LARGE)
          to.write(buffer, 0, count)
        }
      }
    }
    return name
  }

  /** The kept archive's file named `entry`, as UTF-8 text; ZipRead's refusals pass through. */
  fun archiveText(place: File, entry: String, password: String, sealed: Boolean): String {
    val file = File(place, ARCHIVE)
    if (!file.isFile) throw IOException("No archive kept")
    if (file.length() > ZIP_LIMIT) throw ZipRead.Refused(ZipRead.Reason.TOO_LARGE)
    val bytes = ZipRead.read(file.readBytes(), entry, password, ENTRY_LIMIT, sealed)
    return try {
      strict(bytes)
    } catch (error: CharacterCodingException) {
      throw ZipRead.Refused(ZipRead.Reason.NOT_ARCHIVE)
    }
  }

  /** The name the picker shows, at most 120 characters, and the size it gives, or -1 when it gives none. */
  private fun factsOf(resolver: ContentResolver, uri: Uri): Pair<String, Long> =
    resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
      if (!cursor.moveToFirst()) return@use null
      val name = if (cursor.isNull(0)) "" else cursor.getString(0).orEmpty().take(120)
      name to (if (cursor.isNull(1)) -1L else cursor.getLong(1))
    } ?: ("" to -1L)

  private fun strict(bytes: ByteArray): String = Charsets.UTF_8.newDecoder()
    .onMalformedInput(CodingErrorAction.REPORT)
    .onUnmappableCharacter(CodingErrorAction.REPORT)
    .decode(ByteBuffer.wrap(bytes))
    .toString()

  private fun unicode(first: Byte, second: Byte): Boolean =
    (first == 0xFF.toByte() && second == 0xFE.toByte()) || (first == 0xFE.toByte() && second == 0xFF.toByte())
}
