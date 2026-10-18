// SPDX-FileCopyrightText: Meta Platforms, Inc. and affiliates
// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: MIT

// Screens restores its fragments before the activity restores its views,
// and the window starts secure until the app names the screen in front
// (#210).

package dz.minhajna.preview

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import dz.minhajna.preview.lock.ScreenGuard
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
    super.onCreate(savedInstanceState)
    ScreenGuard.start(this)
  }

  /** The main component registered from JavaScript, in index.js. */
  override fun getMainComponentName(): String = "Minhajna"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
