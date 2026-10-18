// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import java.io.File
import java.security.SecureRandom
import org.json.JSONArray
import org.json.JSONObject

/**
 * A history in one folder: the database and its key, read and written
 * as the JavaScript side sends them, in JSON. The app keeps one, in its
 * no-backup folder; the storage check in debug builds opens throwaway ones,
 * each with its own Keystore key, through this same code.
 *
 * It is not thread-safe: each caller keeps it to one thread, so that a write
 * is committed before the next one starts.
 */
class HistoryStorage(private val folder: File, private val alias: String = DatabaseKey.ALIAS) {

  private var history: HistoryDatabase? = null

  /**
   * Opens the history with the 0.1.0 key file, creating both on first use,
   * while no PIN is set. Opening it again does nothing.
   */
  fun open(random: SecureRandom) {
    if (history != null) return
    val key = DatabaseKey(File(folder, KEY), alias)
    if (exists() && !key.exists()) {
      throw KeyLostException("The history's key file is missing")
    }
    val bytes = key.getOrCreate(random)
    try {
      openWithKey(bytes)
    } finally {
      bytes.fill(0)
    }
  }

  /** Opens the history with a key the lock gave; the caller clears the key. Opening it again does nothing. */
  fun openWithKey(bytes: ByteArray) {
    if (history != null) return
    history = HistoryDatabase.open(File(folder, DATABASE), bytes)
  }

  fun isOpen(): Boolean = history != null

  fun exists(): Boolean = File(folder, DATABASE).exists()

  /** Every entry, by sequence, as a JSON array. */
  fun loadJson(): String = toJson(opened().load())

  /** Adds one entry, given as JSON, and returns once it is committed. */
  fun appendJson(entry: String) = opened().append(fromJson(JSONObject(entry)))

  fun eraseContent(ids: List<String>) = opened().eraseContent(ids)

  fun close() {
    history?.close()
    history = null
  }

  private fun opened(): HistoryDatabase = history ?: throw IllegalStateException("The history is not open")

  companion object {
    const val DATABASE = "history.db"
    const val KEY = "history.key"

    fun toJson(rows: List<EntryRow>): String {
      val array = JSONArray()
      for (row in rows) {
        array.put(
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
      return array.toString()
    }

    fun fromJson(json: JSONObject) = EntryRow(
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
    )
  }
}
