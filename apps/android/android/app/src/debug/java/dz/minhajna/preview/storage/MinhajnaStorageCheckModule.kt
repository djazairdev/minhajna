// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Debug builds only (#19): throwaway histories for the storage check, so the
 * core's shared storage checks run on the phone, against SQLCipher and the
 * Keystore. Each history has its own folder under the no-backup folder and
 * its own Keystore alias, never the teacher's, and goes through
 * [HistoryStorage], the code that keeps the teacher's history.
 */
class MinhajnaStorageCheckModule(context: ReactApplicationContext) : NativeMinhajnaStorageCheckSpec(context) {

  private val random = SecureRandom()
  private val worker: ExecutorService = Executors.newSingleThreadExecutor { task -> Thread(task, "minhajna-check") }
  private val root = File(context.noBackupFilesDir, ROOT)
  private val histories = mutableMapOf<String, HistoryStorage>()

  override fun openHistory(name: String, promise: Promise) = onWorker(promise, name) {
    histories.getOrPut(name) { HistoryStorage(folder(name).apply { mkdirs() }, alias(name)) }.open(random)
    null
  }

  override fun loadHistory(name: String, promise: Promise) = onWorker(promise, name) { opened(name).loadJson() }

  override fun appendEntry(name: String, entry: String, promise: Promise) = onWorker(promise, name) {
    opened(name).appendJson(entry)
    null
  }

  override fun eraseContent(name: String, ids: ReadableArray, promise: Promise) {
    val copies = List(ids.size()) { ids.getString(it) ?: "" }
    onWorker(promise, name) {
      opened(name).eraseContent(copies)
      null
    }
  }

  /** Opens a second connection with the key from the Keystore, reads, and closes it. */
  override fun readCommitted(name: String, promise: Promise) = onWorker(promise, name) {
    opened(name)
    val bytes = DatabaseKey(File(folder(name), HistoryStorage.KEY), alias(name)).getOrCreate(random)
    val reader = try {
      HistoryDatabase.open(File(folder(name), HistoryStorage.DATABASE), bytes)
    } finally {
      bytes.fill(0)
    }
    try {
      HistoryStorage.toJson(reader.load())
    } finally {
      reader.close()
    }
  }

  override fun deleteHistory(name: String, promise: Promise) = onWorker(promise, name) {
    histories.remove(name)?.close()
    folder(name).deleteRecursively()
    KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(alias(name))
    null
  }

  override fun invalidate() {
    worker.execute {
      histories.values.forEach { it.close() }
      histories.clear()
    }
    worker.shutdown()
    super.invalidate()
  }

  private fun opened(name: String) = histories[name] ?: throw IllegalStateException("The history is not open")

  private fun folder(name: String) = File(root, name)

  private fun alias(name: String) = "minhajna.check.$name"

  private fun onWorker(promise: Promise, name: String, task: () -> Any?) {
    worker.execute {
      try {
        require(NAME_PATTERN.matches(name)) { "A check's history has a name of 1 to 40 a-z, 0-9 or -" }
        promise.resolve(task())
      } catch (e: KeyLostException) {
        promise.reject("E_KEY_LOST", e.message, e)
      } catch (e: Exception) {
        promise.reject("E_HISTORY", e.message ?: e.javaClass.simpleName, e)
      }
    }
  }

  companion object {
    private const val ROOT = "storage-check"
    private val NAME_PATTERN = Regex("[a-z0-9-]{1,40}")
  }
}
