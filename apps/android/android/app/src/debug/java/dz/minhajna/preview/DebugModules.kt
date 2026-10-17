// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview

import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import dz.minhajna.preview.storage.MinhajnaStorageCheckModule
import dz.minhajna.preview.storage.NativeMinhajnaStorageCheckSpec

/** The modules that only debug builds have; release builds have an empty copy of this object. */
object DebugModules {

  /** Each module's name and class. */
  val classes: Map<String, String> = mapOf(
    NativeMinhajnaStorageCheckSpec.NAME to MinhajnaStorageCheckModule::class.java.name,
  )

  fun create(name: String, context: ReactApplicationContext): NativeModule? =
    when (name) {
      NativeMinhajnaStorageCheckSpec.NAME -> MinhajnaStorageCheckModule(context)
      else -> null
    }
}
