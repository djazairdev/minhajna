// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.files

import java.io.ByteArrayOutputStream
import java.io.OutputStream
import java.security.SecureRandom
import java.util.Calendar
import java.util.zip.Deflater
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Files in a ZIP archive encrypted with AES-256, the WinZip AE-2 format,
 * made for Windows' 7-Zip, WinRAR and WPS to open with the password
 * (R-5.9-15, answer 466). Each file is deflated, then encrypted in AES's
 * counter mode with a little-endian counter from 1, under a key drawn from
 * the password's UTF-8 bytes and a random salt by PBKDF2 with HMAC-SHA1,
 * 1000 rounds; an HMAC-SHA1 of the encrypted bytes, cut to ten, lets the
 * reader check them.
 * AE-2 leaves the CRC out, so nothing of the plain file shows outside.
 */
object AesZip {
  private const val ROUNDS = 1000
  private const val KEY = 32
  private const val SALT = 16
  private const val CODE = 10
  private const val AES_METHOD = 99
  private const val DEFLATED = 8

  /** Writes `content` as `entry`, the only file in the archive, encrypted under `password`. */
  fun write(
    out: OutputStream,
    entry: String,
    content: ByteArray,
    password: String,
    at: Calendar = Calendar.getInstance(),
  ) = writeAll(out, listOf(entry to content), password, at)

  /** Writes the files in order, each encrypted under `password` with a salt of its own (#248). */
  fun writeAll(
    out: OutputStream,
    files: List<Pair<String, ByteArray>>,
    password: String,
    at: Calendar = Calendar.getInstance(),
  ) {
    require(password.isNotEmpty()) { "A password is needed" }
    require(files.isNotEmpty()) { "A file is needed" }
    val centrals = ByteArrayOutputStream()
    var offset = 0L
    for ((entry, content) in files) {
      val (local, body, central) = sealed(entry, content, password, at, offset)
      out.write(local)
      out.write(body)
      centrals.write(central)
      offset += local.size + body.size
    }
    val central = centrals.toByteArray()
    val end = little(0x06054b50L, 4) + little(0, 2) + little(0, 2) + little(files.size, 2) + little(files.size, 2) +
      little(central.size.toLong(), 4) + little(offset, 4) + little(0, 2)
    out.write(central)
    out.write(end)
  }

  /** One file's local header, its encrypted body, and its central header, which points back `offset` bytes in. */
  private fun sealed(
    entry: String,
    content: ByteArray,
    password: String,
    at: Calendar,
    offset: Long,
  ): Triple<ByteArray, ByteArray, ByteArray> {
    val salt = ByteArray(SALT).also { SecureRandom().nextBytes(it) }
    val keys = pbkdf2(password.toByteArray(Charsets.UTF_8), salt, KEY * 2 + 2)
    val sealed = crypt(deflate(content), keys.copyOfRange(0, KEY))
    val mac = Mac.getInstance("HmacSHA1").apply { init(SecretKeySpec(keys.copyOfRange(KEY, KEY * 2), "HmacSHA1")) }
    val code = mac.doFinal(sealed).copyOf(CODE)
    val body = ByteArrayOutputStream().apply {
      write(salt)
      write(keys, KEY * 2, 2)
      write(sealed)
      write(code)
    }.toByteArray()
    val name = entry.toByteArray(Charsets.UTF_8)
    val extra = little(0x9901, 2) + little(7, 2) + little(2, 2) + byteArrayOf(0x41, 0x45, 0x03) + little(DEFLATED, 2)
    val (time, date) = dos(at)
    val shared = little(51, 2) + little(0x0801, 2) + little(AES_METHOD, 2) + little(time, 2) + little(date, 2) +
      little(0, 4) + little(body.size.toLong(), 4) + little(content.size.toLong(), 4) +
      little(name.size, 2) + little(extra.size, 2)
    val local = little(0x04034b50L, 4) + shared + name + extra
    val central = little(0x02014b50L, 4) + little(63, 2) + shared + little(0, 2) + little(0, 2) + little(0, 2) +
      little(0, 4) + little(offset, 4) + name + extra
    return Triple(local, body, central)
  }

  /** The raw deflate stream of `content`, with no header. */
  private fun deflate(content: ByteArray): ByteArray {
    val deflater = Deflater(Deflater.DEFAULT_COMPRESSION, true)
    try {
      deflater.setInput(content)
      deflater.finish()
      val out = ByteArrayOutputStream()
      val buffer = ByteArray(8192)
      while (!deflater.finished()) out.write(buffer, 0, deflater.deflate(buffer))
      return out.toByteArray()
    } finally {
      deflater.end()
    }
  }

  /** AES-256 in counter mode, the counter a 16-byte little-endian number from 1. */
  internal fun crypt(data: ByteArray, key: ByteArray): ByteArray {
    val aes = Cipher.getInstance("AES/ECB/NoPadding").apply { init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES")) }
    val counter = ByteArray(16)
    val stream = ByteArray(16)
    val out = ByteArray(data.size)
    var at = 0
    while (at < data.size) {
      for (index in counter.indices) {
        counter[index] = (counter[index] + 1).toByte()
        if (counter[index] != 0.toByte()) break
      }
      aes.doFinal(counter, 0, 16, stream, 0)
      val end = minOf(at + 16, data.size)
      for (index in at until end) out[index] = (data[index].toInt() xor stream[index - at].toInt()).toByte()
      at = end
    }
    return out
  }

  /** PBKDF2 with HMAC-SHA1 over the password's bytes, as WinZip derives its keys. */
  internal fun pbkdf2(password: ByteArray, salt: ByteArray, length: Int): ByteArray {
    val mac = Mac.getInstance("HmacSHA1").apply { init(SecretKeySpec(password, "HmacSHA1")) }
    val out = ByteArrayOutputStream()
    var block = 1
    while (out.size() < length) {
      var u = mac.doFinal(salt + little(block.toLong(), 4).reversedArray())
      val t = u.copyOf()
      repeat(ROUNDS - 1) {
        u = mac.doFinal(u)
        for (index in t.indices) t[index] = (t[index].toInt() xor u[index].toInt()).toByte()
      }
      out.write(t)
      block += 1
    }
    return out.toByteArray().copyOf(length)
  }

  /** The time and date in MS-DOS form, as a ZIP header keeps them. */
  private fun dos(at: Calendar): Pair<Int, Int> {
    val time = (at.get(Calendar.HOUR_OF_DAY) shl 11) or (at.get(Calendar.MINUTE) shl 5) or
      (at.get(Calendar.SECOND) / 2)
    val date = ((at.get(Calendar.YEAR) - 1980) shl 9) or ((at.get(Calendar.MONTH) + 1) shl 5) or
      at.get(Calendar.DAY_OF_MONTH)
    return time to date
  }

  private fun little(value: Int, bytes: Int): ByteArray = little(value.toLong(), bytes)

  private fun little(value: Long, bytes: Int): ByteArray = ByteArray(bytes) { ((value shr (8 * it)) and 0xff).toByte() }
}
