// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.lock

import android.content.Context

/**
 * The lock's own choices on this phone (#210): how long the app waits
 * unused before it locks, and whether screenshots are allowed on screens
 * with pupils' records. They are settings of this phone, not records, so
 * they stay out of the history, and the lock screen reads its delay before
 * the history opens. Android's backup takes nothing from the app
 * (data_extraction_rules.xml).
 */
class LockSettings(context: Context, file: String = FILE) {
  private val preferences = context.getSharedPreferences(file, Context.MODE_PRIVATE)

  /** Minutes unused before the app locks: one of [DELAYS]. */
  val delay: Int
    get() = preferences.getInt(DELAY, DEFAULT_DELAY).takeIf { it in DELAYS } ?: DEFAULT_DELAY

  /** Whether the teacher allowed screenshots; off until they do. */
  val screenshots: Boolean
    get() = preferences.getBoolean(SCREENSHOTS, false)

  /** Keeps the delay, written to the disk before returning. */
  fun setDelay(minutes: Int) {
    require(minutes in DELAYS) { "The lock delay is 1, 5 or 15 minutes" }
    check(preferences.edit().putInt(DELAY, minutes).commit()) { "The lock delay did not save" }
  }

  /** Keeps the screenshot choice, written to the disk before returning. */
  fun setScreenshots(allowed: Boolean) {
    check(preferences.edit().putBoolean(SCREENSHOTS, allowed).commit()) { "The screenshot choice did not save" }
  }

  companion object {
    val DELAYS = setOf(1, 5, 15)
    const val DEFAULT_DELAY = 5
    private const val FILE = "dz.minhajna.preview.lock"
    private const val DELAY = "delayMinutes"
    private const val SCREENSHOTS = "screenshots"
  }
}
