// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.crash

import android.content.Context
import android.os.Build
import dz.minhajna.preview.BuildConfig
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

/**
 * Crash reports, off by default (#249, Crash-preview, R-1.5-07, answer 483).
 * While the teacher's switch in Help is on, a crash that stops the app keeps
 * only the error's type, where it happened in the code, the last screens
 * opened by name, the version and Android's version: never the error's
 * message, which may hold data. The report is one file in the app's own
 * folder, outside the history, until the next start shows it and the teacher
 * sends it or not. While the switch is off nothing is kept, and turning it
 * off deletes a kept report. A crash JavaScript already kept is not kept
 * again by its native exception. Erasing the phone's data takes the file and
 * the switch with the rest; Android's backup takes neither.
 */
object CrashKeep {
  /** How many places in the code a report names, innermost first. */
  const val FRAMES_KEPT = 10

  /** How many screens a report names, as the problem report does. */
  const val STEPS_KEPT = 10

  private const val PREFERENCES = "minhajna-crash"
  private const val ON = "on"
  private const val FILE = "crash-report.json"

  @Volatile private var steps: List<String> = emptyList()

  @Volatile private var kept = false

  /** Keeps an uncaught exception's type and frames, if the switch is on, before the crash goes on as it would. */
  fun install(context: Context) {
    val app = context.applicationContext
    val before = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
      if (!kept) runCatching { keep(app, error.javaClass.name, error.stackTrace.map(::frame)) }
      before?.uncaughtException(thread, error)
    }
  }

  /** Whether the teacher turned crash reports on; off until they do. */
  fun isOn(context: Context): Boolean = preferences(context).getBoolean(ON, false)

  /** Turns crash reports on or off, written to the disk before returning; off also deletes a kept report. */
  fun setOn(context: Context, on: Boolean) {
    check(preferences(context).edit().putBoolean(ON, on).commit()) { "The crash reports switch did not save" }
    if (!on) drop(context)
  }

  /** The screens opened since the app started, by route name, kept in memory only. */
  fun setSteps(names: List<String>) {
    steps = names.takeLast(STEPS_KEPT)
  }

  /** Keeps a report of this crash, if the switch is on; true when one was kept. */
  fun keep(context: Context, type: String, frames: List<String>): Boolean {
    if (!isOn(context)) return false
    val report = JSONObject()
      .put("type", type)
      .put("frames", JSONArray(frames.take(FRAMES_KEPT)))
      .put("steps", JSONArray(steps))
      .put("version", BuildConfig.VERSION_NAME)
      .put("android", Build.VERSION.RELEASE ?: "")
    file(context).writeText(report.toString())
    kept = true
    return true
  }

  /** The kept report as JSON, or null when there is none or it cannot be read. */
  fun read(context: Context): String? =
    runCatching { file(context).takeIf { it.isFile }?.readText() }.getOrNull()

  /** Deletes the kept report, sent or not. */
  fun drop(context: Context) {
    file(context).delete()
  }

  /** A place in the code: its class, method and line, with no value from it. */
  private fun frame(element: StackTraceElement) = "${element.className}.${element.methodName}:${element.lineNumber}"

  private fun preferences(context: Context) = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

  private fun file(context: Context) = File(context.filesDir, FILE)
}
