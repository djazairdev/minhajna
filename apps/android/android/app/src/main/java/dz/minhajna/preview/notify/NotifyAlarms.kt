// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.notify

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri

/**
 * One alarm for each notification planned (#234, answers 406 and 407), set
 * with `setAndAllowWhileIdle`: it may come up to an hour late, never early,
 * and needs no exact-alarm permission. Each alarm's intent names its
 * notification by a URI of its own, so no two alarms replace each other.
 * The app's plan and the receiver change the kept list one at a time.
 */
internal object NotifyAlarms {
  const val ACTION = "dz.minhajna.preview.notify.SHOW"
  const val EXTRA_ID = "id"

  /** Cancels the alarms of the notifications planned before, then keeps and sets these, past ones aside. */
  @Synchronized
  fun replace(context: Context, planned: List<Planned>) {
    PlannedStore.read(context).forEach { cancel(context, it) }
    val now = System.currentTimeMillis()
    val kept = planned.filter { it.at > now }.distinctBy { it.id }
    PlannedStore.write(context, kept)
    kept.forEach { set(context, it) }
  }

  /** Sets again the alarms still to come, as after a restart, and forgets those past. */
  @Synchronized
  fun rearm(context: Context) {
    val now = System.currentTimeMillis()
    val kept = PlannedStore.read(context).filter { it.at > now }
    PlannedStore.write(context, kept)
    kept.forEach { set(context, it) }
  }

  /** Takes a notification out of those planned, once shown. */
  @Synchronized
  fun shown(context: Context, id: String): Planned? {
    val all = PlannedStore.read(context)
    val found = all.firstOrNull { it.id == id } ?: return null
    PlannedStore.write(context, all.filter { it.id != id })
    return found
  }

  private fun set(context: Context, planned: Planned) {
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, planned.at, pending(context, planned.id))
  }

  private fun cancel(context: Context, planned: Planned) {
    context.getSystemService(AlarmManager::class.java)?.cancel(pending(context, planned.id))
  }

  private fun pending(context: Context, id: String): PendingIntent {
    val intent = Intent(context, NotifyReceiver::class.java)
      .setAction(ACTION)
      .setData(Uri.parse("minhajna-notify:$id"))
      .putExtra(EXTRA_ID, id)
    return PendingIntent.getBroadcast(
      context,
      0,
      intent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
  }
}
