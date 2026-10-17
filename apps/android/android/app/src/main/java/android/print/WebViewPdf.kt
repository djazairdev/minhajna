// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package android.print

import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import java.io.File

/**
 * Drives a web engine's print adapter straight into a file, with no print
 * dialog: the device's own engine lays out and shapes the pages (PRD §5.13).
 * It sits in android.print because the adapter's two callbacks can only be
 * made from this package. Callbacks arrive on the thread that called it.
 */
class WebViewPdf(private val attributes: PrintAttributes) {
  fun write(adapter: PrintDocumentAdapter, file: File, done: (Throwable?) -> Unit) {
    val cancel = CancellationSignal()
    adapter.onStart()
    adapter.onLayout(null, attributes, cancel, object : PrintDocumentAdapter.LayoutResultCallback() {
      override fun onLayoutFinished(info: PrintDocumentInfo, changed: Boolean) {
        val output = ParcelFileDescriptor.open(
          file,
          ParcelFileDescriptor.MODE_CREATE or ParcelFileDescriptor.MODE_TRUNCATE or ParcelFileDescriptor.MODE_READ_WRITE,
        )
        adapter.onWrite(arrayOf(PageRange.ALL_PAGES), output, cancel, object : PrintDocumentAdapter.WriteResultCallback() {
          override fun onWriteFinished(pages: Array<PageRange>) = finish(output, null)
          override fun onWriteFailed(error: CharSequence?) = finish(output, IllegalStateException(error?.toString()))
          override fun onWriteCancelled() = finish(output, IllegalStateException("Writing was cancelled"))

          private fun finish(output: ParcelFileDescriptor, error: Throwable?) {
            output.close()
            adapter.onFinish()
            done(error)
          }
        })
      }

      override fun onLayoutFailed(error: CharSequence?) {
        adapter.onFinish()
        done(IllegalStateException(error?.toString()))
      }

      override fun onLayoutCancelled() {
        adapter.onFinish()
        done(IllegalStateException("Layout was cancelled"))
      }
    }, null)
  }
}
