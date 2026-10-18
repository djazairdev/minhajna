// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import android.util.AtomicFile
import java.io.File
import java.security.Key
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec

/**
 * AES-256-GCM sealing with the platform's Cipher: the IV, then the sealed
 * bytes and their tag. A Keystore key picks its own IV; a software key gets
 * one from the cipher too. The additional data names what is sealed, so a
 * sealed value cannot be passed off as another.
 */
object Sealing {
  const val IV_BYTES = 12
  const val TAG_BITS = 128
  private const val TRANSFORMATION = "AES/GCM/NoPadding"

  fun seal(key: Key, plain: ByteArray, aad: ByteArray): ByteArray = seal(encrypting(key), plain, aad)

  /** Seals with a cipher already initialised for encryption, such as one a biometric prompt released. */
  fun seal(cipher: Cipher, plain: ByteArray, aad: ByteArray): ByteArray {
    cipher.updateAAD(aad)
    val iv = cipher.iv
    check(iv.size == IV_BYTES)
    return iv + cipher.doFinal(plain)
  }

  /** The plain bytes, or null when the key or the additional data does not match. */
  fun open(key: Key, sealed: ByteArray, aad: ByteArray): ByteArray? = open(decrypting(key, sealed), sealed, aad)

  fun open(cipher: Cipher, sealed: ByteArray, aad: ByteArray): ByteArray? {
    cipher.updateAAD(aad)
    return try {
      cipher.doFinal(sealed, IV_BYTES, sealed.size - IV_BYTES)
    } catch (_: AEADBadTagException) {
      null
    }
  }

  fun encrypting(key: Key): Cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, key) }

  fun decrypting(key: Key, sealed: ByteArray): Cipher {
    require(sealed.size > IV_BYTES + TAG_BITS / 8) { "Too short to be sealed" }
    return Cipher.getInstance(TRANSFORMATION).apply {
      init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_BITS, sealed, 0, IV_BYTES))
    }
  }

  /**
   * Whether the file is there, counting the copy that AtomicFile keeps while
   * it writes on Android 10 and earlier: a crash then leaves only that copy.
   */
  fun existsAtomically(file: File): Boolean = file.exists() || File(file.path + ".bak").exists()

  /** The file's bytes, restored from AtomicFile's copy if a write was cut off; null when there is none. */
  fun readAtomically(file: File): ByteArray? = if (existsAtomically(file)) AtomicFile(file).readFully() else null

  /** Writes the file whole or not at all, synced to the disk before it replaces the old one. */
  fun writeAtomically(file: File, bytes: ByteArray) {
    val atomic = AtomicFile(file)
    val out = atomic.startWrite()
    try {
      out.write(bytes)
      atomic.finishWrite(out)
    } catch (e: Exception) {
      atomic.failWrite(out)
      throw e
    }
  }
}
