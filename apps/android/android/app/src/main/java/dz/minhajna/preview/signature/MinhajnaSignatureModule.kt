// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.signature

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import dz.minhajna.preview.storage.NativeMinhajnaSignatureSpec
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException

/**
 * Checks the signatures of signed updates (#223) on a worker, so a large
 * file never holds the screen. The core reads a payload only after this
 * says its signature checks; a check asked for after the app reloaded
 * says it does not.
 */
class MinhajnaSignatureModule(context: ReactApplicationContext) : NativeMinhajnaSignatureSpec(context) {
  private val worker = Executors.newSingleThreadExecutor { task -> Thread(task, "minhajna-signature") }

  override fun verify(spki: String, payload: String, signature: String, promise: Promise) {
    try {
      worker.execute { promise.resolve(verifies(spki, payload, signature)) }
    } catch (e: RejectedExecutionException) {
      promise.resolve(false)
    }
  }

  override fun invalidate() {
    worker.shutdown()
    super.invalidate()
  }
}
