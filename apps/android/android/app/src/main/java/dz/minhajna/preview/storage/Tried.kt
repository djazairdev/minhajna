// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

/** A PIN's result for the JavaScript side; an Opened result's key, if any, stays with the caller. */
internal fun tried(result: HistoryLock.Unlock): WritableMap = when (result) {
  is HistoryLock.Unlock.Opened -> tried(true, 0)
  is HistoryLock.Unlock.Wrong -> tried(false, result.waitSeconds)
  is HistoryLock.Unlock.Waiting -> tried(false, result.waitSeconds)
}

internal fun tried(opened: Boolean, waitSeconds: Long): WritableMap = Arguments.createMap().apply {
  putBoolean("opened", opened)
  putDouble("waitSeconds", waitSeconds.toDouble())
}
