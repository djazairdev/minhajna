// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.notify

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import dz.minhajna.preview.MainActivity
import dz.minhajna.preview.R

/**
 * Shows a planned notification when its alarm goes off (#234, answer 406),
 * with the words the app gave beforehand: nothing is worked out here. When
 * the phone hides sensitive content on the lock screen, only its title
 * shows there. A tap opens the app on the screen it names, once unlocked.
 * Nothing shows when notifications are off.
 */
class NotifyReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != NotifyAlarms.ACTION) return
    val id = intent.getStringExtra(NotifyAlarms.EXTRA_ID) ?: return
    val planned = NotifyAlarms.shown(context, id) ?: return
    val manager = NotificationManagerCompat.from(context)
    if (!manager.areNotificationsEnabled()) return
    manager.createNotificationChannel(
      NotificationChannelCompat.Builder(planned.channel, NotificationManagerCompat.IMPORTANCE_DEFAULT)
        .setName(planned.channelName)
        .build(),
    )
    val open = Intent(context, MainActivity::class.java)
      .setData(Uri.parse("minhajna-open:$id"))
      .putExtra(EXTRA_OPEN, planned.open)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val tap = PendingIntent.getActivity(
      context,
      0,
      open,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val public = NotificationCompat.Builder(context, planned.channel)
      .setSmallIcon(R.drawable.minhajna_mim)
      .setContentTitle(planned.title)
      .build()
    val notification = NotificationCompat.Builder(context, planned.channel)
      .setSmallIcon(R.drawable.minhajna_mim)
      .setContentTitle(planned.title)
      .setContentText(planned.text)
      .setStyle(NotificationCompat.BigTextStyle().bigText(planned.text))
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setPublicVersion(public)
      .setContentIntent(tap)
      .setAutoCancel(true)
      .build()
    try {
      manager.notify(id, 0, notification)
    } catch (e: SecurityException) {
      return
    }
  }

  companion object {
    /** The extra naming the screen a tap opens. */
    const val EXTRA_OPEN = "dz.minhajna.preview.notify.OPEN"
  }
}
