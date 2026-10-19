// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.language

import android.content.Context
import android.util.Log

/**
 * The phone's own settings, such as the print screen's choices (#215): a
 * key and a short text, kept in the app's private preferences and out of
 * the history, so they stay on this phone. Nothing about pupils or lessons
 * belongs here.
 */
object DeviceSettings {
  private const val TAG = "MinhajnaSettings"
  private const val PREFERENCES = "dz.minhajna.preview.settings"
  private const val MAX_VALUE = 4_096
  private val KEY = Regex("^[a-z0-9-]{1,64}$")

  fun get(context: Context, key: String): String? =
    if (KEY.matches(key)) preferences(context).getString(key, null) else null

  /**
   * Keeps the setting, written to the disk before returning. A key other
   * than lowercase letters, digits and hyphens, or a value over
   * [MAX_VALUE] characters, is left unkept and logged.
   */
  fun set(context: Context, key: String, value: String) {
    if (!KEY.matches(key) || value.length > MAX_VALUE) {
      Log.w(TAG, "A setting was not kept: its key or its length is not allowed")
      return
    }
    preferences(context).edit().putString(key, value).commit()
  }

  private fun preferences(context: Context) = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
}
