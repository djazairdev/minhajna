// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.biometrics.BiometricManager
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.os.CancellationSignal
import androidx.annotation.RequiresApi
import java.util.concurrent.atomic.AtomicBoolean
import javax.crypto.Cipher

/**
 * The phone's own biometric prompt, from the platform, from Android 9 (#210).
 * The prompt releases a Keystore cipher once the phone has matched a strong
 * fingerprint or face; the app never sees the fingerprint or the face, only
 * the cipher. Before Android 9, the app opens with the PIN alone.
 */
object BiometricUnlock {

  /** The words on the prompt, in the app's language. The phone refuses a prompt without a title or a cancel button. */
  class Texts(val title: String, val subtitle: String, val cancel: String) {
    init {
      require(title.isNotBlank() && cancel.isNotBlank()) { "The prompt needs a title and a cancel button" }
    }
  }

  /**
   * The phone can match a strong fingerprint or face, and one is enrolled.
   * Android 9 cannot say whether one is enrolled, only that the phone has a
   * fingerprint reader and a screen lock; without a fingerprint, making the
   * key fails, and turning it on is refused.
   */
  fun available(context: Context): Boolean = when {
    Build.VERSION.SDK_INT >= 30 ->
      context.getSystemService(BiometricManager::class.java)
        ?.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS
    Build.VERSION.SDK_INT == 29 ->
      @Suppress("DEPRECATION")
      (context.getSystemService(BiometricManager::class.java)?.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS)
    Build.VERSION.SDK_INT == 28 ->
      context.packageManager.hasSystemFeature(PackageManager.FEATURE_FINGERPRINT) &&
        context.getSystemService(KeyguardManager::class.java)?.isDeviceSecure == true
    else -> false
  }

  /**
   * Shows the prompt over the activity, from the main thread, and returns at
   * once. `done` runs once, on the main thread, with the released cipher, or
   * with null when the teacher cancels, the phone stops the prompt, `signal`
   * cancels it or it cannot be shown. A finger that does not match leaves
   * the prompt open for another try.
   */
  @RequiresApi(28)
  fun prompt(activity: Activity, texts: Texts, cipher: Cipher, signal: CancellationSignal, done: (Cipher?) -> Unit) {
    val once = AtomicBoolean(false)
    val finish = { released: Cipher? -> if (once.compareAndSet(false, true)) done(released) }
    val callback = object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        finish(result.cryptoObject?.cipher)
      }

      override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
        finish(null)
      }
    }
    activity.runOnUiThread {
      try {
        val executor = activity.mainExecutor
        val builder = BiometricPrompt.Builder(activity)
          .setTitle(texts.title)
          .setNegativeButton(texts.cancel, executor) { _, _ -> finish(null) }
        if (texts.subtitle.isNotEmpty()) builder.setSubtitle(texts.subtitle)
        if (Build.VERSION.SDK_INT >= 30) builder.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        builder.build().authenticate(BiometricPrompt.CryptoObject(cipher), signal, executor, callback)
      } catch (_: Exception) {
        finish(null)
      }
    }
  }
}
