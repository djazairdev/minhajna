// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.notify

import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import dz.minhajna.preview.storage.NativeMinhajnaNotifySpec

/**
 * The app's notifications set ahead (#234, answer 406): the next days'
 * notifications replace those planned before, Android's notification
 * switch is read as it is, and a tapped notification's screen is given
 * once to the app, which is told when a tap reaches it while open. An
 * intent replayed from Recents asks for nothing.
 */
class MinhajnaNotifyModule(private val context: ReactApplicationContext) : NativeMinhajnaNotifySpec(context) {
  private val taps = object : BaseActivityEventListener() {
    override fun onNewIntent(intent: Intent) {
      if (intent.hasExtra(NotifyReceiver.EXTRA_OPEN)) context.emitDeviceEvent(OPENED, null)
    }
  }

  init {
    context.addActivityEventListener(taps)
  }

  override fun plan(items: ReadableArray) {
    val planned = (0 until items.size()).mapNotNull { index ->
      val item = items.getMap(index) ?: return@mapNotNull null
      Planned(
        id = item.getString("id") ?: return@mapNotNull null,
        at = item.getDouble("at").toLong(),
        channel = item.getString("channel") ?: return@mapNotNull null,
        channelName = item.getString("channelName") ?: return@mapNotNull null,
        title = item.getString("title") ?: return@mapNotNull null,
        text = item.getString("text") ?: return@mapNotNull null,
        open = item.getString("open") ?: return@mapNotNull null,
      )
    }
    NotifyAlarms.replace(context, planned)
  }

  override fun enabled(): Boolean = NotificationManagerCompat.from(context).areNotificationsEnabled()

  override fun openSettings() {
    val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
      .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }

  override fun takeOpened(): String? {
    val intent = context.currentActivity?.intent ?: return null
    if (intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY != 0) return null
    val open = intent.getStringExtra(NotifyReceiver.EXTRA_OPEN) ?: return null
    intent.removeExtra(NotifyReceiver.EXTRA_OPEN)
    return open
  }

  override fun invalidate() {
    context.removeActivityEventListener(taps)
    super.invalidate()
  }

  companion object {
    /** The event that tells the app a tapped notification reached it while open. */
    const val OPENED = "minhajnaNotifyOpened"
  }
}
