// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.documents

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import java.io.File

/**
 * Reads a PDF the module made: how many pages it has, and the colours at
 * given points on each page, which the print set's counting pass reads to
 * find where each book starts (#215). A page is drawn at 72 dots an inch,
 * a dot a point, on white, once per page, then let go.
 */
internal object PdfPages {
  fun count(file: File): Int = open(file) { it.pageCount }

  /** Each page's colour, as 0xRRGGBB, at each point, an x and a y in millimetres from its top-left corner. */
  fun colors(file: File, points: DoubleArray): DoubleArray = open(file) { pdf ->
    val per = points.size / 2
    val colors = DoubleArray(pdf.pageCount * per)
    for (index in 0 until pdf.pageCount) {
      pdf.openPage(index).use { page ->
        val bitmap = Bitmap.createBitmap(page.width, page.height, Bitmap.Config.ARGB_8888)
        try {
          bitmap.eraseColor(Color.WHITE)
          page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
          for (point in 0 until per) {
            val x = (points[point * 2] * POINTS_PER_MM).toInt().coerceIn(0, page.width - 1)
            val y = (points[point * 2 + 1] * POINTS_PER_MM).toInt().coerceIn(0, page.height - 1)
            colors[index * per + point] = (bitmap.getPixel(x, y) and 0xFFFFFF).toDouble()
          }
        } finally {
          bitmap.recycle()
        }
      }
    }
    colors
  }

  private fun <T> open(file: File, read: (PdfRenderer) -> T): T =
    ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { PdfRenderer(it).use(read) }

  private const val POINTS_PER_MM = 72 / 25.4
}
