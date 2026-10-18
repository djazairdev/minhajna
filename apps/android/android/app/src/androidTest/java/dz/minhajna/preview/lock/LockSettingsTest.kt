// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.lock

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.security.SecureRandom
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The lock's settings on a real Android (#210): the defaults, the three
 * delays and nothing else, and the screen guard's rule. Each test keeps its
 * own preferences file, never the app's.
 */
@RunWith(AndroidJUnit4::class)
class LockSettingsTest {

  private val context = InstrumentationRegistry.getInstrumentation().targetContext
  private val file = "minhajna.test.lock.${SecureRandom().nextLong()}"

  @After
  fun removeFile() {
    context.deleteSharedPreferences(file)
  }

  @Test
  fun startsAtFiveMinutesWithNoScreenshots() {
    val settings = LockSettings(context, file)
    assertEquals(5, settings.delay)
    assertFalse(settings.screenshots)
  }

  @Test
  fun keepsEachDelayAndTheScreenshotChoiceAcrossReads() {
    for (minutes in listOf(1, 15, 5)) {
      LockSettings(context, file).setDelay(minutes)
      assertEquals(minutes, LockSettings(context, file).delay)
    }
    LockSettings(context, file).setScreenshots(true)
    assertTrue(LockSettings(context, file).screenshots)
    LockSettings(context, file).setScreenshots(false)
    assertFalse(LockSettings(context, file).screenshots)
  }

  @Test
  fun refusesAnyOtherDelayAndReadsAStrangeOneAsTheDefault() {
    val settings = LockSettings(context, file)
    for (minutes in listOf(0, 2, 30, -5)) {
      assertThrows(IllegalArgumentException::class.java) { settings.setDelay(minutes) }
    }
    context.getSharedPreferences(file, Context.MODE_PRIVATE).edit().putInt("delayMinutes", 60).commit()
    assertEquals(5, LockSettings(context, file).delay)
  }

  @Test
  fun recordsAreSecureUnlessScreenshotsAreAllowedAndPinPadsAlways() {
    for (allowed in listOf(false, true)) {
      assertFalse(ScreenGuard.isSecure(ScreenGuard.OPEN, allowed))
      assertTrue(ScreenGuard.isSecure(ScreenGuard.PIN, allowed))
      assertTrue(ScreenGuard.isSecure("a later kind", allowed))
    }
    assertTrue(ScreenGuard.isSecure(ScreenGuard.RECORDS, screenshotsAllowed = false))
    assertFalse(ScreenGuard.isSecure(ScreenGuard.RECORDS, screenshotsAllowed = true))
  }
}
