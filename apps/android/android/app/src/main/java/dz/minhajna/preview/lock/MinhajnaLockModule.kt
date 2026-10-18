// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.lock

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import dz.minhajna.preview.storage.NativeMinhajnaLockSpec

/** The lock's settings and the screen guard, for the «القفل والأمان» screen (#210). */
class MinhajnaLockModule(context: ReactApplicationContext) : NativeMinhajnaLockSpec(context) {
  private val settings = LockSettings(context)

  override fun settings(): WritableMap = Arguments.createMap().apply {
    putInt("delayMinutes", settings.delay)
    putBoolean("screenshots", settings.screenshots)
  }

  override fun setDelay(minutes: Double, promise: Promise) {
    try {
      require(minutes.toInt().toDouble() == minutes) { "The lock delay is whole minutes" }
      settings.setDelay(minutes.toInt())
      promise.resolve(null)
    } catch (error: IllegalArgumentException) {
      promise.reject("E_SETTING", error.message, error)
    } catch (error: IllegalStateException) {
      promise.reject("E_SETTING", error.message, error)
    }
  }

  override fun allowScreenshots(allowed: Boolean, promise: Promise) {
    try {
      settings.setScreenshots(allowed)
      ScreenGuard.apply(reactApplicationContext.currentActivity)
      promise.resolve(null)
    } catch (error: IllegalStateException) {
      promise.reject("E_SETTING", error.message, error)
    }
  }

  override fun showing(kind: String) {
    ScreenGuard.show(reactApplicationContext.currentActivity, kind)
  }
}
