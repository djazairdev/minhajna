// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The waits after wrong PINs on a real Android (#210), with a clock the test
 * moves: through the lock, so that a wait holds whatever PIN is tried. Each
 * test uses its own folder and Keystore aliases, never the app's.
 */
@RunWith(AndroidJUnit4::class)
class LockAttemptsTest {

  private val context = InstrumentationRegistry.getInstrumentation().targetContext
  private val random = SecureRandom()
  private val alias = "minhajna.test.${random.nextLong()}"
  private val biometricAlias = "$alias.biometric"
  private val clock = object : LockClock {
    var wall = 1_800_000_000_000L
    var elapsed = 60_000L
    var boot = 3
    override fun wall() = wall
    override fun elapsed() = elapsed
    override fun boot() = boot

    fun pass(millis: Long) {
      wall += millis
      elapsed += millis
    }
  }
  private lateinit var folder: File

  @Before
  fun setUp() {
    folder = File(context.noBackupFilesDir, "lock-${random.nextLong()}").apply { mkdirs() }
  }

  @After
  fun tearDown() {
    folder.setWritable(true)
    folder.deleteRecursively()
    KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.run {
      if (containsAlias(alias)) deleteEntry(alias)
      if (containsAlias(biometricAlias)) deleteEntry(biometricAlias)
    }
  }

  private fun lock(iterations: Int = 1_000) = HistoryLock(folder, clock, alias, biometricAlias, iterations)

  @Test
  fun wrongPinsBringWaitsThatTheRightPinCannotSkip() {
    lock().create("1234", random, false)
    for (i in 1..4) assertEquals(0, (lock().unlock("0000") as HistoryLock.Unlock.Wrong).waitSeconds)
    assertEquals(30, (lock().unlock("0000") as HistoryLock.Unlock.Wrong).waitSeconds)
    val waiting = lock().unlock("1234")
    assertTrue(waiting is HistoryLock.Unlock.Waiting)
    assertEquals(30, (waiting as HistoryLock.Unlock.Waiting).waitSeconds)
    clock.pass(29_500)
    assertEquals(1, lock().attempts.waitSeconds())
    clock.pass(500)
    assertEquals(60, (lock().unlock("0000") as HistoryLock.Unlock.Wrong).waitSeconds)
    clock.pass(60_000)
    assertTrue(lock().unlock("1234") is HistoryLock.Unlock.Opened)
    for (i in 1..4) assertEquals(0, (lock().unlock("0000") as HistoryLock.Unlock.Wrong).waitSeconds)
  }

  @Test
  fun movingTheClockSkipsNoWait() {
    lock().create("1234", random, false)
    repeat(5) { lock().unlock("0000") }
    clock.wall += 86_400_000
    assertEquals(30, lock().attempts.waitSeconds())
    clock.wall -= 2 * 86_400_000
    assertEquals(30, lock().attempts.waitSeconds())
    clock.elapsed += 30_000
    assertEquals(0, lock().attempts.waitSeconds())
  }

  @Test
  fun afterARestartTheWaitGoesOnByTheWallClock() {
    lock().create("1234", random, false)
    repeat(5) { lock().unlock("0000") }
    clock.pass(30_000)
    assertEquals(60, (lock().unlock("0000") as HistoryLock.Unlock.Wrong).waitSeconds)
    clock.boot += 1
    clock.elapsed = 5_000
    clock.wall += 20_000
    assertEquals(40, lock().attempts.waitSeconds())
    clock.wall += 1_000_000
    assertEquals(40, lock().attempts.waitSeconds())
  }

  @Test
  fun aClockMovedBackBeforeARestartRestartsTheWaitButEndsIt() {
    lock().create("1234", random, false)
    repeat(5) { lock().unlock("0000") }
    clock.pass(10_000)
    clock.boot += 1
    clock.elapsed = 5_000
    clock.wall -= 86_400_000
    assertEquals(30, lock().attempts.waitSeconds())
    clock.pass(30_000)
    assertEquals(0, lock().attempts.waitSeconds())
    assertTrue(lock().unlock("1234") is HistoryLock.Unlock.Opened)
  }

  @Test
  fun theWaitDoublesUpToAnHour() {
    assertEquals(listOf(0L, 0L, 0L, 0L, 30L, 60L, 120L, 240L, 480L, 960L, 1920L, 3600L, 3600L), (1..13).map(LockAttempts::waitFor))
    assertEquals(3600, LockAttempts.waitFor(1_000))
  }

  @Test
  fun manyWrongPinsStayAnHourEach() {
    lock().create("1234", random, false)
    repeat(70) {
      lock().unlock("0000")
      clock.pass(3_600_000)
    }
    assertEquals(3600, (lock().unlock("0000") as HistoryLock.Unlock.Wrong).waitSeconds)
    clock.pass(1_800_000)
    assertEquals(1800, lock().attempts.waitSeconds())
  }

  @Test
  fun anUnreadableAttemptsFileMeansTheLongestWait() {
    lock().create("1234", random, false)
    File(folder, HistoryLock.ATTEMPTS).writeText("0,0")
    assertEquals(3600, lock().attempts.waitSeconds())
    assertTrue(lock().unlock("1234") is HistoryLock.Unlock.Waiting)
    clock.pass(3_600_000)
    assertTrue(lock().unlock("1234") is HistoryLock.Unlock.Opened)
    assertFalse(File(folder, HistoryLock.ATTEMPTS).exists())
  }

  /** Android 10 and earlier rewrite the file in place, which a read-only folder does not stop. */
  @Test
  fun aCountThatCannotBeWrittenStopsTheTry() {
    assumeTrue(Build.VERSION.SDK_INT >= 30)
    lock().create("1234", random, false)
    folder.setWritable(false)
    try {
      assertThrows(NoSpaceException::class.java) { lock().unlock("1234") }
    } finally {
      folder.setWritable(true)
    }
    assertFalse(File(folder, HistoryLock.ATTEMPTS).exists())
    assertTrue(lock().unlock("1234") is HistoryLock.Unlock.Opened)
  }

  @Test
  fun withoutTheBootCountARestartIsSeenFromTheTimeSinceBoot() {
    clock.boot = -1
    lock().create("1234", random, false)
    repeat(5) { lock().unlock("0000") }
    clock.wall += 86_400_000
    assertEquals(30, lock().attempts.waitSeconds())
    clock.elapsed = 1_000
    clock.wall -= 86_400_000 - 10_000
    assertEquals(20, lock().attempts.waitSeconds())
    clock.pass(20_000)
    assertEquals(0, lock().attempts.waitSeconds())
  }
}
