// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.documents

import android.webkit.WebView
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Checks that a lost web engine renderer is reported once and leaves the app running, and that a new page lays out after it. */
@RunWith(AndroidJUnit4::class)
class OffscreenLayoutTest {
  private val instrumentation = InstrumentationRegistry.getInstrumentation()
  private val layout = OffscreenLayout { instrumentation.targetContext }

  @Test
  fun aKilledRendererFailsThePageOnceAndTheNextPageStillLaysOut() {
    val failures = mutableListOf<Throwable>()
    val failed = CountDownLatch(1)
    val page = handedOn { error ->
      failures += error
      failed.countDown()
    }
    instrumentation.runOnMainSync { page.loadUrl("chrome://kill") }
    assertTrue("The lost renderer was not reported", failed.await(30, TimeUnit.SECONDS))
    instrumentation.waitForIdleSync()
    assertEquals(1, failures.size)
    assertNotNull(handedOn { throw AssertionError("A fresh page lost its renderer", it) })
  }

  private fun handedOn(failed: (Throwable) -> Unit): WebView {
    val page = AtomicReference<WebView>()
    val ready = CountDownLatch(1)
    layout.layOut("<!doctype html><p>منهاجنا</p>", failed) {
      page.set(it)
      ready.countDown()
    }
    assertTrue("The page was not laid out", ready.await(30, TimeUnit.SECONDS))
    return page.get()
  }
}
