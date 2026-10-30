// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.signature

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import dz.minhajna.preview.storage.NativeMinhajnaSignatureSpec
import dz.minhajna.preview.storage.WorldOpenException
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException

/**
 * Checks the signatures of signed updates (#223) on a worker, so a large
 * file never holds the screen. The core reads a payload only after this
 * says its signature checks; a check asked for after the app reloaded
 * says it does not. Teacher signing and QR drawing (#437) run on the same
 * worker. Errors expose no payload, key material or platform exception,
 * and any failure on the worker, an Error included, still answers.
 * Only public keys leave the Keystore; a new phone has a new signing key,
 * never a backup or transfer of this one. Device erasure (#248) must remove
 * TeacherSigningKey.ALIAS. No method signs automatically at app startup.
 * While a demo world is open (#558), the teacher's key is refused with
 * E_WORLD; checking signatures and drawing QR codes go on.
 */
class MinhajnaSignatureModule(
  context: ReactApplicationContext,
  private val teacher: TeacherSigningKey = TeacherSigningKey(),
) : NativeMinhajnaSignatureSpec(context) {
  private val worker = Executors.newSingleThreadExecutor { task -> Thread(task, "minhajna-signature") }

  override fun teacherKey(promise: Promise) = onWorker(promise, "E_SIGNING", "Signing failed") {
    teacher.publicKey()
  }

  override fun sign(payload: String, promise: Promise) = onWorker(promise, "E_SIGNING", "Signing failed") {
    teacher.sign(payload)
  }

  override fun keyFingerprint(spki: String, promise: Promise) = onWorker(promise, "E_SIGNING", "Signing failed") {
    signingKeyFingerprint(spki)
  }

  override fun qrMatrix(text: String, promise: Promise) = onWorker(promise, "E_QR", "QR encoding failed") {
    val rows = statementQr(text)
    Arguments.createMap().apply {
      putInt("size", rows.size)
      putArray("rows", Arguments.createArray().apply { rows.forEach(::pushString) })
    }
  }

  private fun onWorker(promise: Promise, code: String, message: String, task: () -> Any?) {
    try {
      worker.execute {
        try {
          promise.resolve(task())
        } catch (e: WorldOpenException) {
          promise.reject(e.code, e.message)
        } catch (_: Throwable) {
          promise.reject(code, message)
        }
      }
    } catch (_: RejectedExecutionException) {
      promise.reject("E_SIGNATURE_CLOSED", "Signing service unavailable")
    }
  }

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
