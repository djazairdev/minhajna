// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.about

import android.content.pm.PackageManager
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import dz.minhajna.preview.BuildConfig
import dz.minhajna.preview.storage.NativeMinhajnaBuildSpec
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.Executors

/**
 * The installed build as anyone can check it (choice F9, #49): its version,
 * the SHA-256 of the APK file Android installed, which matches the checksum
 * published with the preview, and the SHA-256 of the certificate that
 * signed it. It reads only the app's own APK, on a worker.
 */
class MinhajnaBuildModule(private val context: ReactApplicationContext) : NativeMinhajnaBuildSpec(context) {
  private val worker = Executors.newSingleThreadExecutor { task -> Thread(task, "minhajna-build") }

  override fun describe(promise: Promise) {
    worker.execute {
      try {
        promise.resolve(Arguments.createMap().apply {
          putString("version", BuildConfig.VERSION_NAME)
          putDouble("versionCode", BuildConfig.VERSION_CODE.toDouble())
          putString("apkSha256", sha256(File(context.applicationInfo.sourceDir)))
          putString("signerSha256", signer()?.let { hex(MessageDigest.getInstance("SHA-256").digest(it)) })
        })
      } catch (e: Exception) {
        promise.reject("E_BUILD", "The build could not be described", e)
      }
    }
  }

  /** The first signing certificate, or null when there is none to read. */
  private fun signer(): ByteArray? {
    val manager = context.packageManager
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val info = manager.getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
      info.signingInfo?.apkContentsSigners?.firstOrNull()?.toByteArray()
    } else {
      @Suppress("DEPRECATION")
      val info = manager.getPackageInfo(context.packageName, PackageManager.GET_SIGNATURES)
      @Suppress("DEPRECATION")
      info.signatures?.firstOrNull()?.toByteArray()
    }
  }

  override fun invalidate() {
    worker.shutdown()
    super.invalidate()
  }
}

/** A file's SHA-256, read in pieces, as lowercase hex. */
internal fun sha256(file: File): String {
  val digest = MessageDigest.getInstance("SHA-256")
  file.inputStream().use { input ->
    val buffer = ByteArray(1 shl 16)
    while (true) {
      val read = input.read(buffer)
      if (read < 0) break
      digest.update(buffer, 0, read)
    }
  }
  return hex(digest.digest())
}

internal fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it) }
