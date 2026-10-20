// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.calendar

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.ImageFormat
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.os.SystemClock
import android.view.Surface
import android.view.TextureView

/** One foreground camera session; every pause closes the device, surfaces, frames and worker. No image is stored. */
class CalendarCamera(
  private val context: Context, private val preview: TextureView,
  private val found: (String) -> Unit, private val failed: () -> Unit,
) : TextureView.SurfaceTextureListener {
  private var worker: HandlerThread? = null
  private var handler: Handler? = null
  private var camera: CameraDevice? = null
  private var session: CameraCaptureSession? = null
  private var images: ImageReader? = null
  private var surface: Surface? = null
  @Volatile private var generation = 0
  private var lastFrame = 0L
  private val main = Handler(Looper.getMainLooper())

  fun start() {
    if (worker != null) return
    worker = HandlerThread("calendar-qr").also { it.start() }
    handler = Handler(worker!!.looper)
    preview.surfaceTextureListener = this
    if (preview.isAvailable) preview.surfaceTexture?.let(::open)
  }

  @SuppressLint("MissingPermission")
  private fun open(texture: SurfaceTexture) {
    val token = ++generation
    val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    try {
      val id = manager.cameraIdList.firstOrNull {
        manager.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
      } ?: return failed()
      val map = manager.getCameraCharacteristics(id).get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
      val size = map?.getOutputSizes(ImageFormat.YUV_420_888)
        ?.filter { it.width * it.height <= 1280 * 720 }
        ?.minByOrNull { kotlin.math.abs(it.width * it.height - 640 * 480) } ?: return failed()
      texture.setDefaultBufferSize(size.width, size.height)
      val visible = Surface(texture).also { surface = it }
      val reader = ImageReader.newInstance(size.width, size.height, ImageFormat.YUV_420_888, 2).also { images = it }
      reader.setOnImageAvailableListener({ source ->
        val image = try { source.acquireLatestImage() } catch (_: IllegalStateException) { null } ?: return@setOnImageAvailableListener
        image.use {
          if (token != generation || SystemClock.elapsedRealtime() - lastFrame < 250) return@use
          lastFrame = SystemClock.elapsedRealtime()
          val text = runCatching { QrFrames.read(it) }.getOrNull()
          if (text != null) main.post { if (token == generation) found(text) }
        }
      }, handler)
      manager.openCamera(id, object : CameraDevice.StateCallback() {
        override fun onOpened(device: CameraDevice) {
          if (token != generation) { device.close(); return }
          camera = device
          configure(device, listOf(visible, reader.surface), token)
        }
        override fun onDisconnected(device: CameraDevice) { device.close(); if (token == generation) failed() }
        override fun onError(device: CameraDevice, error: Int) { device.close(); if (token == generation) failed() }
      }, main)
    } catch (_: Exception) { if (token == generation) failed() }
  }

  private fun configure(device: CameraDevice, targets: List<Surface>, token: Int) {
    try {
      device.createCaptureSession(targets, object : CameraCaptureSession.StateCallback() {
        override fun onConfigured(next: CameraCaptureSession) {
          if (token != generation) { next.close(); return }
          session = next
          try {
            val request = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
              targets.forEach(::addTarget)
              set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
            }
            next.setRepeatingRequest(request.build(), null, handler)
          } catch (_: Exception) { if (token == generation) failed() }
        }
        override fun onConfigureFailed(next: CameraCaptureSession) {
          next.close()
          if (token == generation) failed()
        }
      }, main)
    } catch (_: Exception) { if (token == generation) failed() }
  }

  fun stop() {
    generation += 1
    preview.surfaceTextureListener = null
    session?.close(); session = null
    camera?.close(); camera = null
    images?.close(); images = null
    surface?.release(); surface = null
    worker?.quitSafely(); worker = null
    handler = null
  }

  override fun onSurfaceTextureAvailable(texture: SurfaceTexture, width: Int, height: Int) = open(texture)
  override fun onSurfaceTextureSizeChanged(texture: SurfaceTexture, width: Int, height: Int) = Unit
  override fun onSurfaceTextureUpdated(texture: SurfaceTexture) = Unit
  override fun onSurfaceTextureDestroyed(texture: SurfaceTexture): Boolean { stop(); return true }
}
