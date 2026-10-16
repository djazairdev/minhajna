// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import java.nio.CharBuffer
import java.nio.charset.CodingErrorAction
import java.security.MessageDigest

/** SHA-256 and hex, on the platform's MessageDigest (#75). */
object Hashing {

  /**
   * SHA-256 of the text's UTF-8 bytes, as lowercase hex. A lone surrogate
   * would become `?` here and U+FFFD in a browser, so the two apps would
   * disagree on the hash: it throws CharacterCodingException instead (#98).
   */
  fun sha256Hex(text: String): String {
    val encoder = Charsets.UTF_8.newEncoder()
      .onMalformedInput(CodingErrorAction.REPORT)
      .onUnmappableCharacter(CodingErrorAction.REPORT)
    val sha256 = MessageDigest.getInstance("SHA-256")
    sha256.update(encoder.encode(CharBuffer.wrap(text)))
    return hex(sha256.digest())
  }

  fun hex(bytes: ByteArray): String {
    val digits = "0123456789abcdef"
    val out = CharArray(bytes.size * 2)
    for ((i, byte) in bytes.withIndex()) {
      out[i * 2] = digits[(byte.toInt() shr 4) and 0xF]
      out[i * 2 + 1] = digits[byte.toInt() and 0xF]
    }
    return String(out)
  }
}
