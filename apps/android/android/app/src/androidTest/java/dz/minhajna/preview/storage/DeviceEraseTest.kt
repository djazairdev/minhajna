// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.facebook.react.modules.i18nmanager.I18nUtil
import dz.minhajna.preview.language.InterfaceLanguage
import dz.minhajna.preview.notify.NotifyAlarms
import dz.minhajna.preview.notify.Planned
import dz.minhajna.preview.notify.PlannedStore
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * «مسح هذا الجهاز» on a real Android (#248, answer 477): a history with its
 * key in the Keystore, a reminder set ahead, files in each of the app's
 * folders, a database, the interface language and another setting; after
 * the erasure the history was closed, the Keystore holds no key of the app,
 * the folders are empty but still there, no reminder is planned, and no
 * setting is kept but React Native's direction, back to the first start's,
 * right to left, and WebView's own settings. It erases the test app's own
 * data, as the app would.
 */
@RunWith(AndroidJUnit4::class)
class DeviceEraseTest {

  private val context = InstrumentationRegistry.getInstrumentation().targetContext
  private val random = SecureRandom()

  @Test
  fun erasesEverythingTheAppKeepsOnThisPhone() {
    val history = HistoryStorage(context.noBackupFilesDir)
    history.open(random)
    history.close()
    NotifyAlarms.replace(context, listOf(planned()))
    File(context.filesDir, "made-up.txt").writeText("made up")
    File(context.cacheDir, "pdf").apply { mkdirs() }.resolve("made-up.pdf").writeText("made up")
    context.openOrCreateDatabase("made-up.db", Context.MODE_PRIVATE, null).close()
    InterfaceLanguage.set(context, "fr")
    context.getSharedPreferences("made-up", Context.MODE_PRIVATE).edit().putString("key", "value").commit()
    assertTrue(keyStore().aliases().toList().isNotEmpty())
    assertEquals(1, PlannedStore.read(context).size)

    var closed = false
    DeviceErase.run(context) { closed = true }
    InstrumentationRegistry.getInstrumentation().waitForIdleSync()

    assertTrue(closed)
    assertEquals(emptyList<String>(), keyStore().aliases().toList())
    for (folder in listOf(context.noBackupFilesDir, context.filesDir, context.cacheDir)) {
      assertTrue(folder.isDirectory)
      assertEquals(emptyList<String>(), folder.list().orEmpty().toList())
    }
    assertEquals(emptyList<String>(), context.databaseList().toList())
    assertEquals(emptyList<Planned>(), PlannedStore.read(context))
    assertNull(InterfaceLanguage.language(context))
    assertNull(context.getSharedPreferences("made-up", Context.MODE_PRIVATE).getString("key", null))
    assertTrue(I18nUtil.instance.isRTL(context))
    val settings = File(context.applicationInfo.dataDir, "shared_prefs").list().orEmpty().toSet()
    val kept = settings.filterNot { it.startsWith("WebView") }.toSet()
    assertEquals(emptySet<String>(), kept - setOf("com.facebook.react.modules.i18nmanager.I18nUtil.xml"))
    assertFalse(HistoryStorage(context.noBackupFilesDir).exists())
  }

  private fun planned() = Planned(
    id = "made-up-${random.nextLong()}",
    at = System.currentTimeMillis() + 86_400_000,
    channel = "made-up",
    channelName = "Made up",
    title = "Made up",
    text = "Made up",
    open = "today",
  )

  private fun keyStore() = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
}
