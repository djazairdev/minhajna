// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.crash

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import dz.minhajna.preview.storage.NativeMinhajnaCrashSpec

/**
 * Crash reports for the app (#249, answer 483): Help's switch, the screens
 * opened, a JavaScript crash kept before the app stops, and the kept report
 * read on the next start and deleted once the teacher has chosen.
 */
class MinhajnaCrashModule(private val context: ReactApplicationContext) : NativeMinhajnaCrashSpec(context) {
  override fun reportsOn(): Boolean = CrashKeep.isOn(context)

  override fun setReports(on: Boolean): Boolean = runCatching { CrashKeep.setOn(context, on) }.isSuccess

  override fun steps(names: ReadableArray) = CrashKeep.setSteps(strings(names))

  override fun keep(type: String, frames: ReadableArray): Boolean = CrashKeep.keep(context, type, strings(frames))

  override fun kept(): String? = CrashKeep.read(context)

  override fun drop() = CrashKeep.drop(context)

  private fun strings(array: ReadableArray) = (0 until array.size()).mapNotNull { array.getString(it) }
}
