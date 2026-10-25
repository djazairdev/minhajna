// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.calendar

import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction

/**
 * A progress statement's file in reader mode (#246, answer 489): a signed file's text, as strict UTF-8, or, for a
 * PDF, only the address of the link whose scheme is `minhajna-statement:` (answer 485), which carries the signed text
 * in base64, or the bare scheme for a PDF without such a link whole, so the reader can say to open the PDF as it was
 * sent. Nothing else of the PDF is decoded or kept, and the reader checks what comes out like any other text.
 */
object StatementFile {
  /** A one-page statement PDF with its fonts stays far below this. */
  const val MAX_BYTES = 8_388_608
  private const val LINK = "minhajna-statement:"
  /** The base64 of the largest signed statement, 64 KiB. */
  private const val LINK_CHARS = 87_384
  private val PDF = "%PDF-".toByteArray(Charsets.US_ASCII)

  fun read(input: InputStream): String {
    val bytes = ByteArray(MAX_BYTES + 1)
    try {
      var count = 0
      while (count < bytes.size) {
        val read = input.read(bytes, count, bytes.size - count)
        if (read < 0) break
        if (read == 0) throw IllegalArgumentException()
        count += read
      }
      require(count <= MAX_BYTES)
      return text(bytes, count)
    } finally {
      bytes.fill(0)
    }
  }

  /** The signed text, a PDF's statement link or the bare scheme for a PDF without one; throws for anything else. */
  fun text(bytes: ByteArray, count: Int): String {
    if (count >= PDF.size && PDF.indices.all { bytes[it] == PDF[it] }) return link(bytes, count)
    require(count <= NoticeInput.FILE_BYTES)
    return Charsets.UTF_8.newDecoder()
      .onMalformedInput(CodingErrorAction.REPORT)
      .onUnmappableCharacter(CodingErrorAction.REPORT)
      .decode(ByteBuffer.wrap(bytes, 0, count)).toString()
  }

  private fun link(bytes: ByteArray, count: Int): String {
    val marker = LINK.toByteArray(Charsets.US_ASCII)
    var at = find(bytes, count, marker, 0)
    while (at >= 0) {
      var end = at + marker.size
      while (end < count && end - at - marker.size <= LINK_CHARS && base64(bytes[end])) end++
      if (end - at - marker.size in 1..LINK_CHARS) return String(bytes, at, end - at, Charsets.US_ASCII)
      at = find(bytes, count, marker, end)
    }
    return LINK
  }

  private fun base64(byte: Byte): Boolean {
    val c = byte.toInt().toChar()
    return c in 'A'..'Z' || c in 'a'..'z' || c in '0'..'9' || c == '+' || c == '/' || c == '='
  }

  private fun find(bytes: ByteArray, count: Int, marker: ByteArray, from: Int): Int {
    var at = from
    while (at + marker.size <= count) {
      if (marker.indices.all { bytes[at + it] == marker[it] }) return at
      at++
    }
    return -1
  }
}
