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
import com.facebook.react.modules.i18nmanager.I18nUtil

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList = PackageList(this).packages,
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Local resources, ready for the first frame in airplane mode. Register
    // each weight separately: React Native folds 500/600 into normal on API 26.
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
    // The interface is Arabic, right to left, whatever the phone's language,
    // and before React Native starts, so the first launch is right to left too.
    // The direction will follow the language the teacher chooses (#21).
    I18nUtil.instance.allowRTL(this, true)
    I18nUtil.instance.forceRTL(this, true)
    loadReactNative(this)
  }
}
