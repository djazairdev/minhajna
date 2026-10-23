// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.files

import android.app.Activity
import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import dz.minhajna.preview.storage.NativeMinhajnaFilesSpec
import java.io.File
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.Charset
import java.nio.charset.CodingErrorAction
import java.security.SecureRandom

/**
 * The files the teacher keeps or sends from the term export (#242, answer
 * 466): text written as UTF-8, or a made PDF, each under the name the
 * teacher will see, in a folder of the app's cache named by a random token,
 * which is all that crosses the bridge. With a password, the file goes in an
 * AES-256 ZIP instead (R-5.9-15). Saving goes through the system's file
 * picker and sending through Android's share screen, never a link
 * (R-5.9-17), so the app asks for no storage permission. A saved or
 * cancelled file is deleted, a shared one stays until the app's next start,
 * which empties the folder. Reading back a file the teacher picks gives its
 * text: UTF-16 after its byte-order mark, as Excel saves Unicode text, else
 * UTF-8, or Arabic Windows' code page when it is not, as Excel saves a CSV
 * file; a file over 2 MB is refused, and so is a file that is not text: a
 * ZIP archive, such as one the export made under a password or an .xlsx
 * workbook, an old .xls workbook, or a PDF.
 */
class MinhajnaFilesModule(private val context: ReactApplicationContext) :
  NativeMinhajnaFilesSpec(context), ActivityEventListener {
  private val folder: File get() = File(context.cacheDir, FOLDER).apply { mkdirs() }
  private var saving: Pair<File, Promise>? = null
  private var opening: Promise? = null

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

  /** Writes the bytes under the file's name in a fresh token's folder, zipped when a password is given. */
  private fun made(fileName: String, password: String, promise: Promise, bytes: () -> ByteArray) {
    if (!fileNameAllowed(fileName)) return promise.reject("E_FILE_NAME", "A file name has no folder in it")
    Thread {
      val token = ByteArray(8).also { SecureRandom().nextBytes(it) }.joinToString("") { "%02x".format(it) }
      val place = File(folder, token).apply { mkdirs() }
      try {
        val content = bytes()
        if (password.isEmpty()) File(place, fileName).writeBytes(content)
        else File(place, "$fileName.zip").outputStream().use { AesZip.write(it, fileName, content, password) }
        promise.resolve(token)
      } catch (error: Exception) {
        place.deleteRecursively()
        promise.reject("E_FILE", "The file could not be made", error)
      }
    }.start()
  }

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

  override fun openText(promise: Promise) {
    val activity = context.currentActivity ?: return promise.reject("E_FILE", "No screen to open from")
    UiThreadUtil.runOnUiThread {
      if (saving != null || opening != null) return@runOnUiThread promise.reject("E_FILE_BUSY", "A picker is open")
      opening = promise
      val pick = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = "*/*"
        putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("text/*", "application/csv", "application/vnd.ms-excel"))
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
        val promise = opening ?: return
        opening = null
        if (target == null) return promise.resolve(null)
        Thread {
          try {
            val input = context.contentResolver.openInputStream(target) ?: throw IOException("Not readable")
            val bytes = input.use { read(it) }
            if (bytes.size > LIMIT) return@Thread promise.reject("E_FILE_SIZE", "The file is over 2 MB")
            if (binary(bytes)) return@Thread promise.reject("E_FILE_BINARY", "The file is not text")
            promise.resolve(textOf(bytes))
          } catch (error: Exception) {
            promise.reject("E_FILE", "The file could not be read", error)
          }
        }.start()
      }
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  override fun invalidate() {
    context.removeActivityEventListener(this)
    UiThreadUtil.runOnUiThread {
      saving?.second?.resolve(false)
      saving = null
      opening?.resolve(null)
      opening = null
    }
    super.invalidate()
  }

  companion object {
    const val NAME = "MinhajnaFiles"
    private const val FOLDER = "files"
    private const val SAVE_REQUEST = 4_242
    private const val OPEN_REQUEST = 4_243
    private const val LIMIT = 2 * 1024 * 1024
    private val TOKEN_PATTERN = Regex("^[0-9a-f]{16}$")
    private val PDF_PATTERN = Regex("^[a-z0-9-]{1,64}$")
    private val BINARY_STARTS = listOf(
      intArrayOf(0x50, 0x4B, 0x03, 0x04),
      intArrayOf(0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1),
      intArrayOf(0x25, 0x50, 0x44, 0x46, 0x2D),
    )

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

    /** At most one byte over the limit, so a larger file is known to be one. */
    private fun read(input: java.io.InputStream): ByteArray {
      val out = java.io.ByteArrayOutputStream()
      val buffer = ByteArray(8192)
      while (out.size() <= LIMIT) {
        val count = input.read(buffer, 0, minOf(buffer.size, LIMIT + 1 - out.size()))
        if (count < 0) break
        out.write(buffer, 0, count)
      }
      return out.toByteArray()
    }

    /** Whether the bytes begin as a ZIP archive, an old Office file or a PDF does. */
    fun binary(bytes: ByteArray): Boolean = BINARY_STARTS.any { start ->
      bytes.size >= start.size && start.indices.all { bytes[it] == start[it].toByte() }
    }

    /** The bytes as text: UTF-16 after its mark, UTF-8 when they are, else Arabic Windows' code page. */
    fun textOf(bytes: ByteArray): String = if (bytes.size >= 2 && unicode(bytes[0], bytes[1])) {
      String(bytes, 2, bytes.size - 2, if (bytes[0] == 0xFF.toByte()) Charsets.UTF_16LE else Charsets.UTF_16BE)
    } else try {
      Charsets.UTF_8.newDecoder()
        .onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT)
        .decode(ByteBuffer.wrap(bytes))
        .toString()
    } catch (error: CharacterCodingException) {
      String(bytes, Charset.forName("windows-1256"))
    }

    private fun unicode(first: Byte, second: Byte): Boolean =
      (first == 0xFF.toByte() && second == 0xFE.toByte()) || (first == 0xFE.toByte() && second == 0xFF.toByte())
  }
}
