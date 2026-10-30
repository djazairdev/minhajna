// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import java.io.File
import java.security.SecureRandom
import java.time.LocalDate
import org.json.JSONArray
import org.json.JSONObject

/**
 * A history in one folder: the database and its key, read and written
 * as the JavaScript side sends them, in JSON. The app keeps one, in its
 * no-backup folder; the storage check in debug builds opens throwaway ones,
 * each with its own Keystore key, through this same code.
 *
 * It is not thread-safe: each caller keeps it to one thread, so that a write
 * is committed before the next one starts. While a demo world is open
 * ([WorldGate]), the teacher's history closes at its next call and refuses
 * every call; a world's own history, under another alias, is not held back.
 */
class HistoryStorage(
  private val folder: File,
  private val alias: String = DatabaseKey.ALIAS,
  private val teachers: Boolean = alias == DatabaseKey.ALIAS,
) {

  private var history: HistoryDatabase? = null

  /**
   * Opens the history with the 0.1.0 key file, creating both on first use,
   * while no PIN is set. Opening it again does nothing.
   */
  fun open(random: SecureRandom) {
    refuseInWorld()
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
    refuseInWorld()
    if (history != null) return
    history = HistoryDatabase.open(File(folder, DATABASE), bytes)
  }

  fun isOpen(): Boolean = history != null && !(teachers && WorldGate.isOpen)

  fun exists(): Boolean = File(folder, DATABASE).exists()

  /** Every entry, by sequence, as a JSON array. */
  fun loadJson(): String = toJson(opened().load())

  /** Adds one entry, given as JSON, and returns once it is committed. */
  fun appendJson(entry: String) = opened().append(fromJson(JSONObject(entry)))

  /** Adds entries, given as a JSON array, after the last, all or none (#250). */
  fun appendAllJson(entries: String) {
    val array = JSONArray(entries)
    opened().appendAll(List(array.length()) { fromJson(array.getJSONObject(it)) })
  }

  fun eraseContent(ids: List<String>) = opened().eraseContent(ids)

  /** Stores a restored history, given as a JSON array, in this empty one, all or none (#247). */
  fun restoreJson(entries: String) {
    val array = JSONArray(entries)
    opened().restore(List(array.length()) { fromJson(array.getJSONObject(it)) })
  }

  /** The pilot's timings, in the order kept, as a JSON array (#220). */
  fun loadTimingsJson(): String {
    val array = JSONArray()
    for (row in opened().loadTimings()) {
      array.put(
        JSONObject().put("kind", row.kind).put("week", row.week).put("tenths", row.tenths).put("oneTap", row.oneTap),
      )
    }
    return array.toString()
  }

  /**
   * Adds timings given as a JSON array, all or none. Each field must already
   * have its own type, as JSON's own conversions would change a value, and
   * the week must be a real date.
   */
  fun addTimingsJson(timings: String) {
    val array = JSONArray(timings)
    val rows = List(array.length()) { at -> timingFromJson(array.getJSONObject(at)) }
    opened().addTimings(rows)
  }

  fun clearTimings() = opened().clearTimings()

  fun close() {
    history?.close()
    history = null
  }

  private fun opened(): HistoryDatabase {
    refuseInWorld()
    return history ?: throw IllegalStateException("The history is not open")
  }

  private fun refuseInWorld() {
    if (!teachers || !WorldGate.isOpen) return
    close()
    throw WorldOpenException()
  }

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

    fun timingFromJson(json: JSONObject): TimingRow {
      val kind = json.get("kind")
      val week = json.get("week")
      val tenths = json.get("tenths")
      val oneTap = json.get("oneTap")
      require(kind is String && week is String && (tenths is Int || tenths is Long) && oneTap is Boolean) {
        "A timing is malformed"
      }
      LocalDate.parse(week)
      return TimingRow(kind, week, (tenths as Number).toLong(), oneTap)
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
