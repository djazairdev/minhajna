// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.files

import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import java.util.zip.CRC32
import java.util.zip.DataFormatException
import java.util.zip.Inflater
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * One file read back from a ZIP archive the teacher picked (#247, answer
 * 478): a backup, a transfer file or an export. It reads the two forms the
 * app writes, a plain ZIP, deflated or stored, and an AES-256 one in WinZip's
 * AE-2 form, or AE-1, which adds a CRC. The archive is untrusted: the file is
 * found from the central directory, every offset and size is checked against
 * the bytes, and nothing is inflated past its stated size or `limit`. An AES
 * file is decrypted only once the password's check bytes match and its HMAC
 * code does; a plain one must match its CRC. A wrong password is told apart
 * from a changed file, save one in 65,536 that passes WinZip's two check bytes
 * and is taken for a change; the keys drawn from it are cleared after use.
 * Where only a file under a password is wanted, a plain one is refused.
 */
object ZipRead {

  /**
   * Why a file was not read: no archive holding it, a password that does not
   * open it, a change, its size, or no password where one was wanted.
   */
  enum class Reason { NOT_ARCHIVE, PASSWORD, CHANGED, TOO_LARGE, PLAIN }

  class Refused(val reason: Reason) : Exception("The archive was refused: $reason")

  private const val END = 0x06054b50
  private const val CENTRAL = 0x02014b50
  private const val LOCAL = 0x04034b50
  private const val END_SIZE = 22
  private const val CENTRAL_SIZE = 46
  private const val LOCAL_SIZE = 30
  private const val MAX_COMMENT = 0xffff
  private const val STORED = 0
  private const val DEFLATED = 8
  private const val AES_METHOD = 99
  private const val AES_EXTRA = 0x9901
  private const val ENCRYPTED = 1
  private const val KEY = 32
  private const val SALT = 16
  private const val CHECK = 2
  private const val CODE = 10
  private const val STRENGTH_256 = 3

  /** The bytes of the file named `entry`, opened with `password` when it is encrypted, as it must be if `sealed`. */
  fun read(bytes: ByteArray, entry: String, password: String, limit: Int, sealed: Boolean = false): ByteArray {
    val zip = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
    val found = find(zip, bytes.size, entry.toByteArray(Charsets.UTF_8))
    if (found.size > limit) throw Refused(Reason.TOO_LARGE)
    val data = bytes.copyOfRange(found.start, found.start + found.stored)
    if ((found.flags and ENCRYPTED) == 0) {
      if (sealed) throw Refused(Reason.PLAIN)
      val plain = expand(data, found.method, found.size)
      if (crc(plain) != found.crc) throw Refused(Reason.CHANGED)
      return plain
    }
    if (found.method != AES_METHOD) throw Refused(Reason.NOT_ARCHIVE)
    val aes = found.aes ?: throw Refused(Reason.CHANGED)
    val plain = expand(opened(data, password), aes.method, found.size)
    if (aes.version == 1 && crc(plain) != found.crc) throw Refused(Reason.CHANGED)
    return plain
  }

  private class Aes(val version: Int, val method: Int)

  private class Found(
    val flags: Int,
    val method: Int,
    val crc: Long,
    val stored: Int,
    val size: Int,
    val start: Int,
    val aes: Aes?,
  )

  /** The one entry named `name`, from the central directory, its data checked to lie inside the bytes. */
  private fun find(zip: ByteBuffer, length: Int, name: ByteArray): Found {
    val end = endRecord(zip, length)
    if (zip.short(end + 4) != 0 || zip.short(end + 6) != 0) throw Refused(Reason.NOT_ARCHIVE)
    val count = zip.short(end + 10)
    val directory = zip.int(end + 16)
    if (zip.int(end + 12) < 0 || directory < 0 || directory.toLong() + zip.int(end + 12) > end) {
      throw Refused(Reason.NOT_ARCHIVE)
    }
    var at = directory
    var found: Found? = null
    repeat(count) {
      if (at + CENTRAL_SIZE > end || zip.int(at) != CENTRAL) throw Refused(Reason.CHANGED)
      val nameLength = zip.short(at + 28)
      val extraLength = zip.short(at + 30)
      val next = at + CENTRAL_SIZE + nameLength + extraLength + zip.short(at + 32)
      if (next > end) throw Refused(Reason.CHANGED)
      val named = ByteArray(nameLength).also { zip.get(at + CENTRAL_SIZE, it) }
      if (named.contentEquals(name)) {
        if (found != null) throw Refused(Reason.CHANGED)
        found = located(zip, at, directory, extra(zip, at + CENTRAL_SIZE + nameLength, extraLength))
      }
      at = next
    }
    return found ?: throw Refused(Reason.NOT_ARCHIVE)
  }

  /** Where the end record starts: the last one whose comment runs exactly to the end of the bytes. */
  private fun endRecord(zip: ByteBuffer, length: Int): Int {
    var at = length - END_SIZE
    while (at >= 0 && at >= length - END_SIZE - MAX_COMMENT) {
      if (zip.int(at) == END && at + END_SIZE + zip.short(at + 20) == length) return at
      at -= 1
    }
    throw Refused(Reason.NOT_ARCHIVE)
  }

  /** The entry the central header at `at` describes, its data placed after its own local header. */
  private fun located(zip: ByteBuffer, at: Int, directory: Int, aes: Aes?): Found {
    val stored = zip.int(at + 20)
    val size = zip.int(at + 24)
    val local = zip.int(at + 42)
    if (stored < 0 || size < 0 || local < 0 || local.toLong() + LOCAL_SIZE > directory) throw Refused(Reason.CHANGED)
    if (zip.int(local) != LOCAL) throw Refused(Reason.CHANGED)
    val start = local + LOCAL_SIZE + zip.short(local + 26) + zip.short(local + 28)
    if (start.toLong() + stored > directory) throw Refused(Reason.CHANGED)
    val crc = zip.int(at + 16).toLong() and 0xffffffffL
    return Found(zip.short(at + 8), zip.short(at + 10), crc, stored, size, start, aes)
  }

  /** The AES extra field among a central header's, or null when there is none. */
  private fun extra(zip: ByteBuffer, from: Int, length: Int): Aes? {
    var at = from
    while (at + 4 <= from + length) {
      val id = zip.short(at)
      val size = zip.short(at + 2)
      if (at + 4 + size > from + length) throw Refused(Reason.CHANGED)
      if (id == AES_EXTRA) {
        if (size != 7) throw Refused(Reason.NOT_ARCHIVE)
        val vendor = zip.get(at + 6).toInt() == 0x41 && zip.get(at + 7).toInt() == 0x45
        if (!vendor || zip.short(at + 4) !in 1..2 || zip.get(at + 8).toInt() != STRENGTH_256) {
          throw Refused(Reason.NOT_ARCHIVE)
        }
        return Aes(zip.short(at + 4), zip.short(at + 9))
      }
      at += 4 + size
    }
    return null
  }

  /** The encrypted bytes opened: the password checked first, then the HMAC code, then decrypted. */
  private fun opened(data: ByteArray, password: String): ByteArray {
    if (data.size < SALT + CHECK + CODE) throw Refused(Reason.CHANGED)
    if (password.isEmpty()) throw Refused(Reason.PASSWORD)
    val salt = data.copyOfRange(0, SALT)
    val keys = AesZip.pbkdf2(password.toByteArray(Charsets.UTF_8), salt, KEY * 2 + CHECK)
    if (!MessageDigest.isEqual(keys.copyOfRange(KEY * 2, KEY * 2 + CHECK), data.copyOfRange(SALT, SALT + CHECK))) {
      keys.fill(0)
      throw Refused(Reason.PASSWORD)
    }
    try {
      val sealed = data.copyOfRange(SALT + CHECK, data.size - CODE)
      val mac = Mac.getInstance("HmacSHA1").apply { init(SecretKeySpec(keys.copyOfRange(KEY, KEY * 2), "HmacSHA1")) }
      if (!MessageDigest.isEqual(mac.doFinal(sealed).copyOf(CODE), data.copyOfRange(data.size - CODE, data.size))) {
        throw Refused(Reason.CHANGED)
      }
      val key = keys.copyOfRange(0, KEY)
      return AesZip.crypt(sealed, key).also { key.fill(0) }
    } finally {
      keys.fill(0)
    }
  }

  /** The data stored or inflated, exactly `size` bytes, or refused as changed. */
  private fun expand(data: ByteArray, method: Int, size: Int): ByteArray = when (method) {
    STORED -> if (data.size == size) data else throw Refused(Reason.CHANGED)
    DEFLATED -> inflate(data, size)
    else -> throw Refused(Reason.NOT_ARCHIVE)
  }

  private fun inflate(data: ByteArray, size: Int): ByteArray {
    val inflater = Inflater(true)
    try {
      inflater.setInput(data)
      val out = ByteArrayOutputStream(size)
      val buffer = ByteArray(8192)
      while (!inflater.finished()) {
        val count = inflater.inflate(buffer)
        if (count == 0 && (inflater.needsInput() || inflater.needsDictionary())) throw Refused(Reason.CHANGED)
        if (out.size() + count > size) throw Refused(Reason.CHANGED)
        out.write(buffer, 0, count)
      }
      if (out.size() != size || inflater.remaining > 0) throw Refused(Reason.CHANGED)
      return out.toByteArray()
    } catch (error: DataFormatException) {
      throw Refused(Reason.CHANGED)
    } finally {
      inflater.end()
    }
  }

  private fun crc(bytes: ByteArray): Long = CRC32().apply { update(bytes) }.value

  private fun ByteBuffer.short(at: Int): Int = if (at in 0..limit() - 2) getShort(at).toInt() and 0xffff else -1

  private fun ByteBuffer.int(at: Int): Int = if (at in 0..limit() - 4) getInt(at) else -1

  private fun ByteBuffer.get(at: Int, into: ByteArray) {
    duplicate().apply { position(at) }.get(into)
  }
}
