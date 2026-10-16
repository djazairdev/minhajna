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
  private const val OLD_DIRECTION = "rightToLeft"
  private val CODE = Regex("^[a-z]{2,3}$")

  /**
   * The interface languages written left to right. Any other code, or none,
   * opens right to left: the app's JavaScript shows Arabic for a language it
   * does not offer, such as one kept by a later version. A Jest test checks
   * that this list matches the catalogues' directions.
   */
  private val LEFT_TO_RIGHT = setOf("fr", "en")

  fun language(context: Context): String? = preferences(context).getString(LANGUAGE, null)

  /** Whether the interface reads right to left with this language kept. */
  fun isRightToLeft(code: String?): Boolean = code !in LEFT_TO_RIGHT

  /**
   * Keeps the language, written to the disk before returning, and drops the
   * direction the first previews kept beside it: the direction now follows
   * the code alone.
   */
  fun set(context: Context, code: String) {
    require(CODE.matches(code)) { "A language is a two- or three-letter code" }
    preferences(context).edit().putString(LANGUAGE, code).remove(OLD_DIRECTION).commit()
    applyDirection(context)
  }

  /**
   * Sets React Native's direction from the kept language, before it starts.
   * React Native flips to right to left when it is forced, or when it is
   * allowed and the phone's language is right to left, so a left-to-right
   * language turns both off: French stays left to right on an Arabic phone.
   */
  fun applyDirection(context: Context) {
    val rightToLeft = isRightToLeft(language(context))
    I18nUtil.instance.allowRTL(context, rightToLeft)
    I18nUtil.instance.forceRTL(context, rightToLeft)
  }

  private fun preferences(context: Context) = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
}
