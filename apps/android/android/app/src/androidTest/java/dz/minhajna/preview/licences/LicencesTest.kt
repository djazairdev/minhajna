// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.licences

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.security.MessageDigest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Checks the installed assets, including the complete AGPL copied at build time. */
@RunWith(AndroidJUnit4::class)
class LicencesTest {
  private val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets

  @Test
  fun discoversEveryBundledNoticeAndPreservesItsText() {
    val notices = bundledNotices(assets)
    assertEquals(assets.list("licenses")!!.sorted(), notices.map { it.name })
    assertTrue(notices.map { it.name }.containsAll(listOf("data.txt", "fonts.txt", "sqlcipher.txt", "minhajna.txt")))
    for (notice in notices) {
      assertEquals(assets.open("licenses/${notice.name}").bufferedReader(Charsets.UTF_8).use { it.readText() }, notice.text)
    }
  }

  @Test
  fun includesTheUnchangedCanonicalAgpl() {
    val bytes = assets.open("licenses/minhajna.txt").use { it.readBytes() }
    val digest = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    assertEquals("0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0", digest)
  }

  @Test
  fun aNewNameNeedsNoCodeChangeAndUnicodeIsUnchanged() {
    val texts = mapOf("new-notice.txt" to "إشعار تجريبي 😀\n\nLicence fictive.", "minhajna.txt" to "Synthetic licence")
    val notices = collectNotices(listOf("new-notice.txt", "minhajna.txt")) { texts.getValue(it) }
    assertEquals(texts.keys.sorted(), notices.map { it.name })
    assertEquals(texts["new-notice.txt"], notices.last().text)
  }

  @Test
  fun missingOrUnreadableLicencesAreNotSilentlyOmitted() {
    assertThrows(IllegalStateException::class.java) { collectNotices(emptyList()) { "" } }
    assertThrows(IllegalStateException::class.java) {
      collectNotices(listOf("minhajna.txt", "new-notice.txt")) { error("Synthetic unreadable asset") }
    }
  }
}
