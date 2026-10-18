// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import java.io.File
import java.io.IOException
import java.nio.ByteBuffer
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/** The history stays closed until the PIN or the phone's biometric prompt opens it. */
class LockedException : Exception("The history is locked")

/** A PIN is not tried while its try cannot be counted, as when the phone's storage is full. */
class NoSpaceException(cause: Exception) : Exception("A PIN try cannot be counted", cause)

/** The phone's prompt was closed before a match, so the fingerprint or face stays off. */
class CancelledException : Exception("The phone's prompt was closed")

/**
 * The app lock (#210, PRD §6.4). The history's key is the same 32 bytes as
 * before; the lock only changes how it is kept:
 *
 * - `history.lock` holds it sealed twice: first with a key drawn from the
 *   teacher's 4-digit PIN by PBKDF2-HMAC-SHA256, then with the phone's
 *   Keystore key, so the file opens only on this phone, and only with the
 *   PIN. The header (format, salt, iterations) is bound to the outer seal.
 * - `history.bio`, if the teacher turns it on, holds it sealed with a second
 *   Keystore key that opens only after the phone's own strong biometric
 *   prompt, and is lost when a new fingerprint or face is enrolled.
 *
 * A 0.1.0 history's key file is sealed again under the new PIN, then
 * removed. No biometric data is kept: the phone checks the fingerprint and
 * only answers yes or no. Every primitive is the platform's (PRD §6.5).
 */
class HistoryLock(
  private val folder: File,
  clock: LockClock,
  private val alias: String = DatabaseKey.ALIAS,
  private val biometricAlias: String = BIOMETRIC_ALIAS,
  private val iterations: Int = ITERATIONS,
) {
  private val lockFile = File(folder, LOCK)
  private val biometricFile = File(folder, BIOMETRIC)
  private val legacy = DatabaseKey(File(folder, HistoryStorage.KEY), alias)
  val attempts = LockAttempts(File(folder, ATTEMPTS), clock)

  /** The result of trying a PIN. */
  sealed class Unlock {
    /** The history's key; the caller clears it once the database is open. */
    class Opened(val key: ByteArray) : Unlock()
    class Wrong(val waitSeconds: Long) : Unlock()
    class Waiting(val waitSeconds: Long) : Unlock()
  }

  fun isSet(): Boolean = Sealing.existsAtomically(lockFile)

  /** A biometric copy is kept, and its Keystore key is still there; whether it still opens shows only at the prompt. */
  fun hasBiometric(): Boolean = Sealing.existsAtomically(biometricFile) && keyStore().containsAlias(biometricAlias)

  /**
   * Seals the history's key under a first PIN: the 0.1.0 key where there is
   * one, else a new key. The new file is synced before the old one goes, so
   * a crash in between leaves both, and the lock file wins.
   */
  fun create(pin: String, random: SecureRandom, databaseExists: Boolean): ByteArray {
    check(!isSet()) { "A PIN is already set" }
    requirePin(pin)
    val key = when {
      legacy.exists() -> legacy.getOrCreate(random)
      databaseExists -> throw KeyLostException("The history's key file is missing")
      else -> ByteArray(DatabaseKey.KEY_BYTES).also(random::nextBytes)
    }
    try {
      write(pin, key, random)
      if (legacy.exists()) legacy.delete()
    } catch (e: Exception) {
      key.fill(0)
      throw e
    }
    return key
  }

  /**
   * Tries a PIN, unless a wait is running. The phone's seal is opened first,
   * which needs no PIN. The try is then counted as wrong before the PIN is
   * checked, and the count cleared if it was right: a count that cannot be
   * written stops the try, so a full disk gives no free guesses. A 0.1.0 key
   * file that a crash left behind after the lock was written goes now.
   */
  fun unlock(pin: String): Unlock {
    check(isSet()) { "No PIN is set" }
    val wait = attempts.waitSeconds()
    if (wait > 0) return Unlock.Waiting(wait)
    val sealed = unsealed()
    val next = try {
      attempts.fail()
    } catch (e: IOException) {
      throw NoSpaceException(e)
    }
    val key = openWithPin(pin, sealed) ?: return Unlock.Wrong(next)
    try {
      attempts.succeed()
      if (legacy.exists()) legacy.delete()
    } catch (e: Exception) {
      key.fill(0)
      throw e
    }
    return Unlock.Opened(key)
  }

  /**
   * Seals the key under a new PIN, once the old one is right; an Opened
   * result carries no key. The biometric copy stays as it is.
   */
  fun change(old: String, new: String, random: SecureRandom): Unlock {
    requirePin(new)
    val result = unlock(old)
    if (result is Unlock.Opened) {
      try {
        write(new, result.key, random)
      } finally {
        result.key.fill(0)
      }
      return Unlock.Opened(ByteArray(0))
    }
    return result
  }

  /**
   * A new biometric Keystore key, replacing any earlier one, and a cipher on
   * it for the prompt to release. The phone refuses to make the key unless
   * a fingerprint or face is enrolled.
   */
  fun biometricKeyCipher(): Cipher {
    dropBiometric()
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
    generator.init(
      KeyGenParameterSpec.Builder(biometricAlias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setKeySize(256)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setUserAuthenticationRequired(true)
        .setInvalidatedByBiometricEnrollment(true)
        .apply {
          if (Build.VERSION.SDK_INT >= 30) {
            setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
          } else {
            @Suppress("DEPRECATION")
            setUserAuthenticationValidityDurationSeconds(-1)
          }
        }
        .build(),
    )
    return Sealing.encrypting(generator.generateKey())
  }

  /** Writes the biometric copy with a cipher the prompt released. */
  fun saveBiometric(cipher: Cipher, key: ByteArray) {
    Sealing.writeAtomically(biometricFile, byteArrayOf(BIOMETRIC_VERSION) + Sealing.seal(cipher, key, BIOMETRIC_AAD))
  }

  /**
   * A cipher for the prompt to release, or null: the copy is removed once
   * it is lost, as after a new fingerprint, and kept on any other Keystore
   * failure, when the PIN alone opens the app this time.
   */
  fun biometricOpeningCipher(): Cipher? {
    val stored = Sealing.readAtomically(biometricFile) ?: return null
    return try {
      val key = keyStore().getKey(biometricAlias, null) as? SecretKey
      if (key == null || stored.isEmpty() || stored[0] != BIOMETRIC_VERSION) {
        dropBiometric()
        return null
      }
      Sealing.decrypting(key, stored.copyOfRange(1, stored.size))
    } catch (_: KeyPermanentlyInvalidatedException) {
      dropBiometric()
      null
    } catch (_: IllegalArgumentException) {
      dropBiometric()
      null
    } catch (_: Exception) {
      null
    }
  }

  /** The history's key from a cipher the prompt released, or null if the copy does not open. */
  fun openBiometric(cipher: Cipher): ByteArray? {
    val stored = Sealing.readAtomically(biometricFile) ?: return null
    if (stored.size <= 1) return null
    return Sealing.open(cipher, stored.copyOfRange(1, stored.size), BIOMETRIC_AAD)
  }

  fun dropBiometric() {
    AtomicFile(biometricFile).delete()
    keyStore().let { if (it.containsAlias(biometricAlias)) it.deleteEntry(biometricAlias) }
  }

  private fun write(pin: String, key: ByteArray, random: SecureRandom) {
    val salt = ByteArray(SALT_BYTES).also(random::nextBytes)
    val header = ByteBuffer.allocate(HEADER_BYTES).put(VERSION).put(salt).putInt(iterations).array()
    val inner = derive(pin, salt, iterations).let { pinKey ->
      try {
        Sealing.seal(SecretKeySpec(pinKey, "AES"), key, INNER_AAD)
      } finally {
        pinKey.fill(0)
      }
    }
    Sealing.writeAtomically(lockFile, header + Sealing.seal(legacy.deviceKey(), inner, OUTER_AAD + header))
  }

  private class PinSealed(val salt: ByteArray, val count: Int, val sealed: ByteArray)

  /** The lock file opened with the phone's key; KeyLostException when the file or the Keystore no longer match. */
  private fun unsealed(): PinSealed {
    val stored = Sealing.readAtomically(lockFile) ?: throw KeyLostException("The lock file is missing")
    if (stored.size <= HEADER_BYTES + Sealing.IV_BYTES + Sealing.TAG_BITS / 8 || stored[0] != VERSION) {
      throw KeyLostException("The lock file is not in the expected format")
    }
    val header = stored.copyOfRange(0, HEADER_BYTES)
    val buffer = ByteBuffer.wrap(header, 1, HEADER_BYTES - 1)
    val salt = ByteArray(SALT_BYTES).also { buffer.get(it) }
    val count = buffer.getInt()
    if (count !in MIN_ITERATIONS..MAX_ITERATIONS) throw KeyLostException("The lock file is not in the expected format")
    val device = keyStore().getKey(alias, null) as? SecretKey ?: throw KeyLostException("The Keystore no longer holds the history's key")
    val inner = Sealing.open(device, stored.copyOfRange(HEADER_BYTES, stored.size), OUTER_AAD + header)
      ?: throw KeyLostException("The lock file does not match the Keystore's key")
    if (inner.size <= Sealing.IV_BYTES + Sealing.TAG_BITS / 8) throw KeyLostException("The lock file is not in the expected format")
    return PinSealed(salt, count, inner)
  }

  /** The key for the right PIN; null for a wrong one. */
  private fun openWithPin(pin: String, pinSealed: PinSealed): ByteArray? {
    if (!PIN.matches(pin)) return null
    val pinKey = derive(pin, pinSealed.salt, pinSealed.count)
    return try {
      Sealing.open(SecretKeySpec(pinKey, "AES"), pinSealed.sealed, INNER_AAD)
    } finally {
      pinKey.fill(0)
    }
  }

  companion object {
    const val LOCK = "history.lock"
    const val BIOMETRIC = "history.bio"
    const val ATTEMPTS = "lock.attempts"
    const val BIOMETRIC_ALIAS = "minhajna.history.biometric"
    const val ITERATIONS = 120_000
    private const val MIN_ITERATIONS = 1_000
    private const val MAX_ITERATIONS = 10_000_000
    private const val KEYSTORE = "AndroidKeyStore"
    private const val VERSION: Byte = 2
    private const val BIOMETRIC_VERSION: Byte = 1
    private const val SALT_BYTES = 16
    private const val HEADER_BYTES = 1 + SALT_BYTES + 4
    private val PIN = Regex("^[0-9]{4}$")
    private val INNER_AAD = "minhajna/history-lock/2/pin".toByteArray(Charsets.US_ASCII)
    private val OUTER_AAD = "minhajna/history-lock/2/device".toByteArray(Charsets.US_ASCII)
    private val BIOMETRIC_AAD = "minhajna/history-lock/2/biometric".toByteArray(Charsets.US_ASCII)

    fun requirePin(pin: String) = require(PIN.matches(pin)) { "A PIN is 4 digits" }

    private fun keyStore(): KeyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }

    private fun derive(pin: String, salt: ByteArray, count: Int): ByteArray {
      val spec = PBEKeySpec(pin.toCharArray(), salt, count, 256)
      return try {
        SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
      } finally {
        spec.clearPassword()
      }
    }
  }
}
