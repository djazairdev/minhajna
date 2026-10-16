// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.language

import android.content.Context
import com.facebook.react.modules.i18nmanager.I18nUtil

/**
 * The interface language chosen on this phone, and its direction (#21).
 * Before any choice the interface is Arabic, right to left, whatever the
 * phone's own language (answer 157). The choice is a setting of this phone,
 * not a record: it stays out of the history.
 */
object InterfaceLanguage {
  private const val PREFERENCES = "dz.minhajna.preview.interface"
  private const val LANGUAGE = "language"
  private const val RIGHT_TO_LEFT = "rightToLeft"
  private val CODE = Regex("^[a-z]{2,3}$")

  fun language(context: Context): String? = preferences(context).getString(LANGUAGE, null)

  /** Keeps the language and its direction, written to the disk before returning. */
  fun set(context: Context, code: String, rightToLeft: Boolean) {
    require(CODE.matches(code)) { "A language is a two- or three-letter code" }
    preferences(context).edit().putString(LANGUAGE, code).putBoolean(RIGHT_TO_LEFT, rightToLeft).commit()
    applyDirection(context)
  }

  /**
   * Sets React Native's direction from the kept choice, before it starts.
   * React Native flips to right to left when it is forced, or when it is
   * allowed and the phone's language is right to left, so a left-to-right
   * language turns both off: French stays left to right on an Arabic phone.
   */
  fun applyDirection(context: Context) {
    val rightToLeft = preferences(context).getBoolean(RIGHT_TO_LEFT, true)
    I18nUtil.instance.allowRTL(context, rightToLeft)
    I18nUtil.instance.forceRTL(context, rightToLeft)
  }

  private fun preferences(context: Context) = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
}
