// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.calendar

import android.media.Image
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.ReaderException
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader

/** QR decoding only. Camera pixels are held briefly in memory, cleared, never written or handed to another app. */
object QrFrames {
  fun read(image: Image): String? {
    val width = image.width
    val height = image.height
    if (width <= 0 || height <= 0 || width * height > 1280 * 720) return null
    val plane = image.planes[0]
    val buffer = plane.buffer
    val bytes = ByteArray(width * height)
    try {
      for (row in 0 until height) for (column in 0 until width)
        bytes[row * width + column] = buffer.get(row * plane.rowStride + column * plane.pixelStride)
      return decode(bytes, width, height)
    } finally {
      bytes.fill(0)
    }
  }

  fun decode(bytes: ByteArray, width: Int, height: Int): String? {
    val source = PlanarYUVLuminanceSource(bytes, width, height, 0, 0, width, height, false)
    val hints = mapOf(DecodeHintType.CHARACTER_SET to "UTF-8", DecodeHintType.TRY_HARDER to true)
    for (luma in listOf(source, source.invert())) {
      val text = try { QRCodeReader().decode(BinaryBitmap(HybridBinarizer(luma)), hints).text }
      catch (_: ReaderException) { null }
      if (text != null && text.toByteArray(Charsets.UTF_8).size <= NoticeInput.MAX_BYTES) return text
    }
    return null
  }
}
