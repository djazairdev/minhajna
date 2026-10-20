// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.security.SecureRandom
import net.zetetic.database.sqlcipher.SQLiteDatabase
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/** Version 5 changes only compatibility, never a history row or a timing (#222). */
@RunWith(AndroidJUnit4::class)
class CalendarMigrationTest {
  private val context = InstrumentationRegistry.getInstrumentation().targetContext
  private val random = SecureRandom()
  private val key = ByteArray(DatabaseKey.KEY_BYTES).also(random::nextBytes)
  private lateinit var folder: File
  private lateinit var file: File

  @Before
  fun setUp() {
    folder = File(context.noBackupFilesDir, "calendar-test-${random.nextLong()}").apply { mkdirs() }
    file = File(folder, "history.db")
  }

  @After
  fun tearDown() {
    folder.deleteRecursively()
    key.fill(0)
  }

  private fun raw(): SQLiteDatabase {
    val password = HistoryDatabase.rawKey(key)
    try {
      return SQLiteDatabase.openDatabase(file.path, password, null, SQLiteDatabase.OPEN_READWRITE, null, null)
    } finally {
      password.fill(0)
    }
  }

  @Test
  fun upgradesVersionTwoWithoutRecreatingTimingsOrChangingHistory() {
    val row = EntryRow(0, "made-up", "2026-10-15", "lesson-record", "calendar.set", "digest", "", "hash", "salt",
      """{"kind":"calendar.set","entry":{"id":"made-up","from":"2026-10-15","to":"2026-10-15"}}""")
    val timings = listOf(TimingRow("roll", "2026-10-11", 25, false))
    HistoryDatabase.open(file, key).apply { append(row); addTimings(timings); close() }
    raw().apply { execSQL("PRAGMA user_version = 2"); close() }
    HistoryDatabase.open(file, key).apply {
      assertEquals("5", pragma("user_version"))
      assertEquals(listOf(row), load())
      assertEquals(timings, loadTimings())
      close()
    }
  }

  @Test
  fun upgradesVersionThreeWithoutChangingRotationSnapshots() {
    val row = EntryRow(0, "rotation-example", "2026-10-15", "lesson-record", "session.recorded", "digest", "", "hash", "salt",
      """{"kind":"session.recorded","record":{"session":{"rotation":{"entryId":"example","groups":["g-1","g-2"]}}}}""")
    HistoryDatabase.open(file, key).apply { append(row); close() }
    raw().apply { execSQL("PRAGMA user_version = 3"); close() }
    HistoryDatabase.open(file, key).apply {
      assertEquals("5", pragma("user_version"))
      assertEquals(listOf(row), load())
      close()
    }
  }

  @Test
  fun upgradesVersionFourWithoutChangingReceivedProvenanceOrHistory() {
    val row = EntryRow(0, "received-example", "2026-10-15", "lesson-record", "calendar.set", "digest", "", "hash", "salt",
      """{"kind":"calendar.set","entry":{"id":"example","received":{"sender":"Synthetic sender"}}}""")
    HistoryDatabase.open(file, key).apply { append(row); close() }
    raw().apply { execSQL("PRAGMA user_version = 4"); close() }
    HistoryDatabase.open(file, key).apply {
      assertEquals("5", pragma("user_version"))
      assertEquals(listOf(row), load())
      close()
    }
  }

  @Test
  fun refusesANewerDatabaseWithoutChangingItsVersionOrHistory() {
    HistoryDatabase.open(file, key).close()
    raw().apply { execSQL("PRAGMA user_version = 6"); close() }
    assertThrows(IllegalStateException::class.java) { HistoryDatabase.open(file, key) }
    raw().apply {
      assertEquals(6, rawQuery("PRAGMA user_version", null).use { it.moveToFirst(); it.getInt(0) })
      assertEquals(0, rawQuery("SELECT count(*) FROM entry", null).use { it.moveToFirst(); it.getInt(0) })
      close()
    }
  }
}
