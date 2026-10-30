// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import android.app.ActivityManager
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.CookieManager
import android.webkit.WebStorage
import androidx.core.app.NotificationManagerCompat
import dz.minhajna.preview.language.InterfaceLanguage
import dz.minhajna.preview.notify.NotifyAlarms
import java.io.File
import java.security.KeyStore
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * «مسح هذا الجهاز» (#248, Erase, R-5.7-05, answer 477): everything the app
 * keeps on this phone, in one step. Nothing changes until the Keystore is
 * read; then the app's keys go first, so the encrypted history can no longer
 * be read even before its file goes, and the history closes. Every step
 * after runs even when one fails: the reminders, the notifications shown,
 * the files, databases and caches, and every setting of this phone, the
 * interface language and the lock's among them; the direction goes back to
 * the first start's, right to left. A step that failed once a key was gone
 * ends with Android clearing the app's data, which closes the app, or, when
 * Android refuses, with the history's folder emptied again, so the phone is
 * never left with a history it can no longer open.
 */
internal object DeviceErase {

  fun run(context: Context, closeHistory: () -> Unit) {
    WorldGate.refuse()
    val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    val steps: List<() -> Unit> = listOf(
      { for (alias in keyStore.aliases().toList()) keyStore.deleteEntry(alias) },
      closeHistory,
      { NotifyAlarms.replace(context, emptyList()) },
      { NotificationManagerCompat.from(context).cancelAll() },
      { if (File(context.applicationInfo.dataDir, "app_webview").exists()) clearWebView() },
      { for (folder in listOf(context.noBackupFilesDir, context.filesDir, context.cacheDir)) emptyFolder(folder) },
      { for (name in context.databaseList()) context.deleteDatabase(name) },
      { deletePreferences(context) },
      { InterfaceLanguage.applyDirection(context) },
      { check(keyStore.aliases().toList().isEmpty()) { "A key of the app is still in the Keystore" } },
      { check(context.noBackupFilesDir.listFiles().isNullOrEmpty()) { "The history's folder is not empty" } },
    )
    val failed = steps.mapNotNull { step -> runCatching(step).exceptionOrNull() }
    if (failed.isEmpty()) return
    val cleared = context.getSystemService(ActivityManager::class.java)?.clearApplicationUserData() == true
    if (!cleared) runCatching { emptyFolder(context.noBackupFilesDir) }
    throw failed.first()
  }

  /** Deletes what the folder holds, and keeps the folder, which the platform expects to find. */
  private fun emptyFolder(folder: File) {
    for (child in folder.listFiles().orEmpty()) child.deleteRecursively()
  }

  /** Deletes every settings file, and its copy in memory. */
  private fun deletePreferences(context: Context) {
    val files = File(context.applicationInfo.dataDir, "shared_prefs").listFiles().orEmpty()
    for (name in files.map { it.name }.filter { it.endsWith(".xml") }) {
      context.deleteSharedPreferences(name.removeSuffix(".xml"))
    }
  }

  /**
   * What the print WebView may keep, once one was used on this phone, so the erasure never starts one: cleared on
   * the main thread as WebView asks, and waited for, so its own settings are written before the settings go. The
   * documents load as data, so it holds no record. Best effort.
   */
  private fun clearWebView() {
    val done = CountDownLatch(1)
    val clear = Runnable {
      runCatching {
        WebStorage.getInstance().deleteAllData()
        CookieManager.getInstance().removeAllCookies(null)
      }
      done.countDown()
    }
    if (Looper.myLooper() == Looper.getMainLooper()) clear.run() else Handler(Looper.getMainLooper()).post(clear)
    done.await(WEBVIEW_SECONDS, TimeUnit.SECONDS)
  }

  private const val KEYSTORE = "AndroidKeyStore"
  private const val WEBVIEW_SECONDS = 2L
}
