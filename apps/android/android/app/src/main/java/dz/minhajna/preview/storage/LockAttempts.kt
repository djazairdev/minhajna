// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import android.content.Context
import android.os.SystemClock
import android.provider.Settings
import android.util.AtomicFile
import java.io.File

/** The times a wait is measured with: the wall clock, the time since boot, and which boot it is. */
interface LockClock {
  fun wall(): Long
  fun elapsed(): Long
  fun boot(): Int
}

/** The phone's clocks. The boot count is Android's own, readable without a permission. */
class SystemLockClock(private val context: Context) : LockClock {
  override fun wall() = System.currentTimeMillis()
  override fun elapsed() = SystemClock.elapsedRealtime()
  override fun boot() = Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, -1)
}

/**
 * Wrong PINs, counted across restarts (#210). The first four cost nothing;
 * from the fifth, each one doubles the wait, from 30 seconds up to an hour.
 * Nobody, the project included, can lift the wait or the lock.
 *
 * Within one boot the wait runs on the time since boot, which no setting
 * changes, so moving the clock skips nothing. After a restart only the wall
 * clock is left: the wait goes on from it, and once more in full if the
 * clock went back before the last wrong PIN, so it always ends. Moving the
 * clock forward and restarting the phone can end a wait early, at the cost
 * of a restart for each try. The file
 * holds the failures in a row, the wall time of the last one and of the
 * wait's end, the boot, and the wait's end in time since that boot.
 */
class LockAttempts(private val file: File, private val clock: LockClock) {

  private data class Record(val failures: Int, val last: Long, val until: Long, val boot: Int, val elapsedUntil: Long)

  private var unsaved: Record? = null

  /** Seconds before the next PIN may be tried, rounded up; 0 when one may be tried now. */
  fun waitSeconds(): Long {
    val record = current() ?: return 0
    return (maxOf(0, record.elapsedUntil - clock.elapsed()) + 999) / 1000
  }

  /** Counts a wrong PIN and returns the wait it brings. */
  fun fail(): Long {
    val failures = minOf((current()?.failures ?: 0) + 1, MAX_COUNTED)
    val wait = waitFor(failures)
    val wall = clock.wall()
    write(Record(failures, wall, wall + wait * 1000, clock.boot(), clock.elapsed() + wait * 1000))
    return wait
  }

  fun succeed() {
    unsaved = null
    AtomicFile(file).delete()
  }

  /**
   * The record, carried over to this boot if it comes from another one, so
   * that the rest of its wait runs on this boot's time; null when there is
   * none. An unreadable record counts as the longest wait, from now. A
   * record the disk refused is kept in memory for this boot instead.
   */
  private fun current(): Record? {
    unsaved?.let { if (sameBoot(it)) return it }
    val text = Sealing.readAtomically(file)?.toString(Charsets.US_ASCII) ?: return null
    val record = parse(text) ?: return fresh(MAX_COUNTED, MAX_WAIT_SECONDS * 1000).also(::carry)
    if (sameBoot(record)) return record
    val wall = clock.wall()
    val left = if (wall < record.last) record.until - record.last else maxOf(0, record.until - wall)
    return fresh(record.failures, minOf(left, waitFor(record.failures) * 1000)).also(::carry)
  }

  /** Without Android's boot count, a time since boot earlier than the last wrong PIN's means a restart. */
  private fun sameBoot(record: Record): Boolean {
    val boot = clock.boot()
    if (boot != UNKNOWN_BOOT) return record.boot == boot
    return record.boot == UNKNOWN_BOOT && clock.elapsed() >= record.elapsedUntil - (record.until - record.last)
  }

  /** Keeps a carried-over record, in memory if the disk refuses it, so that its wait still runs down. */
  private fun carry(record: Record) {
    try {
      write(record)
    } catch (_: Exception) {
      unsaved = record
    }
  }

  private fun fresh(failures: Int, left: Long): Record {
    val wall = clock.wall()
    return Record(failures, wall, wall + left, clock.boot(), clock.elapsed() + left)
  }

  private fun parse(text: String): Record? {
    val parts = text.split(',').map { it.trim().toLongOrNull() }
    if (parts.size != 5 || parts.any { it == null }) return null
    val (failures, last, until, boot, elapsedUntil) = parts.map { it!! }
    if (failures !in 1..MAX_COUNTED || until < last || boot !in UNKNOWN_BOOT.toLong()..Int.MAX_VALUE.toLong()) return null
    return Record(failures.toInt(), last, until, boot.toInt(), elapsedUntil)
  }

  private fun write(record: Record) {
    with(record) { Sealing.writeAtomically(file, "$failures,$last,$until,$boot,$elapsedUntil".toByteArray(Charsets.US_ASCII)) }
    unsaved = null
  }

  companion object {
    const val FREE_FAILURES = 4
    const val FIRST_WAIT_SECONDS = 30L
    const val MAX_WAIT_SECONDS = 3600L
    private const val MAX_COUNTED = 64
    private const val UNKNOWN_BOOT = -1

    fun waitFor(failures: Int): Long {
      if (failures <= FREE_FAILURES) return 0
      val doublings = minOf(failures - FREE_FAILURES - 1, 7)
      return minOf(FIRST_WAIT_SECONDS shl doublings, MAX_WAIT_SECONDS)
    }
  }
}
