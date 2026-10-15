// SPDX-FileCopyrightText: Meta Platforms, Inc. and affiliates
// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: MIT

package dz.minhajna.preview

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // Screens restores its fragments before the activity restores its views.
    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
    super.onCreate(savedInstanceState)
  }

  /** The main component registered from JavaScript, in index.js. */
  override fun getMainComponentName(): String = "Minhajna"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
