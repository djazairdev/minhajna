// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.notify

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** A notification set ahead (#234, answer 406), as the app gave it. */
internal data class Planned(
  val id: String,
  val at: Long,
  val channel: String,
  val channelName: String,
  val title: String,
  val text: String,
  val open: String,
) {
  fun toJson(): JSONObject = JSONObject()
    .put("id", id)
    .put("at", at)
    .put("channel", channel)
    .put("channelName", channelName)
    .put("title", title)
    .put("text", text)
    .put("open", open)

  companion object {
    fun fromJson(json: JSONObject) = Planned(
      json.getString("id"),
      json.getLong("at"),
      json.getString("channel"),
      json.getString("channelName"),
      json.getString("title"),
      json.getString("text"),
      json.getString("open"),
    )
  }
}

/**
 * The notifications still planned, kept in the app's own preferences,
 * outside the history and out of backups (allowBackup is off). A list that
 * cannot be read counts as empty.
 */
internal object PlannedStore {
  private const val FILE = "minhajna-notify"
  private const val KEY = "planned"

  fun read(context: Context): List<Planned> {
    val saved = context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY, null) ?: return emptyList()
    return try {
      val array = JSONArray(saved)
      (0 until array.length()).map { Planned.fromJson(array.getJSONObject(it)) }
    } catch (e: Exception) {
      emptyList()
    }
  }

  fun write(context: Context, planned: List<Planned>) {
    val array = JSONArray().apply { planned.forEach { put(it.toJson()) } }
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(KEY, array.toString()).commit()
  }
}
