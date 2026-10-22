// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Android forgets alarms when the phone restarts or the app is updated, so
 * the notifications still planned are set again then (#234, answer 406).
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
      NotifyAlarms.rearm(context)
    }
  }
}
