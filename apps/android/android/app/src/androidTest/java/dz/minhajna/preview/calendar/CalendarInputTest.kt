// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.calendar

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import android.content.pm.PackageManager
import android.content.pm.FeatureInfo
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import java.io.ByteArrayInputStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertFalse
import org.junit.Test
import org.junit.runner.RunWith

/** Synthetic byte streams and generated QR matrices only, never a camera frame or a real school's notice. */
@RunWith(AndroidJUnit4::class)
class CalendarInputTest {
  @Test
  fun readsStrictUtf8AndAcceptsTheExactByteLimit() {
    val text = """{"name":"غلق تجريبي"}"""
    assertEquals(text, NoticeInput.read(ByteArrayInputStream(text.toByteArray())))
    val exact = "x".repeat(NoticeInput.MAX_BYTES)
    assertEquals(exact, NoticeInput.read(ByteArrayInputStream(exact.toByteArray())))
  }

  @Test
  fun refusesOversizedAndMalformedInput() {
    assertThrows(IllegalArgumentException::class.java) {
      NoticeInput.read(ByteArrayInputStream(ByteArray(NoticeInput.MAX_BYTES + 1)))
    }
    assertThrows(java.nio.charset.CharacterCodingException::class.java) {
      NoticeInput.read(ByteArrayInputStream(byteArrayOf(0xc3.toByte(), 0x28)))
    }
  }

  @Test
  fun decodesArabicQrLocallyInEitherContrast() {
    val text = """{"format":"minhajna.calendar-entry","sender":"مؤسسة تجريبية"}"""
    val matrix = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 320, 320,
      mapOf(EncodeHintType.CHARACTER_SET to "UTF-8"))
    val bytes = ByteArray(matrix.width * matrix.height) {
      if (matrix[it % matrix.width, it / matrix.width]) 0 else 0xff.toByte()
    }
    assertEquals(text, QrFrames.decode(bytes, matrix.width, matrix.height))
    val inverted = ByteArray(bytes.size) { (255 - (bytes[it].toInt() and 255)).toByte() }
    assertEquals(text, QrFrames.decode(inverted, matrix.width, matrix.height))
    bytes.fill(0); inverted.fill(0)
  }

  @Test
  fun scanActivityIsInternalAndCameraIsOptional() {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val info = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_ACTIVITIES)
    val scan = requireNotNull(info.activities).single { it.name == CalendarScanActivity::class.java.name }
    assertFalse(scan.exported)
    val features = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_CONFIGURATIONS)
    val camera = requireNotNull(features.reqFeatures).single { it.name == PackageManager.FEATURE_CAMERA }
    assertEquals(0, camera.flags and FeatureInfo.FLAG_REQUIRED)
  }

  @Test
  fun decodesACompleteRotatedOfflineNotice() {
    val text = """{"format":"minhajna.calendar-entry","version":{"major":1,"minor":0},"country":"dz","year":"2026-2027",
      |"sender":"مؤسسة تجريبية","school":{"name":"متوسطة تجريبية","zone":"16"},"entry":{"id":"example-closure",
      |"layer":"school","effect":"closure","from":"2026-10-15","to":"2026-10-15","source":"Synthetic notice",
      |"name":{"ar":"غلق تجريبي"},"confidence":"announced"}}""".trimMargin().replace("\n", "")
    val matrix = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 640, 640,
      mapOf(EncodeHintType.CHARACTER_SET to "UTF-8"))
    val rotated = ByteArray(matrix.width * matrix.height) {
      if (matrix[it / matrix.width, matrix.height - 1 - it % matrix.width]) 0 else 0xff.toByte()
    }
    assertEquals(text, QrFrames.decode(rotated, matrix.width, matrix.height))
    rotated.fill(0)
  }

  @Test
  fun blankPixelsAreNotAReadOrARequestToOpenAUrl() {
    assertNull(QrFrames.decode(ByteArray(100 * 100) { 0xff.toByte() }, 100, 100))
  }
}
