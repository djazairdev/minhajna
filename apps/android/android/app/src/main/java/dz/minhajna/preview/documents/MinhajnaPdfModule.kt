// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.documents

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintManager
import android.print.WebViewPdf
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.UiThreadUtil
import dz.minhajna.preview.storage.NativeMinhajnaPdfSpec
import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException

/**
 * Makes, prints and saves a document's PDF on the device (PRD §5.13, §6.4):
 * the app's own HTML is laid out by the phone's web engine, offscreen, with
 * every load refused except the app's bundled fonts. The page carries no
 * script, and its policy refuses any; the module only asks the engine,
 * once the page has loaded, whether its fonts have arrived, and waits for
 * them, so a short page never prints with its text still hidden. A PDF
 * is written to the app's cache; only a file name crosses the bridge, never
 * a path. Printing goes through Android's print service and saving through
 * the system's file picker, so the app asks for no storage permission. A
 * PDF holds pupils' data unencrypted, so a saved, cancelled or refused one
 * is deleted from the cache, and the app empties the cache at every start.
 * The print set's counting pass is laid out the same way, its colours read
 * at a few points on each page, and the file deleted at once.
 */
class MinhajnaPdfModule(private val context: ReactApplicationContext) :
  NativeMinhajnaPdfSpec(context), ActivityEventListener {
  private val folder: File get() = File(context.cacheDir, "pdf").apply { mkdirs() }
  private var printing: WebView? = null
  private var saving: Pair<File, Promise>? = null
  private val main = Handler(Looper.getMainLooper())
  @Volatile private var invalidated = false

  init {
    context.addActivityEventListener(this)
  }

  override fun makePdf(html: String, name: String, landscape: Boolean, promise: Promise) {
    if (!NAME_PATTERN.matches(name)) return promise.reject("E_PDF_NAME", "A PDF name has lowercase letters, digits and hyphens")
    val file = File(folder, "$name.pdf")
    val start = SystemClock.elapsedRealtime()
    write(html, name, landscape, file) { error ->
      if (error != null) {
        file.delete()
        promise.reject("E_PDF", "The PDF could not be made", error)
      }
      else promise.resolve(Arguments.createMap().apply {
        putString("name", name)
        putInt("pages", PdfPages.count(file))
        putDouble("bytes", file.length().toDouble())
        putDouble("milliseconds", (SystemClock.elapsedRealtime() - start).toDouble())
      })
    }
  }

  /** Lays the pages out as a PDF, reads the colours at the points on each page, away from the screen, and deletes it. */
  override fun pageColors(html: String, landscape: Boolean, points: ReadableArray, promise: Promise) {
    val at = DoubleArray(points.size()) { points.getDouble(it) }
    if (at.size % 2 != 0) return promise.reject("E_PDF", "A point is an x and a y")
    val file = File(folder, "colors-${SystemClock.elapsedRealtimeNanos()}.pdf")
    write(html, "colors", landscape, file) { error ->
      if (error != null) {
        file.delete()
        return@write promise.reject("E_PDF", "The pages could not be laid out", error)
      }
      Thread {
        try {
          promise.resolve(Arguments.createArray().apply { PdfPages.colors(file, at).forEach(::pushDouble) })
        } catch (error: Exception) {
          promise.reject("E_PDF", "The pages could not be read", error)
        } finally {
          file.delete()
        }
      }.start()
    }
  }

  /** Lays the HTML out offscreen and writes it to `file` as A4 pages, then says whether it failed. */
  private fun write(html: String, name: String, landscape: Boolean, file: File, done: (Throwable?) -> Unit) {
    layOut(html) { page ->
      val attributes = PrintAttributes.Builder()
        .setMediaSize(size(landscape))
        .setResolution(PrintAttributes.Resolution("pdf", "pdf", 300, 300))
        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
        .build()
      WebViewPdf(attributes).write(page.createPrintDocumentAdapter(name), file) { error ->
        page.destroy()
        done(error)
      }
    }
  }

  /** Hands the pages to Android's print service, whose own screen picks the printer, or saves a PDF. */
  override fun printHtml(html: String, title: String, landscape: Boolean, promise: Promise) {
    val activity = context.currentActivity ?: return promise.reject("E_PDF", "No screen to print from")
    layOut(html) { page ->
      printing?.destroy()
      printing = page
      try {
        val manager = activity.getSystemService(Context.PRINT_SERVICE) as PrintManager
        val attributes = PrintAttributes.Builder().setMediaSize(size(landscape)).build()
        manager.print(title, released(page, page.createPrintDocumentAdapter(title)), attributes)
        promise.resolve(null)
      } catch (error: RuntimeException) {
        page.destroy()
        if (printing === page) printing = null
        promise.reject("E_PDF", "The print screen did not open", error)
      }
    }
  }

  /** The web engine's adapter, which lets the page go once the print job is done, so its names leave memory. */
  private fun released(page: WebView, adapter: PrintDocumentAdapter) = ReleasingAdapter(adapter) {
    if (printing === page) printing = null
    page.destroy()
  }

  /** Asks where to keep a made PDF, through the system's file picker, and copies it there; false when cancelled. */
  override fun savePdf(name: String, fileName: String, promise: Promise) {
    val file = File(folder, "$name.pdf")
    if (!NAME_PATTERN.matches(name) || !file.isFile) return promise.reject("E_PDF_NAME", "No such PDF")
    val activity = context.currentActivity
    if (activity == null) {
      file.delete()
      return promise.reject("E_PDF", "No screen to save from")
    }
    UiThreadUtil.runOnUiThread {
      val waiting = saving
      if (waiting != null) {
        if (waiting.first != file) file.delete()
        return@runOnUiThread promise.reject("E_PDF_BUSY", "A save is already waiting for its place")
      }
      saving = file to promise
      val pick = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = "application/pdf"
        putExtra(Intent.EXTRA_TITLE, fileName)
      }
      try {
        activity.startActivityForResult(pick, SAVE_REQUEST)
      } catch (error: RuntimeException) {
        saving = null
        file.delete()
        promise.reject("E_PDF", "No file picker on this phone", error)
      }
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != SAVE_REQUEST) return
    val (file, promise) = saving ?: return
    saving = null
    val target = data?.data
    if (resultCode != Activity.RESULT_OK || target == null) {
      file.delete()
      return promise.resolve(false)
    }
    Thread {
      try {
        val output = context.contentResolver.openOutputStream(target, "wt") ?: throw IOException("The place cannot be written")
        output.use { out -> file.inputStream().use { it.copyTo(out) } }
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("E_PDF", "The PDF could not be saved", error)
      } finally {
        file.delete()
      }
    }.start()
  }

  override fun onNewIntent(intent: Intent) = Unit

  override fun sharePdf(name: String, title: String, promise: Promise) {
    val file = File(folder, "$name.pdf")
    if (!NAME_PATTERN.matches(name) || !file.isFile) return promise.reject("E_PDF_NAME", "No such PDF")
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.documents", file)
    val send = Intent(Intent.ACTION_SEND).apply {
      type = "application/pdf"
      putExtra(Intent.EXTRA_STREAM, uri)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    val chooser = Intent.createChooser(send, title).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(chooser)
    promise.resolve(null)
  }

  override fun invalidate() {
    context.removeActivityEventListener(this)
    saving?.second?.resolve(false)
    saving = null
    invalidated = true
    UiThreadUtil.runOnUiThread {
      main.removeCallbacksAndMessages(null)
      printing?.destroy()
      printing = null
    }
    super.invalidate()
  }

  /** Lays out the HTML in an offscreen web engine that loads nothing but the bundled fonts, then hands it on. */
  private fun layOut(html: String, then: (WebView) -> Unit) {
    UiThreadUtil.runOnUiThread {
      val view = WebView(context.currentActivity ?: context)
      view.settings.apply {
        javaScriptEnabled = false
        blockNetworkLoads = true
        allowFileAccess = false
        allowContentAccess = false
      }
      view.webViewClient = object : WebViewClient() {
        private var finished = false

        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
          if (allowed(request)) null else refused()

        override fun onPageFinished(page: WebView, url: String?) {
          if (finished) return
          finished = true
          page.settings.javaScriptEnabled = true
          whenFontsLoaded(page, SystemClock.elapsedRealtime()) { then(page) }
        }
      }
      view.loadDataWithBaseURL(FONTS, html, "text/html", "utf-8", null)
    }
  }

  /**
   * Calls `then` once the page's fonts have loaded, asking again every 50 ms, or after `FONT_WAIT` ms at most.
   * The scripts are switched on only once the page has loaded, so none of its own could run even without its
   * policy; after a reload of the app's JavaScript, the page is let go and nothing is printed.
   */
  private fun whenFontsLoaded(page: WebView, started: Long, then: () -> Unit) {
    if (invalidated) return page.destroy()
    page.evaluateJavascript(FONTS_LOADED) { loaded ->
      val waited = SystemClock.elapsedRealtime() - started
      when {
        invalidated -> page.destroy()
        loaded == "true" -> then()
        waited > FONT_WAIT -> {
          Log.d(TAG, "Printing after $waited ms with a font still loading")
          then()
        }
        else -> main.postDelayed({ whenFontsLoaded(page, started, then) }, 50)
      }
    }
  }

  private fun size(landscape: Boolean) =
    if (landscape) PrintAttributes.MediaSize.ISO_A4.asLandscape() else PrintAttributes.MediaSize.ISO_A4

  /** The page itself, handed over as data, and the bundled fonts: nothing else loads. */
  private fun allowed(request: WebResourceRequest): Boolean {
    val url = request.url.toString()
    return (request.isForMainFrame && url.startsWith("data:")) || url.startsWith(FONTS)
  }

  private fun refused() = WebResourceResponse("text/plain", "utf-8", 403, "Refused", emptyMap(), ByteArrayInputStream(ByteArray(0)))

  companion object {
    /** Empties the PDF cache, called as the app starts, so no PDF outlives a process killed mid-save. */
    fun clearCache(context: Context) {
      File(context.cacheDir, "pdf").listFiles()?.forEach { it.delete() }
    }

    private const val FONTS = "file:///android_res/font/"
    /** Lays the page out, which asks for the fonts it uses, then says whether none is still on its way. */
    private const val FONTS_LOADED = "document.body.offsetHeight >= 0 && document.fonts.status === 'loaded'"
    private const val FONT_WAIT = 5_000L
    private const val TAG = "MinhajnaPdf"
    private const val SAVE_REQUEST = 4_210
    private val NAME_PATTERN = Regex("^[a-z0-9-]{1,64}$")
  }
}
