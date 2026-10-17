// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.language

import com.facebook.react.ReactApplication
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import dz.minhajna.preview.storage.NativeMinhajnaInterfaceSpec

/** The interface language for the app's JavaScript: read and kept by [InterfaceLanguage]. */
class MinhajnaInterfaceModule(context: ReactApplicationContext) : NativeMinhajnaInterfaceSpec(context) {

  override fun language(): String? = InterfaceLanguage.language(reactApplicationContext)

  override fun setLanguage(code: String) = InterfaceLanguage.set(reactApplicationContext, code)

  /** Reloads React Native, which reads the direction again as it starts. */
  override fun restart() {
    val host = (reactApplicationContext.applicationContext as ReactApplication).reactHost ?: return
    UiThreadUtil.runOnUiThread { host.reload("The interface language changed direction") }
  }

  /** Android logs the time since launch, as "Fully drawn", for timing a start on any phone. */
  override fun reportFullyDrawn() {
    val activity = reactApplicationContext.currentActivity ?: return
    UiThreadUtil.runOnUiThread { activity.reportFullyDrawn() }
  }
}
