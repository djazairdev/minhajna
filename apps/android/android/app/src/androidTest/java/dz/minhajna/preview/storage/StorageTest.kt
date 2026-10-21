// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.nio.charset.CharacterCodingException
import java.security.KeyStore
import java.security.SecureRandom
import net.zetetic.database.sqlcipher.SQLiteDatabase
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.json.JSONObject
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The storage on a real Android: SQLCipher, the Keystore and the platform's
 * SHA-256. Each test uses its own files and Keystore alias, never the app's.
 */
@RunWith(AndroidJUnit4::class)
class StorageTest {

  private val context = InstrumentationRegistry.getInstrumentation().targetContext
  private val random = SecureRandom()
  private val alias = "minhajna.test.${random.nextLong()}"
  private lateinit var folder: File

  @Before
  fun setUp() {
    folder = File(context.noBackupFilesDir, "test-${random.nextLong()}").apply { mkdirs() }
  }

  @After
  fun tearDown() {
    folder.deleteRecursively()
    KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(alias)
  }

  private fun key() = DatabaseKey(File(folder, "history.key"), alias)

  private fun row(seq: Long, body: String? = """{"text":"note $seq"}""") = EntryRow(
    seq = seq,
    id = "id$seq",
    day = "2026-10-15",
    layer = "private",
    kind = "note",
    digest = "d$seq",
    previous = if (seq == 0L) "" else "h${seq - 1}",
    hash = "h$seq",
    salt = body?.let { "s$seq" },
    body = body,
  )

  private fun openDatabase(): HistoryDatabase {
    val bytes = key().getOrCreate(random)
    try {
      return HistoryDatabase.open(File(folder, "history.db"), bytes)
    } finally {
      bytes.fill(0)
    }
  }

  /** The same database, opened without the module's rules, to try what the module never does. */
  private fun openRaw(bytes: ByteArray): SQLiteDatabase {
    val password = HistoryDatabase.rawKey(bytes)
    return SQLiteDatabase.openDatabase(
      File(folder, "history.db").path, password, null, SQLiteDatabase.OPEN_READWRITE, null, null,
    )
  }

  @Test
  fun makesTheKeyOnceAndKeepsItOnlyWrapped() {
    val first = key().getOrCreate(random)
    val second = key().getOrCreate(random)
    assertArrayEquals(first, second)
    assertEquals(DatabaseKey.KEY_BYTES, first.size)
    val stored = File(folder, "history.key").readBytes()
    assertFalse(stored.toList().windowed(first.size).any { it == first.toList() })
    assertNotEquals("none", key().securityLevel())
  }

  @Test
  fun refusesAKeyFileWhoseKeystoreKeyIsGone() {
    key().getOrCreate(random)
    KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(alias)
    assertThrows(KeyLostException::class.java) { key().getOrCreate(random) }
  }

  @Test
  fun refusesAChangedKeyFile() {
    key().getOrCreate(random)
    val file = File(folder, "history.key")
    val bytes = file.readBytes()
    bytes[bytes.size - 1] = (bytes[bytes.size - 1].toInt() xor 1).toByte()
    file.writeBytes(bytes)
    assertThrows(KeyLostException::class.java) { key().getOrCreate(random) }
  }

  /** A signed pack of 1 MB, kept with its parsed copy and escaped twice, makes a row of over 2 MB (#223). */
  @Test
  fun readsBackAnEntryTheSizeOfALargeSignedPack() {
    val body = JSONObject().put("file", "تجربة\\\"x".repeat(150_000)).put("pack", "m".repeat(900_000)).toString()
    val database = openDatabase()
    database.append(row(0, body))
    database.close()
    val again = openDatabase()
    try {
      assertEquals(body, again.load().single().body)
    } finally {
      again.close()
    }
  }

  @Test
  fun keepsEntriesAcrossReopening() {
    openDatabase().apply {
      append(row(0))
      append(row(1, """{"text":"تذكير","n":1.5}"""))
      close()
    }
    val reopened = openDatabase()
    assertEquals(listOf(row(0), row(1, """{"text":"تذكير","n":1.5}""")), reopened.load())
    reopened.close()
  }

  @Test
  fun usesSqlcipherWithDurableSettings() {
    val db = openDatabase()
    assertTrue(db.pragma("cipher_version")!!.startsWith("4.19."))
    assertEquals("libtomcrypt", db.pragma("cipher_provider"))
    db.append(row(0))
    assertEquals("3", db.pragma("synchronous"))
    assertEquals("1", db.pragma("secure_delete"))
    assertEquals("delete", db.pragma("journal_mode"))
    db.close()
  }

  @Test
  fun writesNothingReadableWithoutTheKey() {
    openDatabase().apply {
      append(row(0, """{"text":"ABSENT-PUPIL-NAME"}"""))
      close()
    }
    val file = File(folder, "history.db").readBytes()
    assertFalse(String(file.copyOf(16), Charsets.US_ASCII).startsWith("SQLite format 3"))
    assertFalse(String(file, Charsets.ISO_8859_1).contains("ABSENT-PUPIL-NAME"))
    val wrong = ByteArray(DatabaseKey.KEY_BYTES).also(random::nextBytes)
    assertThrows(Exception::class.java) { HistoryDatabase.open(File(folder, "history.db"), wrong) }
  }

  @Test
  fun erasesOnlyContent() {
    val db = openDatabase()
    db.append(row(0, """{"text":"to erase"}"""))
    db.append(row(1))
    db.eraseContent(listOf("id0"))
    val erased = db.load().first()
    assertNull(erased.salt)
    assertNull(erased.body)
    assertEquals(row(1), db.load()[1])
    db.close()
  }

  @Test
  fun refusesAnythingButAddingInOrderAndErasing() {
    openDatabase().apply {
      append(row(0))
      assertThrows(Exception::class.java) { append(row(2)) }
      assertThrows(Exception::class.java) { append(row(0)) }
      close()
    }
    val bytes = key().getOrCreate(random)
    val raw = openRaw(bytes)
    bytes.fill(0)
    try {
      assertThrows(Exception::class.java) { raw.execSQL("DELETE FROM entry") }
      assertThrows(Exception::class.java) { raw.execSQL("UPDATE entry SET kind = 'other'") }
      assertThrows(Exception::class.java) { raw.execSQL("UPDATE entry SET body = '{}'") }
      assertThrows(Exception::class.java) { raw.execSQL("UPDATE entry SET body = NULL") }
    } finally {
      raw.close()
    }
    val reopened = openDatabase()
    assertEquals(listOf(row(0)), reopened.load())
    reopened.close()
  }

  @Test
  fun keepsTimingsBesideTheHistoryWithNoDayAndClearsThem() {
    val timings = listOf(TimingRow("session", "2026-10-11", 42, true), TimingRow("roll", "2026-10-11", 610, false))
    openDatabase().apply {
      append(row(0))
      addTimings(timings)
      close()
    }
    val db = openDatabase()
    assertEquals(timings, db.loadTimings())
    assertEquals("5", db.pragma("user_version"))
    db.clearTimings()
    assertEquals(emptyList<TimingRow>(), db.loadTimings())
    assertEquals(listOf(row(0)), db.load())
    db.close()
    val bytes = key().getOrCreate(random)
    val raw = openRaw(bytes)
    bytes.fill(0)
    try {
      val columns = raw.rawQuery("SELECT name FROM pragma_table_info('timing')", null).use { cursor ->
        generateSequence { if (cursor.moveToNext()) cursor.getString(0) else null }.toList()
      }
      assertEquals(listOf("kind", "week", "tenths", "one_tap"), columns)
    } finally {
      raw.close()
    }
  }

  @Test
  fun refusesAMalformedTimingAndKeepsNoneOfItsBatch() {
    val db = openDatabase()
    val good = TimingRow("session", "2026-10-11", 42, true)
    for (bad in listOf(
      TimingRow("mark", "2026-10-11", 1, false),
      TimingRow("roll", "2026-10-11 08:00", 1, false),
      TimingRow("roll", "2026-10-11", -1, false),
    )) {
      assertThrows(Exception::class.java) { db.addTimings(listOf(good, bad)) }
    }
    assertEquals(emptyList<TimingRow>(), db.loadTimings())
    db.close()
  }

  @Test
  fun readsOnlyTimingsWhoseFieldsHaveTheirOwnTypes() {
    val good = """{"kind":"roll","week":"2026-10-11","tenths":12,"oneTap":false}"""
    assertEquals(TimingRow("roll", "2026-10-11", 12, false), HistoryStorage.timingFromJson(JSONObject(good)))
    for (bad in listOf(
      good.replace("12", "1.5"),
      good.replace(":12", ":\"12\""),
      good.replace("false", "\"false\""),
      good.replace("\"roll\"", "1"),
      good.replace("2026-10-11", "2026-13-45"),
    )) {
      assertThrows(Exception::class.java) { HistoryStorage.timingFromJson(JSONObject(bad)) }
    }
  }

  @Test
  fun upgradesAVersionOneHistoryAndKeepsItsEntries() {
    openDatabase().apply {
      append(row(0))
      close()
    }
    val bytes = key().getOrCreate(random)
    val raw = openRaw(bytes)
    bytes.fill(0)
    try {
      raw.execSQL("DROP TABLE timing")
      raw.execSQL("PRAGMA user_version = 1")
    } finally {
      raw.close()
    }
    val db = openDatabase()
    assertEquals("5", db.pragma("user_version"))
    assertEquals(listOf(row(0)), db.load())
    db.addTimings(listOf(TimingRow("roll", "2026-10-11", 610, false)))
    assertEquals(1, db.loadTimings().size)
    db.close()
  }

  /** The same vectors as Node's crypto and the browsers' WebCrypto. */
  @Test
  fun hashesLikeEveryOtherPlatform() {
    assertEquals("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", Hashing.sha256Hex(""))
    assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", Hashing.sha256Hex("abc"))
    assertEquals("a872255bb241b1ed530a813816deb566569957441a9d97958a693bce703a7213", Hashing.sha256Hex("منهاجنا"))
    assertEquals(
      "44d964ebff0c92fc72feb16792dfa63b89016bc07cf515b52f2361e228c8252c",
      Hashing.sha256Hex("Séance 😀"),
    )
    assertThrows(CharacterCodingException::class.java) { Hashing.sha256Hex("a\uD800") }
  }
}
