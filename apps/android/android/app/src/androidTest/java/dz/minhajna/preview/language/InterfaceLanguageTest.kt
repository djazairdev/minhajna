// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.language

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.facebook.react.modules.i18nmanager.I18nUtil
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The interface language on a real Android: what is kept, and the direction
 * React Native computes from it as it starts. Each test starts with nothing
 * kept and leaves the app's direction as a first launch has it.
 */
@RunWith(AndroidJUnit4::class)
class InterfaceLanguageTest {

  private val context = InstrumentationRegistry.getInstrumentation().targetContext

  @Before
  fun setUp() = forget()

  @After
  fun tearDown() {
    forget()
    InterfaceLanguage.applyDirection(context)
  }

  private fun forget() {
    context.deleteSharedPreferences("dz.minhajna.preview.interface")
  }

  @Test
  fun opensRightToLeftBeforeAnyChoice() {
    assertNull(InterfaceLanguage.language(context))
    InterfaceLanguage.applyDirection(context)
    assertTrue(I18nUtil.instance.isRTL(context))
  }

  @Test
  fun keepsALeftToRightLanguageAndItsDirection() {
    InterfaceLanguage.set(context, "fr")
    assertEquals("fr", InterfaceLanguage.language(context))
    assertFalse(I18nUtil.instance.isRTL(context))
  }

  @Test
  fun goesBackToRightToLeftForArabic() {
    InterfaceLanguage.set(context, "en")
    InterfaceLanguage.set(context, "ar")
    assertEquals("ar", InterfaceLanguage.language(context))
    assertTrue(I18nUtil.instance.isRTL(context))
  }

  @Test
  fun opensRightToLeftForALanguageItDoesNotOffer() {
    context.getSharedPreferences("dz.minhajna.preview.interface", 0).edit()
      .putString("language", "de").putBoolean("rightToLeft", false).commit()
    InterfaceLanguage.applyDirection(context)
    assertTrue(I18nUtil.instance.isRTL(context))
  }

  @Test
  fun refusesSomethingThatIsNotALanguageCode() {
    assertThrows(IllegalArgumentException::class.java) { InterfaceLanguage.set(context, "fr; DROP") }
    assertNull(InterfaceLanguage.language(context))
  }
}
