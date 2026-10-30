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
 * A demo world's own history (#558, choice D4 of the 0.7.0 demo). Each
 * world keeps its records in its own folder under the no-backup folder,
 * with its own Keystore key, through [HistoryStorage], the code that keeps
 * the teacher's history. Entering a world shuts the teacher's history
 * ([WorldGate]); leaving closes the world's and lets the teacher's open
 * again, through its lock as before. One world is open at a time. Erasing
 * the device erases every world with it, folders and keys alike.
 */
class MinhajnaWorldModule(context: ReactApplicationContext) : NativeMinhajnaWorldSpec(context) {

  private val random = SecureRandom()
  private val worker: ExecutorService = Executors.newSingleThreadExecutor { task -> Thread(task, "minhajna-world") }
  private val root = File(context.noBackupFilesDir, ROOT)
  private var open: Pair<String, HistoryStorage>? = null

  override fun enterWorld(world: String, promise: Promise) = onWorker(promise, world) {
    val held = open
    check(held == null || held.first == world) { "Another world is open" }
    WorldGate.enter(world)
    val storage = held?.second ?: HistoryStorage(folder(world).apply { mkdirs() }, alias(world))
    open = world to storage
    try {
      storage.open(random)
    } catch (e: Exception) {
      leave()
      throw e
    }
    null
  }

  override fun leaveWorld(promise: Promise) = onWorker(promise, null) {
    leave()
    null
  }

  override fun loadHistory(promise: Promise) = onWorker(promise, null) { opened().loadJson() }

  override fun appendEntry(entry: String, promise: Promise) = onWorker(promise, null) {
    opened().appendJson(entry)
    null
  }

  override fun eraseContent(ids: ReadableArray, promise: Promise) {
    val copies = List(ids.size()) { ids.getString(it) ?: "" }
    onWorker(promise, null) {
      opened().eraseContent(copies)
      null
    }
  }

  /** Deletes a world's folder and key, leaving it first if it is open: the world is gone from the server too. */
  override fun eraseWorld(world: String, promise: Promise) = onWorker(promise, world) {
    if (open?.first == world) leave()
    folder(world).deleteRecursively()
    KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(alias(world))
    null
  }

  override fun invalidate() {
    if (!worker.isShutdown) worker.execute(::leave)
    worker.shutdown()
    super.invalidate()
  }

  private fun leave() {
    open?.second?.close()
    open = null
    WorldGate.leave()
  }

  private fun opened(): HistoryStorage {
    val (world, storage) = open ?: throw IllegalStateException("No world is open")
    check(WorldGate.world == world) { "The world was left" }
    return storage
  }

  private fun folder(world: String) = File(root, world)

  private fun alias(world: String) = "minhajna.world.$world"

  private fun onWorker(promise: Promise, world: String?, task: () -> Any?) {
    worker.execute {
      try {
        require(world == null || WORLD_ID.matches(world)) { "A world is named by the 5 characters of its ID" }
        promise.resolve(task())
      } catch (e: KeyLostException) {
        promise.reject("E_KEY_LOST", e.message, e)
      } catch (e: Exception) {
        promise.reject("E_WORLD", e.message ?: e.javaClass.simpleName, e)
      }
    }
  }

  companion object {
    private const val ROOT = "worlds"
    private val WORLD_ID = Regex("[0-9A-HJKMNP-TV-Z]{5}")
  }
}
