// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview

import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext

/** Release builds have none of the debug builds' extra modules, such as the storage check's. */
object DebugModules {

  val classes: Map<String, String> = emptyMap()

  @Suppress("UNUSED_PARAMETER")
  fun create(name: String, context: ReactApplicationContext): NativeModule? = null
}
