// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.calendar

import android.app.Activity
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.CancellationSignal
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import dz.minhajna.preview.storage.NativeMinhajnaCalendarInputSpec
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicReference

/**
 * User-initiated local reads only; one picker/scanner at a time, with explicit cancellation and bounded provider reads.
 * The one write is a small file the teacher chose to share, handed to the share sheet.
 */
class MinhajnaCalendarInputModule(private val context: ReactApplicationContext) :
  NativeMinhajnaCalendarInputSpec(context), ActivityEventListener {
  private data class Waiting(val activity: Activity, val request: Int, val promise: Promise, val statement: Boolean)
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

  /** A progress statement's signed file or PDF, for reader mode (#246); a PDF gives only its statement link. */
  override fun readStatement(promise: Promise) { open(FILE_REQUEST, Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
    addCategory(Intent.CATEGORY_OPENABLE)
    type = "*/*"
    putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "application/pdf"))
    putExtra(Intent.EXTRA_LOCAL_ONLY, true)
    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false)
  }, promise, statement = true) }

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

  override fun qrRows(text: String): String = QrRows.of(text)

  private fun open(request: Int, intent: Intent, promise: Promise, statement: Boolean = false) =
    UiThreadUtil.runOnUiThread {
      val activity = context.currentActivity
      if (waiting != null) return@runOnUiThread promise.reject("E_CALENDAR_BUSY", "An input is already open")
      if (activity == null) return@runOnUiThread promise.reject("E_CALENDAR_INPUT", "No screen to read from")
      waiting = Waiting(activity, request, promise, statement)
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
          val limit = if (next.statement) StatementFile.MAX_BYTES else NoticeInput.FILE_BYTES
          require(descriptor != null && descriptor.declaredLength <= limit && generation == readGeneration)
          val input = descriptor.createInputStream()
          stream.set(input)
          try {
            input.use {
              require(generation == readGeneration)
              if (next.statement) StatementFile.read(it) else NoticeInput.read(it, NoticeInput.FILE_BYTES)
            }
          } finally {
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

  /**
   * Hands a text file the app wrote, such as a school layer or an offered list, to the app the teacher picks in the
   * share sheet, at most as large as a file the app reads.
   * Only the last shared file stays in the app's cache, and only for the share sheet's read grant.
   */
  override fun shareText(name: String, text: String, title: String, promise: Promise) {
    val bytes = text.toByteArray(Charsets.UTF_8)
    if (!SHARE_NAME.matches(name) || bytes.size > NoticeInput.FILE_BYTES || title.length > 500)
      return promise.reject("E_CALENDAR_SHARE", "The file could not be shared")
    val folder = File(context.cacheDir, "share")
    val file = File(folder, name)
    try {
      folder.mkdirs()
      folder.listFiles()?.forEach { it.delete() }
      file.writeBytes(bytes)
    } catch (error: IOException) {
      return promise.reject("E_CALENDAR_SHARE", "The file could not be written", error)
    }
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.documents", file)
    val send = Intent(Intent.ACTION_SEND).apply {
      type = "application/json"
      putExtra(Intent.EXTRA_STREAM, uri)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    try {
      context.startActivity(Intent.createChooser(send, title).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      promise.resolve(null)
    } catch (error: RuntimeException) {
      promise.reject("E_CALENDAR_SHARE", "No app to share with", error)
    }
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
    private val SHARE_NAME = Regex("^[a-z0-9-]{1,64}\\.json$")
  }
}
