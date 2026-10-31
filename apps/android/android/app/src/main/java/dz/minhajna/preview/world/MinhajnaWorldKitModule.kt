// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.world

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import dz.minhajna.preview.storage.Hashing
import dz.minhajna.preview.storage.NativeMinhajnaWorldKitSpec
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException

/**
 * Hands a demo world's cryptography (WorldCrypto) to the app (#561, #570), on its
 * own worker, so the world's 600,000-round derivation never holds the screen
 * or the signature checks. Bytes cross as lowercase hex. Any failure answers
 * E_WORLD_KIT and says nothing of the bytes, the key or the platform's
 * exception; a seal that does not open answers null, as on a PC. Whether
 * the app may connect at all is answered at once: a build without the
 * network permission offers no world (#561, answer 575).
 */
class MinhajnaWorldKitModule(context: ReactApplicationContext) : NativeMinhajnaWorldKitSpec(context) {
  private val worker = Executors.newSingleThreadExecutor { task -> Thread(task, "minhajna-world-kit") }

  override fun canConnect(): Boolean = mayConnect(reactApplicationContext)

  override fun derive(secret: String, salt: String, rounds: Double, promise: Promise) = onWorker(promise) {
    require(rounds == Math.floor(rounds)) { "Invalid rounds" }
    Hashing.hex(WorldCrypto.derive(bytes(secret), bytes(salt), rounds.toInt()))
  }

  override fun mac(key: String, data: String, promise: Promise) = onWorker(promise) {
    Hashing.hex(WorldCrypto.mac(bytes(key), bytes(data)))
  }

  override fun seal(key: String, plain: String, additional: String, promise: Promise) = onWorker(promise) {
    Hashing.hex(WorldCrypto.seal(bytes(key), bytes(plain), bytes(additional)))
  }

  override fun open(key: String, sealed: String, additional: String, promise: Promise) = onWorker(promise) {
    WorldCrypto.open(bytes(key), bytes(sealed), bytes(additional))?.let(Hashing::hex)
  }

  override fun sign(pkcs8: String, text: String, promise: Promise) = onWorker(promise) {
    WorldCrypto.sign(pkcs8, text)
  }

  override fun newPair(promise: Promise) = onWorker(promise) {
    val pair = WorldCrypto.newPair()
    Arguments.createMap().apply {
      putString("spki", pair.spki)
      putString("pkcs8", pair.pkcs8)
      putString("fingerprint", pair.fingerprint)
    }
  }

  override fun newAgreement(promise: Promise) = onWorker(promise) {
    val pair = WorldCrypto.newAgreement()
    Arguments.createMap().apply {
      putString("publicKey", Hashing.hex(pair.publicKey))
      putString("pkcs8", pair.pkcs8)
    }
  }

  override fun agree(pkcs8: String, publicKey: String, promise: Promise) = onWorker(promise) {
    Hashing.hex(WorldCrypto.agree(pkcs8, bytes(publicKey)))
  }

  private fun onWorker(promise: Promise, task: () -> Any?) {
    try {
      worker.execute {
        try {
          promise.resolve(task())
        } catch (_: Throwable) {
          promise.reject("E_WORLD_KIT", "The world's cryptography failed")
        }
      }
    } catch (_: RejectedExecutionException) {
      promise.reject("E_WORLD_KIT", "The world's cryptography is closed")
    }
  }

  override fun invalidate() {
    worker.shutdown()
    super.invalidate()
  }
}

/** Whether the app holds Android's INTERNET permission. */
internal fun mayConnect(context: Context): Boolean =
  context.checkSelfPermission(Manifest.permission.INTERNET) == PackageManager.PERMISSION_GRANTED

/** Lowercase hex as bytes; anything else is refused. */
internal fun bytes(hex: String): ByteArray {
  require(hex.length % 2 == 0 && hex.all { it in '0'..'9' || it in 'a'..'f' }) { "Not lowercase hex" }
  return ByteArray(hex.length / 2) { i -> hex.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
}
