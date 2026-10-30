// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import org.json.JSONArray
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * A demo world's own history (#558) on a real Android: while a world is
 * open, the teacher's history closes and refuses every call, and the
 * world's, in its own folder under its own Keystore key, keeps its own
 * entries; once the world is left, the teacher's opens again as it was.
 * The teacher's lock refuses every call that reads or changes it, and
 * erasing the device waits until the world is left. Each test uses its own
 * folders and aliases, never the app's.
 */
@RunWith(AndroidJUnit4::class)
class WorldTest {

  private val context = InstrumentationRegistry.getInstrumentation().targetContext
  private val random = SecureRandom()
  private val run = random.nextLong()
  private val folders = listOf("teacher", "world").map { File(context.noBackupFilesDir, "test-$it-$run") }
  private val aliases = listOf("teacher", "world").map { "minhajna.test.$it.$run" }

  @After
  fun tearDown() {
    WorldGate.leave()
    folders.forEach { it.deleteRecursively() }
    val keys = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (aliases + "${aliases[0]}.biometric").forEach(keys::deleteEntry)
  }

  private fun entry(seq: Long, text: String): String {
    val body = """{"text":"$text"}"""
    val row = EntryRow(seq, "id$seq", "2026-12-01", "private", "note", "d$seq", "", "h$seq", "s$seq", body)
    return JSONArray(HistoryStorage.toJson(listOf(row))).getJSONObject(0).toString()
  }

  private fun texts(storage: HistoryStorage): List<String> {
    val rows = JSONArray(storage.loadJson())
    return List(rows.length()) { rows.getJSONObject(it).getString("body") }
  }

  @Test
  fun theTeachersHistoryStaysShutWhileAWorldIsOpen() {
    val teacher = HistoryStorage(folders[0].apply { mkdirs() }, aliases[0], teachers = true)
    teacher.open(random)
    teacher.appendJson(entry(0, "the teacher's own note"))

    WorldGate.enter("K7QF4")
    assertFalse(teacher.isOpen())
    assertThrows(WorldOpenException::class.java) { teacher.loadJson() }
    assertThrows(WorldOpenException::class.java) { teacher.appendJson(entry(1, "written in a world")) }
    assertThrows(WorldOpenException::class.java) { teacher.open(random) }

    val world = HistoryStorage(folders[1].apply { mkdirs() }, aliases[1])
    world.open(random)
    world.appendJson(entry(0, "a made-up note in the world"))
    assertEquals(listOf("""{"text":"a made-up note in the world"}"""), texts(world))
    world.close()

    WorldGate.leave()
    teacher.open(random)
    assertTrue(teacher.isOpen())
    assertEquals(listOf("""{"text":"the teacher's own note"}"""), texts(teacher))
    teacher.close()
  }

  private val clock = object : LockClock {
    override fun wall() = 1_800_000_000_000L
    override fun elapsed() = 60_000L
    override fun boot() = 3
  }

  private fun lock() = HistoryLock(folders[0].apply { mkdirs() }, clock, aliases[0], "${aliases[0]}.biometric", 1_000)

  private fun files() = folders[0].listFiles().orEmpty().associate { it.name to it.readBytes().toList() }

  @Test
  fun theTeachersLockRefusesEveryCallWhileAWorldIsOpen() {
    lock().create("4016", random, false).fill(0)
    val before = files()
    WorldGate.enter("K7QF4")
    val lock = lock()
    assertThrows(WorldOpenException::class.java) { lock.unlock("0000") }
    assertThrows(WorldOpenException::class.java) { lock.unlock("4016") }
    assertThrows(WorldOpenException::class.java) { lock.change("4016", "1234", random) }
    assertThrows(WorldOpenException::class.java) { lock.biometricOpeningCipher() }
    assertThrows(WorldOpenException::class.java) { lock.biometricKeyCipher() }
    assertThrows(WorldOpenException::class.java) { lock.dropBiometric() }
    assertThrows(WorldOpenException::class.java) { DeviceErase.run(context) {} }
    assertEquals(before.keys, files().keys)
    before.forEach { (name, bytes) -> assertEquals(name, bytes, files()[name]) }

    WorldGate.leave()
    val opened = lock.unlock("4016")
    assertTrue(opened is HistoryLock.Unlock.Opened)
    (opened as HistoryLock.Unlock.Opened).key.fill(0)
  }

  @Test
  fun noPinIsSetInAWorld() {
    WorldGate.enter("K7QF4")
    assertThrows(WorldOpenException::class.java) { lock().create("4016", random, false) }
    WorldGate.leave()
    assertFalse(lock().isSet())
  }

  @Test
  fun aWorldsHistoryKeepsItsOwnKey() {
    val world = HistoryStorage(folders[1].apply { mkdirs() }, aliases[1])
    WorldGate.enter("K7QF4")
    world.open(random)
    world.appendJson(entry(0, "kept"))
    world.close()
    world.open(random)
    assertEquals(listOf("""{"text":"kept"}"""), texts(world))
    world.close()
    assertTrue(KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.containsAlias(aliases[1]))
  }
}
