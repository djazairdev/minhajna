// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.lock

import android.app.Activity
import android.view.WindowManager

/**
 * Keeps pupils' records out of screenshots, screen recordings and the
 * recent-apps preview (R-6.4-07), unless the teacher allowed screenshots,
 * and the PIN pads out of them always, so no recording shows a PIN typed.
 * It fails closed: each time the activity starts, the window is secure
 * until the app names the screen in front, and a kind it does not know is
 * treated as a PIN pad.
 */
object ScreenGuard {
  const val OPEN = "open"
  const val RECORDS = "records"
  const val PIN = "pin"

  @Volatile private var showing = PIN

  /** The activity starts: secure until the app says otherwise. */
  fun start(activity: Activity) {
    showing = PIN
    apply(activity)
  }

  /** The kind of screen in front: open, records or pin; applies at once. */
  fun show(activity: Activity?, kind: String) {
    showing = kind
    apply(activity)
  }

  /** Sets or clears the window's secure flag from the screen in front and the teacher's choice. */
  fun apply(activity: Activity?) {
    if (activity == null) return
    val secure = isSecure(showing, LockSettings(activity).screenshots)
    activity.runOnUiThread {
      if (secure) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
      } else {
        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
      }
    }
  }

  fun isSecure(kind: String, screenshotsAllowed: Boolean): Boolean = when (kind) {
    OPEN -> false
    RECORDS -> !screenshotsAllowed
    else -> true
  }
}
