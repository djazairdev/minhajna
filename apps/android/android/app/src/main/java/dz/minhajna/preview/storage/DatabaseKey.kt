// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import android.util.AtomicFile
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec

/** The database cannot be opened: its key is gone, or no longer matches. */
class KeyLostException(message: String) : Exception(message)

/**
 * The database key: 32 random bytes made on the phone, kept only wrapped by
 * an AES-256-GCM key in the Android Keystore, which never leaves it (PRD
 * §6.4). The wrapped key lives in the app's no-backup folder, so neither the
 * phone's backup nor a device transfer can take it (PRD §1.5).
 *
 * Every primitive is the platform's: the project writes no cryptography of
 * its own (PRD §6.5). The app lock that will release the key comes in the
 * pilot (choice F2, #49).
 */
class DatabaseKey(private val file: File, private val alias: String = ALIAS) {

  fun exists(): Boolean = file.exists()

  /** The key, made on first use. The caller clears it once the database is open. */
  fun getOrCreate(random: SecureRandom): ByteArray {
    val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    if (file.exists()) {
      val wrapping = keyStore.getKey(alias, null) as? SecretKey
        ?: throw KeyLostException("The Keystore no longer holds the history's key")
      return unwrap(wrapping, file.readBytes())
    }
    val wrapping = keyStore.getKey(alias, null) as? SecretKey ?: generate()
    val key = ByteArray(KEY_BYTES).also(random::nextBytes)
    val atomic = AtomicFile(file)
    val out = atomic.startWrite()
    try {
      out.write(wrap(wrapping, key))
      // Synced to the disk before the database is made with the key.
      atomic.finishWrite(out)
    } catch (e: Exception) {
      atomic.failWrite(out)
      key.fill(0)
      throw e
    }
    return key
  }

  /** Where the phone keeps the wrapping key, for the logs: never the key itself. */
  fun securityLevel(): String {
    val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    val key = keyStore.getKey(alias, null) as? SecretKey ?: return "none"
    val info = SecretKeyFactory.getInstance(key.algorithm, KEYSTORE).getKeySpec(key, KeyInfo::class.java) as KeyInfo
    return if (Build.VERSION.SDK_INT >= 31) {
      when (info.securityLevel) {
        KeyProperties.SECURITY_LEVEL_STRONGBOX -> "strongbox"
        KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT -> "tee"
        KeyProperties.SECURITY_LEVEL_SOFTWARE -> "software"
        else -> "unknown"
      }
    } else {
      @Suppress("DEPRECATION")
      if (info.isInsideSecureHardware) "hardware" else "software"
    }
  }

  private fun generate(): SecretKey {
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
    // StrongBox, a separate secure chip, where the phone has one; otherwise
    // the Keystore's own protection, in hardware on most phones.
    if (Build.VERSION.SDK_INT >= 28) {
      try {
        generator.init(spec(strongBox = true))
        return generator.generateKey()
      } catch (_: StrongBoxUnavailableException) {
        // Generated again below, without StrongBox.
      }
    }
    generator.init(spec(strongBox = false))
    return generator.generateKey()
  }

  private fun spec(strongBox: Boolean): KeyGenParameterSpec =
    KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setKeySize(256)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .apply { if (strongBox && Build.VERSION.SDK_INT >= 28) setIsStrongBoxBacked(true) }
      .build()

  /** The Keystore picks the IV. The file holds the format, the IV, then the sealed key. */
  private fun wrap(wrapping: SecretKey, key: ByteArray): ByteArray {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, wrapping)
    cipher.updateAAD(FORMAT)
    val iv = cipher.iv
    check(iv.size == IV_BYTES)
    return byteArrayOf(VERSION) + iv + cipher.doFinal(key)
  }

  private fun unwrap(wrapping: SecretKey, stored: ByteArray): ByteArray {
    if (stored.size != 1 + IV_BYTES + KEY_BYTES + TAG_BITS / 8 || stored[0] != VERSION) {
      throw KeyLostException("The history's key file is not in the expected format")
    }
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.DECRYPT_MODE, wrapping, GCMParameterSpec(TAG_BITS, stored, 1, IV_BYTES))
    cipher.updateAAD(FORMAT)
    return try {
      cipher.doFinal(stored, 1 + IV_BYTES, stored.size - 1 - IV_BYTES)
    } catch (_: AEADBadTagException) {
      throw KeyLostException("The history's key file does not match the Keystore's key")
    }
  }

  companion object {
    const val ALIAS = "minhajna.history"
    private const val KEYSTORE = "AndroidKeyStore"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    const val KEY_BYTES = 32
    private const val IV_BYTES = 12
    private const val TAG_BITS = 128
    private const val VERSION: Byte = 1
    private val FORMAT = "minhajna/history-key/1".toByteArray(Charsets.US_ASCII)
  }
}
