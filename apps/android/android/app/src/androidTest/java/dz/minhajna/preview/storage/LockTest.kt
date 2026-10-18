// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import android.os.SystemClock
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The app lock on a real Android (#210): the PIN-sealed key, the 0.1.0 key
 * moved under the PIN, the waits after wrong PINs, and a history that opens
 * only with the key the lock gives. Each test uses its own folder and
 * Keystore aliases, never the app's, and few PBKDF2 rounds, except the one
 * that times the app's count.
 */
@RunWith(AndroidJUnit4::class)
class LockTest {

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
    folder.deleteRecursively()
    KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.run {
      if (containsAlias(alias)) deleteEntry(alias)
      if (containsAlias(biometricAlias)) deleteEntry(biometricAlias)
    }
  }

  private fun lock(iterations: Int = 1_000) = HistoryLock(folder, clock, alias, biometricAlias, iterations)

  private fun opened(result: HistoryLock.Unlock): ByteArray = (result as HistoryLock.Unlock.Opened).key

  private fun row(seq: Long) = EntryRow(
    seq = seq,
    id = "id$seq",
    day = "2026-10-15",
    layer = "private",
    kind = "note",
    digest = "d$seq",
    previous = if (seq == 0L) "" else "h${seq - 1}",
    hash = "h$seq",
    salt = "s$seq",
    body = """{"text":"note $seq"}""",
  )

  @Test
  fun aFirstPinMakesAKeyThatOnlyThatPinOpens() {
    val key = lock().create("2580", random, databaseExists = false)
    assertEquals(32, key.size)
    assertTrue(lock().isSet())
    assertFalse(File(folder, HistoryStorage.KEY).exists())
    assertArrayEquals(key, opened(lock().unlock("2580")))
    val wrong = lock().unlock("2581")
    assertTrue(wrong is HistoryLock.Unlock.Wrong)
    assertEquals(0, (wrong as HistoryLock.Unlock.Wrong).waitSeconds)
    assertTrue(lock().unlock("258") is HistoryLock.Unlock.Wrong)
    assertTrue(lock().unlock("25800") is HistoryLock.Unlock.Wrong)
  }

  @Test
  fun aPinIsFourDigitsAndIsSetOnce() {
    assertThrows(IllegalArgumentException::class.java) { lock().create("12a4", random, false) }
    assertThrows(IllegalArgumentException::class.java) { lock().create("\u0661\u0662\u0663\u0664", random, false) }
    assertFalse(lock().isSet())
    lock().create("1234", random, false)
    assertThrows(IllegalStateException::class.java) { lock().create("4321", random, false) }
  }

  @Test
  fun aZeroOneHistoryKeepsItsKeyUnderTheNewPin() {
    val legacy = DatabaseKey(File(folder, HistoryStorage.KEY), alias)
    val before = legacy.getOrCreate(random)
    val key = lock().create("0000", random, databaseExists = true)
    assertArrayEquals(before, key)
    assertFalse(legacy.exists())
    assertArrayEquals(before, opened(lock().unlock("0000")))
  }

  @Test
  fun aHistoryWithoutItsKeyFileIsNotGivenANewKey() {
    assertThrows(KeyLostException::class.java) { lock().create("1234", random, databaseExists = true) }
    assertFalse(lock().isSet())
  }

  @Test
  fun aKeyFileLeftByACrashGoesAtTheNextUnlock() {
    val legacy = DatabaseKey(File(folder, HistoryStorage.KEY), alias)
    val before = legacy.getOrCreate(random)
    val saved = File(folder, "saved.key").also { File(folder, HistoryStorage.KEY).copyTo(it) }
    lock().create("1234", random, databaseExists = true)
    saved.copyTo(File(folder, HistoryStorage.KEY))
    assertArrayEquals(before, opened(lock().unlock("1234")))
    assertFalse(legacy.exists())
  }

  @Test
  fun aPinCannotBeTriedBeforeOneIsSet() {
    assertThrows(IllegalStateException::class.java) { lock().unlock("1234") }
  }

  @Test
  fun changingThePinNeedsTheOldOne() {
    val key = lock().create("1234", random, false)
    assertTrue(lock().change("9999", "5678", random) is HistoryLock.Unlock.Wrong)
    assertThrows(IllegalArgumentException::class.java) { lock().change("1234", "56", random) }
    assertTrue(lock().change("1234", "5678", random) is HistoryLock.Unlock.Opened)
    assertTrue(lock().unlock("1234") is HistoryLock.Unlock.Wrong)
    assertArrayEquals(key, opened(lock().unlock("5678")))
  }

  @Test
  fun aChangedLockFileDoesNotOpen() {
    lock().create("1234", random, false)
    val file = File(folder, HistoryLock.LOCK)
    val original = file.readBytes()
    for (index in listOf(0, 5, 20, original.size - 1)) {
      file.writeBytes(original.copyOf().also { it[index] = (it[index].toInt() xor 1).toByte() })
      assertThrows(KeyLostException::class.java) { lock().unlock("1234") }
    }
    for (size in listOf(10, 30, 49)) {
      file.writeBytes(original.copyOf(size))
      assertThrows(KeyLostException::class.java) { lock().unlock("1234") }
    }
    file.writeBytes(original)
    assertTrue(lock().unlock("1234") is HistoryLock.Unlock.Opened)
  }

  @Test
  fun aLockFileCutOffMidWriteIsRestoredFromItsCopy() {
    val key = lock().create("1234", random, false)
    val file = File(folder, HistoryLock.LOCK)
    file.renameTo(File(folder, HistoryLock.LOCK + ".bak"))
    File(folder, HistoryLock.LOCK).writeBytes(ByteArray(7))
    assertTrue(lock().isSet())
    assertArrayEquals(key, opened(lock().unlock("1234")))
    file.renameTo(File(folder, HistoryLock.LOCK + ".bak"))
    assertTrue(lock().isSet())
    assertArrayEquals(key, opened(lock().unlock("1234")))
  }

  @Test
  fun aLockFileDoesNotOpenWithoutThePhonesKey() {
    lock().create("1234", random, false)
    KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(alias)
    assertThrows(KeyLostException::class.java) { lock().unlock("1234") }
  }

  @Test
  fun theHistoryOpensWithTheKeyTheLockGives() {
    val storage = HistoryStorage(folder, alias)
    val key = lock().create("1234", random, storage.exists())
    storage.openWithKey(key)
    key.fill(0)
    storage.appendJson(HistoryStorage.toJson(listOf(row(0))).removeSurrounding("[", "]"))
    storage.close()
    assertFalse(storage.isOpen())
    val again = opened(lock().unlock("1234"))
    storage.openWithKey(again)
    assertEquals(HistoryStorage.toJson(listOf(row(0))), storage.loadJson())
    storage.close()
    val wrong = ByteArray(32).also(random::nextBytes)
    assertThrows(Exception::class.java) { HistoryStorage(folder, alias).apply { openWithKey(wrong) }.loadJson() }
  }

  @Test
  fun aBiometricCopyWithoutItsKeyIsDropped() {
    lock().create("1234", random, false)
    assertNull(lock().biometricOpeningCipher())
    val copy = File(folder, HistoryLock.BIOMETRIC).apply { writeBytes(ByteArray(40) { 1 }) }
    assertFalse(lock().hasBiometric())
    assertNull(lock().biometricOpeningCipher())
    assertFalse(copy.exists())
  }

  @Test
  fun theAppsCountOfRoundsTakesUnderASecond() {
    val start = SystemClock.elapsedRealtime()
    lock(HistoryLock.ITERATIONS).create("1234", random, false)
    val created = SystemClock.elapsedRealtime() - start
    val again = SystemClock.elapsedRealtime()
    assertTrue(lock(HistoryLock.ITERATIONS).unlock("1234") is HistoryLock.Unlock.Opened)
    val unlocked = SystemClock.elapsedRealtime() - again
    Log.i("LockTest", "PBKDF2 ${HistoryLock.ITERATIONS} rounds: create $created ms, unlock $unlocked ms")
    assertTrue("Unlocking took $unlocked ms", unlocked < 1_000)
  }
}
