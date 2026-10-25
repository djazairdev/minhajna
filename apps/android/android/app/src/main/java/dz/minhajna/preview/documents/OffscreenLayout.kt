// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.documents

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import com.facebook.react.bridge.UiThreadUtil
import java.io.ByteArrayInputStream
import java.util.concurrent.TimeoutException

/**
 * Lays the app's HTML out in an offscreen web engine that loads nothing but
 * the bundled fonts, waits for the fonts, and hands the page on (PRD §5.13).
 * The page carries no script, and its policy refuses any; scripts are
 * switched on only once the page has loaded, to ask whether its fonts have
 * arrived. The engine's renderer runs in a process of its own, which
 * Android may kill or which may crash: then the page is destroyed, the app
 * lives on, and `failed` is told, once, whenever in the page's life it
 * happens. A page not handed on within `LOAD_WAIT` ms is let go the same
 * way. After a reload of the app's JavaScript, a page is let go untold.
 * The engine would enlarge the text by the phone's text size; a page is
 * sized in points and millimetres, so its text zoom stays at 100%.
 */
internal class OffscreenLayout(private val screen: () -> Context) {
  private val main = Handler(Looper.getMainLooper())
  @Volatile private var invalidated = false

  /** Lays out the HTML, then calls `then` on the main thread with the page, or `failed` if its renderer is lost. */
  fun layOut(html: String, failed: (Throwable) -> Unit, then: (WebView) -> Unit) {
    UiThreadUtil.runOnUiThread {
      val view = WebView(screen())
      view.settings.apply {
        javaScriptEnabled = false
        blockNetworkLoads = true
        allowFileAccess = false
        allowContentAccess = false
        textZoom = 100
      }
      Loading(view, failed, then).start(html)
    }
  }

  /** Lets every page still loading go, unprinted, once the app's JavaScript has reloaded. */
  fun invalidate() {
    invalidated = true
  }

  private inner class Loading(
    private val view: WebView,
    private val failed: (Throwable) -> Unit,
    private val then: (WebView) -> Unit,
  ) : WebViewClient() {
    private var finished = false
    private var lost = false
    private val late = Runnable { lose(TimeoutException("The page was not laid out in $LOAD_WAIT ms")) }

    fun start(html: String) {
      view.webViewClient = this
      main.postDelayed(late, LOAD_WAIT)
      view.loadDataWithBaseURL(FONTS, html, "text/html", "utf-8", null)
    }

    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
      if (allowed(request)) null else refused()

    override fun onPageFinished(page: WebView, url: String?) {
      if (finished || lost) return
      finished = true
      page.settings.javaScriptEnabled = true
      whenFontsLoaded(SystemClock.elapsedRealtime())
    }

    /** The renderer was killed or crashed: the page is lost, and true keeps the app from being killed with it. */
    override fun onRenderProcessGone(page: WebView, detail: RenderProcessGoneDetail): Boolean {
      Log.w(TAG, if (detail.didCrash()) "The web engine's renderer crashed" else "The web engine's renderer was killed")
      lose(IllegalStateException("The web engine's renderer is gone"))
      return true
    }

    /**
     * Calls `then` once the page's fonts have loaded, asking again every 50 ms, or after `FONT_WAIT` ms at most;
     * after a reload of the app's JavaScript, the page is let go and nothing is printed.
     */
    private fun whenFontsLoaded(started: Long) {
      if (lost) return
      if (invalidated) return lose(null)
      view.evaluateJavascript(FONTS_LOADED) { loaded ->
        val waited = SystemClock.elapsedRealtime() - started
        when {
          lost -> Unit
          invalidated -> lose(null)
          loaded == "true" -> handOn()
          waited > FONT_WAIT -> {
            Log.d(TAG, "Printing after $waited ms with a font still loading")
            handOn()
          }
          else -> main.postDelayed({ whenFontsLoaded(started) }, 50)
        }
      }
    }

    private fun handOn() {
      main.removeCallbacks(late)
      then(view)
    }

    /** Destroys the page, at most once, and tells `failed` why unless the app's JavaScript has reloaded. */
    private fun lose(error: Throwable?) {
      if (lost) return
      lost = true
      main.removeCallbacks(late)
      view.destroy()
      if (error != null && !invalidated) failed(error)
    }
  }

  private companion object {
    const val FONTS = "file:///android_res/font/"
    /** Lays the page out, which asks for the fonts it uses, then says whether none is still on its way. */
    const val FONTS_LOADED = "document.body.offsetHeight >= 0 && document.fonts.status === 'loaded'"
    const val FONT_WAIT = 5_000L
    const val LOAD_WAIT = 60_000L
    const val TAG = "MinhajnaPdf"

    /** The page itself, handed over as data, and the bundled fonts: nothing else loads. */
    fun allowed(request: WebResourceRequest): Boolean {
      val url = request.url.toString()
      return (request.isForMainFrame && url.startsWith("data:")) || url.startsWith(FONTS)
    }

    fun refused() = WebResourceResponse("text/plain", "utf-8", 403, "Refused", emptyMap(), ByteArrayInputStream(ByteArray(0)))
  }
}
