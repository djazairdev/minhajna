// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import android.os.Build
import android.os.CancellationSignal
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import java.nio.charset.CharacterCodingException
import java.security.SecureRandom
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import javax.crypto.Cipher

/**
 * The app's storage and cryptography (#19, #75): the history in SQLCipher,
 * its key in the Android Keystore, SHA-256 from MessageDigest and random
 * bytes from SecureRandom. Every primitive is the platform's or SQLCipher's.
 * Once a PIN is set, the history opens only through the lock (#210). The
 * pilot's timings live in the same database, outside the history (#220).
 * Database work runs on one thread, in order, so a promise resolves only
 * after its own write is committed. Error messages name no pupil: they carry
 * no data from the history.
 */
class MinhajnaStorageModule(context: ReactApplicationContext) : NativeMinhajnaStorageSpec(context) {

  private val random = SecureRandom()
  private val worker: ExecutorService = Executors.newSingleThreadExecutor { task -> Thread(task, "minhajna-history") }
  private val history = HistoryStorage(context.noBackupFilesDir)
  private val lock = HistoryLock(context.noBackupFilesDir, SystemLockClock(context))
  private val prompting = AtomicBoolean(false)
  private val shown = AtomicReference<CancellationSignal?>(null)

  override fun randomBytes(length: Double): String {
    val count = length.toInt()
    require(count.toDouble() == length && count in 1..MAX_RANDOM_BYTES) { "Ask for 1 to $MAX_RANDOM_BYTES bytes" }
    val bytes = ByteArray(count).also(random::nextBytes)
    return Hashing.hex(bytes)
  }

  /** Hashes each text on the worker, from copies made on the calling thread: the array belongs to the bridge. */
  override fun digest(texts: ReadableArray, promise: Promise) {
    val copies = List(texts.size()) { texts.getString(it) ?: "" }
    worker.execute {
      try {
        val result = Arguments.createArray()
        for (text in copies) result.pushString(Hashing.sha256Hex(text))
        promise.resolve(result)
      } catch (e: CharacterCodingException) {
        promise.reject("E_NOT_WELL_FORMED", "A text to hash is not well-formed Unicode", e)
      } catch (e: Exception) {
        promise.reject("E_DIGEST", "SHA-256 failed", e)
      }
    }
  }

  /** Opens the history while no PIN is set; once one is, only says whether the lock has opened it. */
  override fun openHistory(promise: Promise) = onWorker(promise) {
    if (!lock.isSet()) history.open(random) else if (!history.isOpen()) throw LockedException()
    null
  }

  override fun lockStatus(promise: Promise) = onWorker(promise) {
    Arguments.createMap().apply {
      putString("state", if (!lock.isSet()) "setup" else if (history.isOpen()) "open" else "locked")
      putBoolean("biometric", lock.hasBiometric())
      putBoolean("biometricAvailable", BiometricUnlock.available(reactApplicationContext))
      putDouble("waitSeconds", lock.attempts.waitSeconds().toDouble())
      putBoolean("hasHistory", history.exists())
    }
  }

  override fun createLock(pin: String, promise: Promise) = onWorker(promise) {
    val key = lock.create(pin, random, history.exists())
    try {
      history.openWithKey(key)
    } finally {
      key.fill(0)
    }
    null
  }

  override fun unlock(pin: String, promise: Promise) = onWorker(promise) {
    when (val result = lock.unlock(pin)) {
      is HistoryLock.Unlock.Opened -> {
        try {
          history.openWithKey(result.key)
        } finally {
          result.key.fill(0)
        }
        tried(true, 0)
      }
      else -> tried(result)
    }
  }

  override fun changePin(old: String, next: String, promise: Promise) = onWorker(promise) {
    requireOpen()
    tried(lock.change(old, next, random))
  }

  override fun lockHistory(promise: Promise) = onWorker(promise) {
    if (lock.isSet()) history.close()
    null
  }

  /** Resolves true once the history is open; false when the teacher cancels or the biometric copy is lost. */
  override fun unlockWithBiometrics(title: String, subtitle: String, cancel: String, promise: Promise) =
    onWorker(promise) {
      val texts = BiometricUnlock.Texts(title, subtitle, cancel)
      val cipher = lock.biometricOpeningCipher() ?: return@onWorker false
      prompt(texts, cipher, promise) { released ->
        val key = lock.openBiometric(released)
        if (key == null) {
          lock.dropBiometric()
          return@prompt false
        }
        try {
          history.openWithKey(key)
        } finally {
          key.fill(0)
        }
        lock.attempts.succeed()
        true
      }
      HandedOn
    }

  /** Turns the phone's fingerprint or face on, once the PIN is right and the prompt has matched. */
  override fun enableBiometrics(pin: String, title: String, subtitle: String, cancel: String, promise: Promise) =
    onWorker(promise) {
      requireOpen()
      val texts = BiometricUnlock.Texts(title, subtitle, cancel)
      check(BiometricUnlock.available(reactApplicationContext)) { "The phone cannot check a fingerprint or face" }
      val result = lock.unlock(pin)
      if (result !is HistoryLock.Unlock.Opened) return@onWorker tried(result)
      val key = result.key
      val cipher = try {
        lock.biometricKeyCipher()
      } catch (e: Exception) {
        key.fill(0)
        throw e
      }
      prompt(texts, cipher, promise, onCancel = { key.fill(0); lock.dropBiometric() }) { released ->
        try {
          lock.saveBiometric(released, key)
        } finally {
          key.fill(0)
        }
        tried(true, 0)
      }
      HandedOn
    }

  override fun disableBiometrics(promise: Promise) = onWorker(promise) {
    requireOpen()
    lock.dropBiometric()
    null
  }

  override fun loadHistory(promise: Promise) = onWorker(promise) { history.loadJson() }

  override fun appendEntry(entry: String, promise: Promise) = onWorker(promise) {
    history.appendJson(entry)
    null
  }

  override fun appendEntries(entries: String, promise: Promise) = onWorker(promise) {
    history.appendAllJson(entries)
    null
  }

  override fun restoreHistory(entries: String, promise: Promise) = onWorker(promise) {
    history.restoreJson(entries)
    null
  }

  override fun eraseContent(ids: ReadableArray, promise: Promise) {
    val copies = List(ids.size()) { ids.getString(it) ?: "" }
    onWorker(promise) {
      history.eraseContent(copies)
      null
    }
  }

  override fun loadTimings(promise: Promise) = onWorker(promise) { history.loadTimingsJson() }

  override fun addTimings(timings: String, promise: Promise) = onWorker(promise) {
    history.addTimingsJson(timings)
    null
  }

  override fun clearTimings(promise: Promise) = onWorker(promise) {
    history.clearTimings()
    null
  }

  /** Erases everything the app keeps on this phone (answer 477); the module then takes nothing until a restart. */
  override fun eraseDevice(promise: Promise) = onWorker(promise) {
    DeviceErase.run(reactApplicationContext) { history.close() }
    worker.shutdown()
    null
  }

  override fun invalidate() {
    shown.getAndSet(null)?.cancel()
    if (!worker.isShutdown) worker.execute { history.close() }
    worker.shutdown()
    super.invalidate()
  }

  private fun requireOpen() {
    if (!lock.isSet() || !history.isOpen()) throw LockedException()
  }

  /**
   * Shows the phone's prompt; `then` runs on the worker with the released
   * cipher, and its value resolves the promise. A cancelled prompt resolves
   * false, or rejects with E_CANCELLED when `onCancel` is given, so a closed
   * prompt never reads as a wrong PIN. One prompt at a time.
   */
  private fun prompt(
    texts: BiometricUnlock.Texts,
    cipher: Cipher,
    promise: Promise,
    onCancel: (() -> Unit)? = null,
    then: (Cipher) -> Any?,
  ) {
    val activity = reactApplicationContext.currentActivity
    if (Build.VERSION.SDK_INT < 28 || activity == null || !prompting.compareAndSet(false, true)) {
      onCancel?.invoke()
      throw IllegalStateException("The phone's prompt cannot be shown now")
    }
    val signal = CancellationSignal()
    shown.set(signal)
    BiometricUnlock.prompt(activity, texts, cipher, signal) { released ->
      shown.compareAndSet(signal, null)
      prompting.set(false)
      val queued = enqueue(promise) {
        if (released != null) {
          then(released)
        } else if (onCancel != null) {
          onCancel()
          throw CancelledException()
        } else {
          false
        }
      }
      if (!queued) onCancel?.invoke()
    }
  }

  private fun onWorker(promise: Promise, task: () -> Any?) {
    enqueue(promise, task)
  }

  /**
   * Runs `task` on the worker, and says whether it was queued: once the
   * module has stopped, the promise is rejected at once. A failure's message
   * is SQLite's or the app's own, never a record's content. A task that
   * returns HandedOn has passed the promise to a prompt, and resolves
   * nothing itself.
   */
  private fun enqueue(promise: Promise, task: () -> Any?): Boolean {
    try {
      worker.execute {
        try {
          val value = task()
          if (value !== HandedOn) promise.resolve(value)
        } catch (e: LockedException) {
          promise.reject("E_LOCKED", e.message, e)
        } catch (e: NoSpaceException) {
          promise.reject("E_NO_SPACE", e.message, e)
        } catch (e: KeyLostException) {
          promise.reject("E_KEY_LOST", e.message, e)
        } catch (e: CancelledException) {
          promise.reject("E_CANCELLED", e.message, e)
        } catch (e: Exception) {
          promise.reject("E_HISTORY", e.message ?: e.javaClass.simpleName, e)
        }
      }
    } catch (e: RejectedExecutionException) {
      promise.reject("E_HISTORY", "The storage module has stopped", e)
      return false
    }
    return true
  }

  private object HandedOn

  companion object {
    private const val MAX_RANDOM_BYTES = 1024
  }
}
