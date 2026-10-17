// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.documents

import android.content.Intent
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.print.PrintAttributes
import android.print.WebViewPdf
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import dz.minhajna.preview.storage.NativeMinhajnaPdfSpec
import java.io.ByteArrayInputStream
import java.io.File

/**
 * Makes a document's PDF on the device (PRD §5.13, §6.4): the app's own HTML
 * is laid out by the phone's web engine, offscreen, with scripts off and
 * every load refused except the app's bundled fonts, then written to the
 * app's cache. Only a file name crosses the bridge, never a path; sharing
 * goes through Android's chooser, with no storage permission.
 */
class MinhajnaPdfModule(private val context: ReactApplicationContext) : NativeMinhajnaPdfSpec(context) {
  private val folder: File get() = File(context.cacheDir, "pdf").apply { mkdirs() }

  override fun makePdf(html: String, name: String, landscape: Boolean, promise: Promise) {
    if (!NAME_PATTERN.matches(name)) return promise.reject("E_PDF_NAME", "A PDF name has lowercase letters, digits and hyphens")
    val file = File(folder, "$name.pdf")
    val start = SystemClock.elapsedRealtime()
    UiThreadUtil.runOnUiThread {
      val view = WebView(context.currentActivity ?: context)
      view.settings.apply {
        javaScriptEnabled = false
        blockNetworkLoads = true
        allowFileAccess = false
        allowContentAccess = false
      }
      view.webViewClient = object : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
          if (allowed(request)) null else refused()

        override fun onPageFinished(page: WebView, url: String?) {
          val size = if (landscape) PrintAttributes.MediaSize.ISO_A4.asLandscape() else PrintAttributes.MediaSize.ISO_A4
          val attributes = PrintAttributes.Builder()
            .setMediaSize(size)
            .setResolution(PrintAttributes.Resolution("pdf", "pdf", 300, 300))
            .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
            .build()
          WebViewPdf(attributes).write(page.createPrintDocumentAdapter(name), file) { error ->
            page.destroy()
            if (error != null) promise.reject("E_PDF", "The PDF could not be made", error)
            else promise.resolve(Arguments.createMap().apply {
              putString("name", name)
              putInt("pages", pageCount(file))
              putDouble("bytes", file.length().toDouble())
              putDouble("milliseconds", (SystemClock.elapsedRealtime() - start).toDouble())
            })
          }
        }
      }
      view.loadDataWithBaseURL(FONTS, html, "text/html", "utf-8", null)
    }
  }

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

  /** The page itself, handed over as data, and the bundled fonts: nothing else loads. */
  private fun allowed(request: WebResourceRequest): Boolean {
    val url = request.url.toString()
    return (request.isForMainFrame && url.startsWith("data:")) || url.startsWith(FONTS)
  }

  private fun refused() = WebResourceResponse("text/plain", "utf-8", 403, "Refused", emptyMap(), ByteArrayInputStream(ByteArray(0)))

  private fun pageCount(file: File): Int =
    ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { PdfRenderer(it).use { pdf -> pdf.pageCount } }

  private companion object {
    const val FONTS = "file:///android_res/font/"
    val NAME_PATTERN = Regex("^[a-z0-9-]{1,64}$")
  }
}
