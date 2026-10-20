// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.calendar

import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction

/** Strict UTF-8, capped before decoding; neither input nor a provider's path enters errors or logs. */
object NoticeInput {
  const val MAX_BYTES = 16_384

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
      return Charsets.UTF_8.newDecoder()
        .onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT)
        .decode(ByteBuffer.wrap(bytes, 0, count)).toString()
    } finally {
      bytes.fill(0)
    }
  }
}
