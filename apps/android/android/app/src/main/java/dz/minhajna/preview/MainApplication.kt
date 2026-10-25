// SPDX-FileCopyrightText: Meta Platforms, Inc. and affiliates
// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: MIT

package dz.minhajna.preview

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import dz.minhajna.preview.crash.CrashKeep
import dz.minhajna.preview.documents.MinhajnaPdfModule
import dz.minhajna.preview.files.MinhajnaFilesModule
import dz.minhajna.preview.language.InterfaceLanguage

class MainApplication : Application(), ReactApplication {

  /** The React host, with the app's own modules beside the libraries that autolinking finds. */
  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList = PackageList(this).packages + MinhajnaPackage(),
    )
  }

  override fun onCreate() {
    super.onCreate()
    CrashKeep.install(this)
    registerFonts()
    MinhajnaPdfModule.clearCache(this)
    MinhajnaFilesModule.clearCache(this)
    InterfaceLanguage.applyDirection(this)
    loadReactNative(this)
  }

  /**
   * Registers the bundled fonts as local resources, ready for the first frame
   * in airplane mode. Each weight is registered separately: React Native folds
   * 500/600 into normal on API 26.
   */
  private fun registerFonts() {
    val fonts = ReactFontManager.getInstance()
    fonts.addCustomFont(this, "Aref Ruqaa", R.font.aref_ruqaa_bold)
    fonts.addCustomFont(this, "Noto Naskh Arabic", R.font.noto_naskh_arabic_regular)
    fonts.addCustomFont(this, "Noto Naskh Arabic Medium", R.font.noto_naskh_arabic_medium)
    fonts.addCustomFont(this, "Noto Naskh Arabic SemiBold", R.font.noto_naskh_arabic_semibold)
    fonts.addCustomFont(this, "Noto Naskh Arabic Bold", R.font.noto_naskh_arabic_bold)
    fonts.addCustomFont(this, "Noto Sans", R.font.noto_sans_regular)
    fonts.addCustomFont(this, "Noto Sans Medium", R.font.noto_sans_medium)
    fonts.addCustomFont(this, "Noto Sans SemiBold", R.font.noto_sans_semibold)
    fonts.addCustomFont(this, "Noto Sans Bold", R.font.noto_sans_bold)
  }
}
