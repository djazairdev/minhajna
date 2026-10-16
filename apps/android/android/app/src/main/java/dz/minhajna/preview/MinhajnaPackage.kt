// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import dz.minhajna.preview.language.MinhajnaInterfaceModule
import dz.minhajna.preview.licences.MinhajnaLicencesModule
import dz.minhajna.preview.storage.MinhajnaStorageModule
import dz.minhajna.preview.storage.NativeMinhajnaInterfaceSpec
import dz.minhajna.preview.storage.NativeMinhajnaLicencesSpec
import dz.minhajna.preview.storage.NativeMinhajnaStorageSpec

/** Registers the app's own TurboModules; libraries come through autolinking. */
class MinhajnaPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    when (name) {
      NativeMinhajnaStorageSpec.NAME -> MinhajnaStorageModule(reactContext)
      NativeMinhajnaInterfaceSpec.NAME -> MinhajnaInterfaceModule(reactContext)
      NativeMinhajnaLicencesSpec.NAME -> MinhajnaLicencesModule(reactContext)
      else -> null
    }

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      info(NativeMinhajnaStorageSpec.NAME, MinhajnaStorageModule::class.java.name),
      info(NativeMinhajnaInterfaceSpec.NAME, MinhajnaInterfaceModule::class.java.name),
      info(NativeMinhajnaLicencesSpec.NAME, MinhajnaLicencesModule::class.java.name),
    )
  }

  private fun info(name: String, className: String) = name to ReactModuleInfo(
    name = name,
    className = className,
    canOverrideExistingModule = false,
    needsEagerInit = false,
    isCxxModule = false,
    isTurboModule = true,
  )
}
