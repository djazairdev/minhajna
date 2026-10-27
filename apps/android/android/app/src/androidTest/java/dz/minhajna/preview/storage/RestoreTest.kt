// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * A restored history stored on a real Android (#247, answer 478): whole,
 * entries without content among them, kept after the history is opened
 * again; and nothing stored when the history is not empty or when one entry
 * is refused halfway. A copy taken back from another device (#250) is added
 * after the last entry, all or none. Each test uses its own files and
 * Keystore alias.
 */
@RunWith(AndroidJUnit4::class)
class RestoreTest {

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

  private fun row(seq: Long, body: String? = """{"text":"made-up note $seq"}""") = EntryRow(
    seq = seq,
    id = "id$seq",
    day = "2026-10-24",
    layer = "private",
    kind = "note",
    digest = "d$seq",
    previous = if (seq == 0L) "" else "h${seq - 1}",
    hash = "h$seq",
    salt = body?.let { "s$seq" },
    body = body,
  )

  private fun storage() = HistoryStorage(folder, alias).apply { open(random) }

  @Test
  fun storesTheWholeHistoryAndKeepsItWhenOpenedAgain() {
    val rows = listOf(row(0), row(1, null), row(2))
    val history = storage()
    history.restoreJson(HistoryStorage.toJson(rows))
    assertEquals(HistoryStorage.toJson(rows), history.loadJson())
    history.close()
    assertEquals(HistoryStorage.toJson(rows), storage().loadJson())
  }

  @Test
  fun takesARestoreOnlyIntoAnEmptyHistory() {
    val history = storage()
    history.appendJson(HistoryStorage.toJson(listOf(row(0))).removePrefix("[").removeSuffix("]"))
    assertThrows(IllegalStateException::class.java) { history.restoreJson(HistoryStorage.toJson(listOf(row(0)))) }
    assertEquals(HistoryStorage.toJson(listOf(row(0))), history.loadJson())
  }

  @Test
  fun addsACopyTakenBackAfterTheLastAllOrNone() {
    val history = storage()
    history.appendJson(HistoryStorage.toJson(listOf(row(0))).removePrefix("[").removeSuffix("]"))
    assertThrows(Exception::class.java) { history.appendAllJson(HistoryStorage.toJson(listOf(row(1), row(3)))) }
    assertEquals(HistoryStorage.toJson(listOf(row(0))), history.loadJson())
    history.appendAllJson(HistoryStorage.toJson(listOf(row(1, null), row(2))))
    history.close()
    assertEquals(HistoryStorage.toJson(listOf(row(0), row(1, null), row(2))), storage().loadJson())
  }

  @Test
  fun storesNothingWhenAnEntryIsRefusedHalfway() {
    val history = storage()
    val rows = listOf(row(0), row(1), row(3))
    assertThrows(Exception::class.java) { history.restoreJson(HistoryStorage.toJson(rows)) }
    assertEquals("[]", history.loadJson())
    history.restoreJson(HistoryStorage.toJson(listOf(row(0))))
    assertEquals(HistoryStorage.toJson(listOf(row(0))), history.loadJson())
  }
}
