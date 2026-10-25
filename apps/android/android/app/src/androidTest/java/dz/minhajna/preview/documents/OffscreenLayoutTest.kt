// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.documents

import android.content.res.Configuration
import android.print.PrintAttributes
import android.print.WebViewPdf
import android.webkit.WebView
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Checks that a lost web engine renderer is reported once and leaves the app running, that a new page lays out
 * after it, and that a page prints at its designed size whatever the phone's text size.
 */
@RunWith(AndroidJUnit4::class)
class OffscreenLayoutTest {
  private val instrumentation = InstrumentationRegistry.getInstrumentation()
  private val context = instrumentation.targetContext
  private val layout = OffscreenLayout { context }

  @Test
  fun aKilledRendererFailsThePageOnceAndTheNextPageStillLaysOut() {
    val failures = mutableListOf<Throwable>()
    val failed = CountDownLatch(1)
    val page = handedOn(layout, NAME) { error ->
      failures += error
      failed.countDown()
    }
    instrumentation.runOnMainSync { page.loadUrl("chrome://kill") }
    assertTrue("The lost renderer was not reported", failed.await(30, TimeUnit.SECONDS))
    instrumentation.waitForIdleSync()
    assertEquals(1, failures.size)
    assertNotNull(handedOn(layout, NAME) { throw AssertionError("A fresh page lost its renderer", it) })
  }

  /** Thirty 18 pt lines, 12 pt text at 1.5, fill under two thirds of an A4 page: drawn twice as large, two pages. */
  @Test
  fun aOnePageDocumentStaysOnOnePageAtTwiceTheTextSize() {
    val large = Configuration(context.resources.configuration).apply { fontScale = 2f }
    val zoomed = OffscreenLayout { context.createConfigurationContext(large) }
    val error = AtomicReference<Throwable?>()
    val written = CountDownLatch(1)
    val page = handedOn(zoomed, THIRTY_LINES) {
      error.set(it)
      written.countDown()
    }
    val file = File(context.cacheDir, "text-zoom.pdf")
    var zoom = 0
    try {
      instrumentation.runOnMainSync {
        zoom = page.settings.textZoom
        WebViewPdf(A4).write(page.createPrintDocumentAdapter("text-zoom"), file) {
          error.set(it)
          written.countDown()
        }
      }
      assertTrue("The PDF was not written", written.await(30, TimeUnit.SECONDS))
      assertNull(error.get())
      assertEquals(1, PdfPages.count(file))
      assertEquals(100, zoom)
    } finally {
      instrumentation.runOnMainSync { page.destroy() }
      file.delete()
    }
  }

  private fun handedOn(layout: OffscreenLayout, html: String, failed: (Throwable) -> Unit): WebView {
    val page = AtomicReference<WebView>()
    val ready = CountDownLatch(1)
    layout.layOut(html, failed) {
      page.set(it)
      ready.countDown()
    }
    assertTrue("The page was not laid out", ready.await(30, TimeUnit.SECONDS))
    return page.get()
  }

  private companion object {
    const val NAME = "<!doctype html><p>منهاجنا</p>"
    val THIRTY_LINES = "<!doctype html><style>@page { size: A4; margin: 0 } body { margin: 0; font: 12pt/1.5 serif }" +
      " p { margin: 0 }</style>" + "<p>منهاجنا</p>".repeat(30)
    val A4: PrintAttributes = PrintAttributes.Builder()
      .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
      .setResolution(PrintAttributes.Resolution("pdf", "pdf", 300, 300))
      .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
      .build()
  }
}
