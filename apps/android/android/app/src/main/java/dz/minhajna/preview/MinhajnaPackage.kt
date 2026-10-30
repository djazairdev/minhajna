// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import dz.minhajna.preview.documents.MinhajnaPdfModule
import dz.minhajna.preview.files.MinhajnaFilesModule
import dz.minhajna.preview.about.MinhajnaBuildModule
import dz.minhajna.preview.language.MinhajnaInterfaceModule
import dz.minhajna.preview.licences.MinhajnaLicencesModule
import dz.minhajna.preview.lock.MinhajnaLockModule
import dz.minhajna.preview.notify.MinhajnaNotifyModule
import dz.minhajna.preview.storage.MinhajnaStorageModule
import dz.minhajna.preview.storage.MinhajnaWorldModule
import dz.minhajna.preview.storage.NativeMinhajnaBuildSpec
import dz.minhajna.preview.storage.NativeMinhajnaInterfaceSpec
import dz.minhajna.preview.storage.NativeMinhajnaLicencesSpec
import dz.minhajna.preview.storage.NativeMinhajnaLockSpec
import dz.minhajna.preview.storage.NativeMinhajnaNotifySpec
import dz.minhajna.preview.storage.NativeMinhajnaPdfSpec
import dz.minhajna.preview.storage.NativeMinhajnaFilesSpec
import dz.minhajna.preview.storage.NativeMinhajnaStorageSpec
import dz.minhajna.preview.storage.NativeMinhajnaWorldSpec
import dz.minhajna.preview.calendar.MinhajnaCalendarInputModule
import dz.minhajna.preview.crash.MinhajnaCrashModule
import dz.minhajna.preview.storage.NativeMinhajnaCrashSpec
import dz.minhajna.preview.storage.NativeMinhajnaCalendarInputSpec
import dz.minhajna.preview.signature.MinhajnaSignatureModule
import dz.minhajna.preview.storage.NativeMinhajnaSignatureSpec

/** Registers the app's own TurboModules, and debug builds' extra ones; libraries come through autolinking. */
class MinhajnaPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    when (name) {
      NativeMinhajnaStorageSpec.NAME -> MinhajnaStorageModule(reactContext)
      NativeMinhajnaInterfaceSpec.NAME -> MinhajnaInterfaceModule(reactContext)
      NativeMinhajnaLicencesSpec.NAME -> MinhajnaLicencesModule(reactContext)
      NativeMinhajnaPdfSpec.NAME -> MinhajnaPdfModule(reactContext)
      NativeMinhajnaFilesSpec.NAME -> MinhajnaFilesModule(reactContext)
      NativeMinhajnaBuildSpec.NAME -> MinhajnaBuildModule(reactContext)
      NativeMinhajnaLockSpec.NAME -> MinhajnaLockModule(reactContext)
      NativeMinhajnaCalendarInputSpec.NAME -> MinhajnaCalendarInputModule(reactContext)
      NativeMinhajnaSignatureSpec.NAME -> MinhajnaSignatureModule(reactContext)
      NativeMinhajnaNotifySpec.NAME -> MinhajnaNotifyModule(reactContext)
      NativeMinhajnaCrashSpec.NAME -> MinhajnaCrashModule(reactContext)
      NativeMinhajnaWorldSpec.NAME -> MinhajnaWorldModule(reactContext)
      else -> DebugModules.create(name, reactContext)
    }

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      info(NativeMinhajnaStorageSpec.NAME, MinhajnaStorageModule::class.java.name),
      info(NativeMinhajnaInterfaceSpec.NAME, MinhajnaInterfaceModule::class.java.name),
      info(NativeMinhajnaLicencesSpec.NAME, MinhajnaLicencesModule::class.java.name),
      info(NativeMinhajnaPdfSpec.NAME, MinhajnaPdfModule::class.java.name),
      info(NativeMinhajnaFilesSpec.NAME, MinhajnaFilesModule::class.java.name),
      info(NativeMinhajnaBuildSpec.NAME, MinhajnaBuildModule::class.java.name),
      info(NativeMinhajnaLockSpec.NAME, MinhajnaLockModule::class.java.name),
      info(NativeMinhajnaCalendarInputSpec.NAME, MinhajnaCalendarInputModule::class.java.name),
      info(NativeMinhajnaSignatureSpec.NAME, MinhajnaSignatureModule::class.java.name),
      info(NativeMinhajnaNotifySpec.NAME, MinhajnaNotifyModule::class.java.name),
      info(NativeMinhajnaCrashSpec.NAME, MinhajnaCrashModule::class.java.name),
      info(NativeMinhajnaWorldSpec.NAME, MinhajnaWorldModule::class.java.name),
    ) + DebugModules.classes.map { (name, className) -> info(name, className) }
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
