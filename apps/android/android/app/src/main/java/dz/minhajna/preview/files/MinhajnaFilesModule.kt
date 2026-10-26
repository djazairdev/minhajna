// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.files

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.UiThreadUtil
import dz.minhajna.preview.storage.NativeMinhajnaFilesSpec
import java.io.File
import java.io.IOException
import java.io.OutputStream
import java.security.SecureRandom
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * The files the teacher keeps or sends from the term export (#242, answer
 * 466): text written as UTF-8, or a made PDF, each under the name the
 * teacher will see, in a folder of the app's cache named by a random token,
 * which is all that crosses the bridge. With a password, the file goes in an
 * AES-256 ZIP instead (R-5.9-15). Several texts go in one ZIP, a plain one
 * without a password, as the full export does (#248). Saving goes through
 * the system's file picker and sending through Android's share screen, never
 * a link (R-5.9-17), so the app asks for no storage permission. A saved or
 * cancelled file is deleted, a shared one stays until the app's next start,
 * which empties the folder. Reading back a file the teacher picks gives its
 * text (PickedFiles); a file over 2 MB is refused, and so is a file that is
 * not text. An archive picked for a restore (#247) is kept under a token of
 * its own, until it is dropped, and its one file read with a password. Both
 * pickers show local files only, on the phone, an SD card or a USB key, never
 * a cloud provider's (#477, answer 495).
 */
class MinhajnaFilesModule(private val context: ReactApplicationContext) :
  NativeMinhajnaFilesSpec(context), ActivityEventListener {
  private val folder: File get() = File(context.cacheDir, FOLDER).apply { mkdirs() }
  private var saving: Pair<File, Promise>? = null
  private var opening: Pair<Promise, Boolean>? = null

  init {
    context.addActivityEventListener(this)
  }

  override fun makeText(text: String, fileName: String, password: String, promise: Promise) {
    made(fileName, password, promise) { text.toByteArray(Charsets.UTF_8) }
  }

  override fun adoptPdf(pdf: String, fileName: String, password: String, promise: Promise) {
    val source = File(File(context.cacheDir, "pdf"), "$pdf.pdf")
    if (!PDF_PATTERN.matches(pdf) || !source.isFile) return promise.reject("E_FILE", "No such PDF")
    made(fileName, password, promise) { source.readBytes().also { source.delete() } }
  }

  override fun makeZip(
    names: ReadableArray,
    texts: ReadableArray,
    fileName: String,
    password: String,
    promise: Promise,
  ) {
    if (names.size() != texts.size()) return promise.reject("E_FILE_NAME", "Each file needs a name")
    val files = (0 until names.size()).map { names.getString(it).orEmpty() to texts.getString(it).orEmpty() }
    val allowed = files.isNotEmpty() && files.map { it.first }.toSet().size == files.size
    if (!allowed || files.any { !fileNameAllowed(it.first) } || !fileNameAllowed("$fileName.zip")) {
      return promise.reject("E_FILE_NAME", "Each file needs a name of its own, with no folder in it")
    }
    placed(promise) { place ->
      val bytes = files.map { (name, text) -> name to text.toByteArray(Charsets.UTF_8) }
      File(place, "$fileName.zip").outputStream().use {
        if (password.isEmpty()) plainZip(it, bytes) else AesZip.writeAll(it, bytes, password)
      }
    }
  }

  /** Writes the bytes under the file's name in a fresh token's folder, zipped when a password is given. */
  private fun made(fileName: String, password: String, promise: Promise, bytes: () -> ByteArray) {
    if (!fileNameAllowed(fileName)) return promise.reject("E_FILE_NAME", "A file name has no folder in it")
    placed(promise) { place ->
      val content = bytes()
      if (password.isEmpty()) File(place, fileName).writeBytes(content)
      else File(place, "$fileName.zip").outputStream().use { AesZip.write(it, fileName, content, password) }
    }
  }

  /** Makes a file in a fresh token's folder, off the main thread, and gives the token, or nothing if it fails. */
  private fun placed(promise: Promise, make: (File) -> Unit) {
    Thread {
      val place = File(folder, newToken()).apply { mkdirs() }
      try {
        make(place)
        promise.resolve(place.name)
      } catch (error: Exception) {
        place.deleteRecursively()
        promise.reject("E_FILE", "The file could not be made", error)
      }
    }.start()
  }

  /** A fresh token: 8 random bytes in hex, a folder's name. */
  private fun newToken(): String =
    ByteArray(8).also { SecureRandom().nextBytes(it) }.joinToString("") { "%02x".format(it) }

  /** The one file a token's folder holds. */
  private fun fileOf(token: String): File? =
    if (TOKEN_PATTERN.matches(token)) File(folder, token).listFiles()?.singleOrNull { it.isFile } else null

  override fun saveFile(token: String, promise: Promise) {
    val file = fileOf(token) ?: return promise.reject("E_FILE", "No such file")
    val activity = context.currentActivity ?: return promise.reject("E_FILE", "No screen to save from")
    UiThreadUtil.runOnUiThread {
      if (saving != null || opening != null) return@runOnUiThread promise.reject("E_FILE_BUSY", "A picker is open")
      saving = file to promise
      val pick = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = mimeOf(file)
        putExtra(Intent.EXTRA_TITLE, file.name)
      }
      try {
        activity.startActivityForResult(pick, SAVE_REQUEST)
      } catch (error: RuntimeException) {
        saving = null
        file.parentFile?.deleteRecursively()
        promise.reject("E_FILE", "No file picker on this phone", error)
      }
    }
  }

  override fun shareFile(token: String, title: String, promise: Promise) {
    val file = fileOf(token) ?: return promise.reject("E_FILE", "No such file")
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.documents", file)
    val send = Intent(Intent.ACTION_SEND).apply {
      type = mimeOf(file)
      putExtra(Intent.EXTRA_STREAM, uri)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(send, title).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    promise.resolve(null)
  }

  override fun openText(promise: Promise) = open(promise, false)

  override fun openZip(promise: Promise) = open(promise, true)

  override fun readZip(token: String, entry: String, password: String, sealed: Boolean, promise: Promise) {
    val place = fileOf(token)?.parentFile ?: return promise.reject("E_FILE", "No such file")
    Thread {
      try {
        promise.resolve(PickedFiles.archiveText(place, entry, password, sealed))
      } catch (error: Throwable) {
        refuse(promise, error)
      }
    }.start()
  }

  override fun dropFile(token: String) {
    if (TOKEN_PATTERN.matches(token)) File(folder, token).deleteRecursively()
  }

  /** Asks for a local file through the system's file picker: a text file, or any file for an archive. */
  private fun open(promise: Promise, zip: Boolean) {
    val activity = context.currentActivity ?: return promise.reject("E_FILE", "No screen to open from")
    UiThreadUtil.runOnUiThread {
      if (saving != null || opening != null) return@runOnUiThread promise.reject("E_FILE_BUSY", "A picker is open")
      opening = promise to zip
      val pick = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = "*/*"
        putExtra(Intent.EXTRA_LOCAL_ONLY, true)
        if (!zip) putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("text/*", "application/csv", "application/vnd.ms-excel"))
      }
      try {
        activity.startActivityForResult(pick, OPEN_REQUEST)
      } catch (error: RuntimeException) {
        opening = null
        promise.reject("E_FILE", "No file picker on this phone", error)
      }
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    val target = data?.data.takeIf { resultCode == Activity.RESULT_OK }
    when (requestCode) {
      SAVE_REQUEST -> {
        val (file, promise) = saving ?: return
        saving = null
        if (target == null) {
          file.parentFile?.deleteRecursively()
          return promise.resolve(false)
        }
        Thread {
          try {
            val output = context.contentResolver.openOutputStream(target, "wt") ?: throw IOException("Not writable")
            output.use { out -> file.inputStream().use { it.copyTo(out) } }
            promise.resolve(true)
          } catch (error: Exception) {
            promise.reject("E_FILE", "The file could not be saved", error)
          } finally {
            file.parentFile?.deleteRecursively()
          }
        }.start()
      }
      OPEN_REQUEST -> {
        val (promise, zip) = opening ?: return
        opening = null
        if (target == null) return promise.resolve(null)
        Thread { if (zip) kept(target, promise) else text(target, promise) }.start()
      }
    }
  }

  /** The picked file's text, refused over 2 MB or when it is not text. */
  private fun text(target: Uri, promise: Promise) {
    try {
      val input = context.contentResolver.openInputStream(target) ?: throw IOException("Not readable")
      val bytes = input.use { PickedFiles.read(it, PickedFiles.TEXT_LIMIT) }
      if (bytes.size > PickedFiles.TEXT_LIMIT) return promise.reject("E_FILE_SIZE", "The file is over 2 MB")
      if (PickedFiles.binary(bytes)) return promise.reject("E_FILE_BINARY", "The file is not text")
      promise.resolve(PickedFiles.textOf(bytes))
    } catch (error: Exception) {
      promise.reject("E_FILE", "The file could not be read", error)
    }
  }

  /** The picked archive, copied under a fresh token, given with the name the picker shows. */
  private fun kept(target: Uri, promise: Promise) {
    val place = File(folder, newToken()).apply { mkdirs() }
    try {
      val name = PickedFiles.keep(context.contentResolver, target, place)
      promise.resolve(Arguments.createMap().apply {
        putString("token", place.name)
        putString("name", name)
      })
    } catch (error: Throwable) {
      place.deleteRecursively()
      refuse(promise, error)
    }
  }

  /** Rejects with the archive's refusal, a lack of memory as its size, or a plain read failure. */
  private fun refuse(promise: Promise, error: Throwable) = when (error) {
    is ZipRead.Refused -> promise.reject("E_ZIP_${error.reason}", "The archive was refused")
    is OutOfMemoryError -> promise.reject("E_ZIP_TOO_LARGE", "The archive is too large for this phone")
    else -> promise.reject("E_FILE", "The file could not be read", error)
  }

  override fun onNewIntent(intent: Intent) = Unit

  override fun invalidate() {
    context.removeActivityEventListener(this)
    UiThreadUtil.runOnUiThread {
      saving?.second?.resolve(false)
      saving = null
      opening?.first?.resolve(null)
      opening = null
    }
    super.invalidate()
  }

  companion object {
    const val NAME = "MinhajnaFiles"
    private const val FOLDER = "files"
    private const val SAVE_REQUEST = 4_242
    private const val OPEN_REQUEST = 4_243
    private val TOKEN_PATTERN = Regex("^[0-9a-f]{16}$")
    private val PDF_PATTERN = Regex("^[a-z0-9-]{1,64}$")

    /** Empties the files' folder, called as the app starts, so no file outlives a process killed mid-save. */
    fun clearCache(context: Context) {
      File(context.cacheDir, FOLDER).deleteRecursively()
    }

    /** A name the teacher sees: no folder, no hidden file, not too long. */
    fun fileNameAllowed(name: String): Boolean = name.isNotBlank() && name.length <= 120 &&
      !name.startsWith(".") && name.none { it == '/' || it == '\\' || it.code < 32 }

    /** The type the share screen and the picker show: a ZIP, a CSV file or a PDF. */
    fun mimeOf(file: File): String = when (file.extension.lowercase()) {
      "zip" -> "application/zip"
      "csv" -> "text/csv"
      "pdf" -> "application/pdf"
      else -> "application/octet-stream"
    }

    /** A plain ZIP of the files, deflated, their names in UTF-8, for a file kept without a password (#248). */
    fun plainZip(out: OutputStream, files: List<Pair<String, ByteArray>>) {
      ZipOutputStream(out).use { zip ->
        for ((name, bytes) in files) {
          zip.putNextEntry(ZipEntry(name))
          zip.write(bytes)
          zip.closeEntry()
        }
      }
    }
  }
}
