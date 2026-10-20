// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.calendar

import android.app.Activity
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.CancellationSignal
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import dz.minhajna.preview.storage.NativeMinhajnaCalendarInputSpec
import java.io.InputStream
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicReference

/** User-initiated local reads only; one picker/scanner at a time, with explicit cancellation and bounded provider reads. */
class MinhajnaCalendarInputModule(private val context: ReactApplicationContext) :
  NativeMinhajnaCalendarInputSpec(context), ActivityEventListener {
  private data class Waiting(val activity: Activity, val request: Int, val promise: Promise)
  private var waiting: Waiting? = null
  private val main = Handler(Looper.getMainLooper())
  private val reader = Executors.newSingleThreadExecutor()
  private val stream = AtomicReference<InputStream?>()
  private val cancellation = AtomicReference<CancellationSignal?>()
  @Volatile private var readGeneration = 0
  private var deadline: Runnable? = null

  init { context.addActivityEventListener(this) }

  override fun readFile(promise: Promise) { open(FILE_REQUEST, Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
    addCategory(Intent.CATEGORY_OPENABLE)
    type = "application/json"
    putExtra(Intent.EXTRA_LOCAL_ONLY, true)
    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false)
  }, promise) }

  override fun scanQr(title: String, instruction: String, cancel: String, rtl: Boolean, promise: Promise) {
    if (listOf(title, instruction, cancel).any { it.length > 500 }) {
      promise.reject("E_CALENDAR_INPUT", "The scanner could not open")
      return
    }
    open(SCAN_REQUEST, Intent(context, CalendarScanActivity::class.java).apply {
      putExtra("title", title); putExtra("instruction", instruction); putExtra("cancel", cancel)
      putExtra("rtl", rtl)
    }, promise)
  }

  private fun open(request: Int, intent: Intent, promise: Promise) = UiThreadUtil.runOnUiThread {
    val activity = context.currentActivity
    if (waiting != null) return@runOnUiThread promise.reject("E_CALENDAR_BUSY", "An input is already open")
    if (activity == null) return@runOnUiThread promise.reject("E_CALENDAR_INPUT", "No screen to read from")
    waiting = Waiting(activity, request, promise)
    try { activity.startActivityForResult(intent, request) }
    catch (_: RuntimeException) { waiting = null; promise.reject("E_CALENDAR_INPUT", "The input could not open") }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    val next = waiting ?: return
    if (requestCode != next.request) return
    if (requestCode == SCAN_REQUEST && resultCode == Activity.RESULT_FIRST_USER) {
      waiting = null
      next.promise.reject("E_CALENDAR_CAMERA", "The camera could not be opened")
      return
    }
    if (resultCode != Activity.RESULT_OK) { waiting = null; next.promise.resolve(null); return }
    if (requestCode == SCAN_REQUEST) {
      waiting = null
      val text = data?.getStringExtra("text")
      if (text == null || text.toByteArray(Charsets.UTF_8).size > NoticeInput.MAX_BYTES)
        next.promise.reject("E_CALENDAR_INPUT", "The QR code could not be read")
      else next.promise.resolve(text)
      return
    }
    val uri = data?.data
    if (uri?.scheme != "content") {
      waiting = null
      next.promise.reject("E_CALENDAR_INPUT", "The selected file could not be read")
      return
    }
    val generation = ++readGeneration
    val signal = CancellationSignal().also(cancellation::set)
    val timeout = Runnable {
      if (generation == readGeneration && waiting === next) {
        readGeneration += 1
        waiting = null
        closeInput()
        next.promise.reject("E_CALENDAR_INPUT", "The selected file could not be read")
      }
    }
    deadline = timeout
    main.postDelayed(timeout, 10_000)
    reader.execute {
      val result = runCatching {
        context.contentResolver.openAssetFileDescriptor(uri, "r", signal).use { descriptor ->
          require(descriptor != null && descriptor.declaredLength <= NoticeInput.MAX_BYTES && generation == readGeneration)
          val input = descriptor.createInputStream()
          stream.set(input)
          try { input.use { require(generation == readGeneration); NoticeInput.read(it) } } finally {
            stream.compareAndSet(input, null)
            cancellation.compareAndSet(signal, null)
          }
        }
      }
      main.post {
        if (generation != readGeneration || waiting !== next) return@post
        main.removeCallbacks(timeout)
        deadline = null
        waiting = null
        cancellation.compareAndSet(signal, null)
        result.fold(next.promise::resolve) { next.promise.reject("E_CALENDAR_INPUT", "The selected file could not be read") }
      }
    }
  }

  override fun cancel() { UiThreadUtil.runOnUiThread {
    readGeneration += 1
    deadline?.let(main::removeCallbacks)
    deadline = null
    val next = waiting
    waiting = null
    next?.activity?.finishActivity(next.request)
    next?.promise?.resolve(null)
    closeInput()
  } }

  private fun closeInput() {
    val signal = cancellation.getAndSet(null)
    val input = stream.getAndSet(null)
    Thread { runCatching { signal?.cancel() }; runCatching { input?.close() } }.start()
  }

  override fun onNewIntent(intent: Intent) = Unit

  override fun invalidate() {
    cancel()
    context.removeActivityEventListener(this)
    reader.shutdownNow()
    super.invalidate()
  }

  companion object {
    private const val FILE_REQUEST = 8431
    private const val SCAN_REQUEST = 8432
  }
}
