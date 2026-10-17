// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

import java.io.File
import net.zetetic.database.sqlcipher.SQLiteDatabase

/**
 * One entry of the history as the database keeps it. `body` is the entry's
 * content as JSON text; `salt` and `body` are both null once erased.
 */
data class EntryRow(
  val seq: Long,
  val id: String,
  val day: String,
  val layer: String,
  val kind: String,
  val digest: String,
  val previous: String,
  val hash: String,
  val salt: String?,
  val body: String?,
)

/**
 * The teacher's history in an SQLCipher database (PRD §5.5, §6.4). It holds
 * entries only: they are added in order and never changed, except that an
 * erasure removes an entry's content and salt. The core checks the chain
 * when it opens the history; the triggers below refuse the rest here too.
 */
class HistoryDatabase private constructor(private val db: SQLiteDatabase) {

  fun load(): List<EntryRow> {
    val rows = mutableListOf<EntryRow>()
    db.rawQuery("SELECT seq, id, day, layer, kind, digest, previous, hash, salt, body FROM entry ORDER BY seq", null)
      .use { cursor ->
        while (cursor.moveToNext()) {
          rows += EntryRow(
            seq = cursor.getLong(0),
            id = cursor.getString(1),
            day = cursor.getString(2),
            layer = cursor.getString(3),
            kind = cursor.getString(4),
            digest = cursor.getString(5),
            previous = cursor.getString(6),
            hash = cursor.getString(7),
            salt = if (cursor.isNull(8)) null else cursor.getString(8),
            body = if (cursor.isNull(9)) null else cursor.getString(9),
          )
        }
      }
    return rows
  }

  /** Returns once the entry is committed and synced to the disk (PRD §6.8). */
  fun append(row: EntryRow) = write {
    db.execSQL(
      "INSERT INTO entry (seq, id, day, layer, kind, digest, previous, hash, salt, body) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      arrayOf(row.seq, row.id, row.day, row.layer, row.kind, row.digest, row.previous, row.hash, row.salt, row.body),
    )
  }

  /** Removes the content and salt of the given entries, all or none. */
  fun eraseContent(ids: List<String>) = write {
    for (id in ids) db.execSQL("UPDATE entry SET salt = NULL, body = NULL WHERE id = ?", arrayOf(id))
  }

  fun close() = db.close()

  /** A PRAGMA's value, for the checks and the tests. */
  fun pragma(name: String): String? =
    db.rawQuery("PRAGMA $name", null).use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }

  /**
   * Runs `block` in one transaction. The connection's settings are applied
   * again first, in case the library reopened it with its own defaults.
   */
  private fun write(block: () -> Unit) {
    applySettings(db)
    db.beginTransaction()
    try {
      block()
      db.setTransactionSuccessful()
    } finally {
      db.endTransaction()
    }
  }

  companion object {
    private const val SCHEMA_VERSION = 1

    init {
      System.loadLibrary("sqlcipher")
    }

    /**
     * Opens the history, or creates it. The key is used as a raw key, so no
     * passphrase derivation slows the opening; the caller clears it afterwards.
     */
    fun open(file: File, key: ByteArray): HistoryDatabase {
      require(key.size == DatabaseKey.KEY_BYTES)
      val password = rawKey(key)
      val db = try {
        SQLiteDatabase.openDatabase(
          file.path,
          password,
          null,
          SQLiteDatabase.OPEN_READWRITE or SQLiteDatabase.CREATE_IF_NECESSARY,
          null,
          null,
        )
      } finally {
        password.fill(0)
      }
      try {
        applySettings(db)
        migrate(db)
      } catch (e: Exception) {
        db.close()
        throw e
      }
      return HistoryDatabase(db)
    }

    /**
     * SQLCipher reads `x'…'` with 64 hex digits as the key itself. It is
     * written byte by byte, never as a String, so the caller can clear it.
     */
    internal fun rawKey(key: ByteArray): ByteArray {
      val hex = "0123456789abcdef"
      val out = ByteArray(3 + key.size * 2)
      out[0] = 'x'.code.toByte()
      out[1] = '\''.code.toByte()
      for ((i, byte) in key.withIndex()) {
        out[2 + i * 2] = hex[(byte.toInt() shr 4) and 0xF].code.toByte()
        out[3 + i * 2] = hex[byte.toInt() and 0xF].code.toByte()
      }
      out[out.size - 1] = '\''.code.toByte()
      return out
    }

    /**
     * The library sets its own journal and sync modes after its hooks run, so
     * these are set on the open connection. With a rollback journal, a commit
     * is final once the journal is deleted: EXTRA also syncs the folder after
     * that, so a power cut just after a confirmed write cannot bring the
     * journal back and undo it, as FULL alone allowed (#19). secure_delete
     * overwrites erased content, so erasing is real (PRD §5.5).
     */
    private fun applySettings(db: SQLiteDatabase) {
      db.rawQuery("PRAGMA journal_mode = DELETE", null).use { it.moveToFirst() }
      db.execSQL("PRAGMA synchronous = EXTRA")
      db.rawQuery("PRAGMA secure_delete = ON", null).use { it.moveToFirst() }
    }

    private fun migrate(db: SQLiteDatabase) {
      val version = db.rawQuery("PRAGMA user_version", null).use { it.moveToFirst(); it.getInt(0) }
      if (version == SCHEMA_VERSION) return
      check(version == 0) { "The history's database is from a newer version of the app" }
      db.beginTransaction()
      try {
        db.execSQL(
          """
          CREATE TABLE entry (
            seq INTEGER PRIMARY KEY CHECK (seq >= 0),
            id TEXT NOT NULL UNIQUE,
            day TEXT NOT NULL,
            layer TEXT NOT NULL,
            kind TEXT NOT NULL,
            digest TEXT NOT NULL,
            previous TEXT NOT NULL,
            hash TEXT NOT NULL,
            salt TEXT,
            body TEXT,
            CHECK ((salt IS NULL) = (body IS NULL))
          ) STRICT
          """.trimIndent(),
        )
        db.execSQL(
          """
          CREATE TRIGGER entry_added_in_order BEFORE INSERT ON entry
          WHEN NEW.seq IS NOT (SELECT coalesce(max(seq), -1) + 1 FROM entry)
          BEGIN SELECT RAISE(ABORT, 'entries are added in order'); END
          """.trimIndent(),
        )
        db.execSQL(
          """
          CREATE TRIGGER entry_never_deleted BEFORE DELETE ON entry
          BEGIN SELECT RAISE(ABORT, 'the history is append-only'); END
          """.trimIndent(),
        )
        db.execSQL(
          """
          CREATE TRIGGER entry_only_erased BEFORE UPDATE ON entry
          WHEN NEW.seq IS NOT OLD.seq OR NEW.id IS NOT OLD.id OR NEW.day IS NOT OLD.day
            OR NEW.layer IS NOT OLD.layer OR NEW.kind IS NOT OLD.kind OR NEW.digest IS NOT OLD.digest
            OR NEW.previous IS NOT OLD.previous OR NEW.hash IS NOT OLD.hash
            OR NEW.salt IS NOT NULL OR NEW.body IS NOT NULL
          BEGIN SELECT RAISE(ABORT, 'only an entry''s content is erased'); END
          """.trimIndent(),
        )
        db.execSQL("PRAGMA user_version = $SCHEMA_VERSION")
        db.setTransactionSuccessful()
      } finally {
        db.endTransaction()
      }
    }
  }
}
