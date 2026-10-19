// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.documents

import android.os.Bundle
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter

/**
 * A print job's adapter that hands everything to the web engine's own and,
 * once the job is done, calls `finished`, so the module lets the page go.
 */
internal class ReleasingAdapter(
  private val adapter: PrintDocumentAdapter,
  private val finished: () -> Unit,
) : PrintDocumentAdapter() {
  override fun onStart() = adapter.onStart()

  override fun onLayout(
    old: PrintAttributes?,
    new: PrintAttributes,
    cancel: CancellationSignal?,
    callback: LayoutResultCallback,
    extras: Bundle?,
  ) = adapter.onLayout(old, new, cancel, callback, extras)

  override fun onWrite(
    pages: Array<out PageRange>,
    destination: ParcelFileDescriptor,
    cancel: CancellationSignal?,
    callback: WriteResultCallback,
  ) = adapter.onWrite(pages, destination, cancel, callback)

  override fun onFinish() {
    adapter.onFinish()
    finished()
  }
}
