// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import java.io.File
import java.nio.charset.CharacterCodingException
import java.security.SecureRandom
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import org.json.JSONArray
import org.json.JSONObject

/**
 * The app's storage and cryptography (#19, #75): the history in SQLCipher,
 * its key in the Android Keystore, SHA-256 from MessageDigest and random
 * bytes from SecureRandom. Every primitive is the platform's or SQLCipher's.
 *
 * Database work runs on one thread, in order, so a promise resolves only
 * after its own write is committed. Error messages name no pupil: they carry
 * no data from the history.
 */
class MinhajnaStorageModule(context: ReactApplicationContext) : NativeMinhajnaStorageSpec(context) {

  private val random = SecureRandom()
  private val worker: ExecutorService = Executors.newSingleThreadExecutor { task -> Thread(task, "minhajna-history") }
  private val folder: File = context.noBackupFilesDir
  private var history: HistoryDatabase? = null

  override fun randomBytes(length: Double): String {
    val count = length.toInt()
    require(count.toDouble() == length && count in 1..MAX_RANDOM_BYTES) { "Ask for 1 to $MAX_RANDOM_BYTES bytes" }
    val bytes = ByteArray(count).also(random::nextBytes)
    return Hashing.hex(bytes)
  }

  override fun digest(texts: ReadableArray, promise: Promise) {
    // Copied on the calling thread: the array belongs to the bridge.
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

  override fun openHistory(promise: Promise) = onWorker(promise) {
    if (history == null) {
      val database = File(folder, DATABASE)
      val key = DatabaseKey(File(folder, KEY))
      if (database.exists() && !key.exists()) {
        throw KeyLostException("The history's key file is missing")
      }
      val bytes = key.getOrCreate(random)
      try {
        history = HistoryDatabase.open(database, bytes)
      } finally {
        bytes.fill(0)
      }
    }
    null
  }

  override fun loadHistory(promise: Promise) = onWorker(promise) {
    val rows = JSONArray()
    for (row in opened().load()) {
      rows.put(
        JSONObject()
          .put("seq", row.seq)
          .put("id", row.id)
          .put("day", row.day)
          .put("layer", row.layer)
          .put("kind", row.kind)
          .put("digest", row.digest)
          .put("previous", row.previous)
          .put("hash", row.hash)
          .put("salt", row.salt ?: JSONObject.NULL)
          .put("body", row.body ?: JSONObject.NULL),
      )
    }
    rows.toString()
  }

  override fun appendEntry(entry: String, promise: Promise) = onWorker(promise) {
    val json = JSONObject(entry)
    opened().append(
      EntryRow(
        seq = json.getLong("seq"),
        id = json.getString("id"),
        day = json.getString("day"),
        layer = json.getString("layer"),
        kind = json.getString("kind"),
        digest = json.getString("digest"),
        previous = json.getString("previous"),
        hash = json.getString("hash"),
        salt = if (json.isNull("salt")) null else json.getString("salt"),
        body = if (json.isNull("body")) null else json.getString("body"),
      ),
    )
    null
  }

  override fun eraseContent(ids: ReadableArray, promise: Promise) {
    val copies = List(ids.size()) { ids.getString(it) ?: "" }
    onWorker(promise) {
      opened().eraseContent(copies)
      null
    }
  }

  override fun invalidate() {
    worker.execute {
      history?.close()
      history = null
    }
    worker.shutdown()
    super.invalidate()
  }

  private fun opened(): HistoryDatabase = history ?: throw IllegalStateException("The history is not open")

  private fun onWorker(promise: Promise, task: () -> Any?) {
    worker.execute {
      try {
        promise.resolve(task())
      } catch (e: KeyLostException) {
        promise.reject("E_KEY_LOST", e.message, e)
      } catch (e: Exception) {
        // The message is SQLite's or the app's own, never a record's content.
        promise.reject("E_HISTORY", e.message ?: e.javaClass.simpleName, e)
      }
    }
  }

  companion object {
    const val DATABASE = "history.db"
    const val KEY = "history.key"
    private const val MAX_RANDOM_BYTES = 1024
  }
}
