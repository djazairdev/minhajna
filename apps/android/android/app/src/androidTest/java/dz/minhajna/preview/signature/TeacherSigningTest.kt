// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.signature

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.security.KeyStore
import java.security.MessageDigest
import java.util.Base64
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import javax.crypto.KeyGenerator
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/** Fresh test aliases only: no test opens, replaces or deletes the production teacher key. */
@RunWith(AndroidJUnit4::class)
class TeacherSigningTest {
  private val alias = "minhajna-test-teacher-${UUID.randomUUID()}"
  private val payload = "{\"example\":\"\u0628\u064a\u0627\u0646 \u062a\u062c\u0631\u064a\u0628\u064a\",\"day\":\"2026-10-24\"}"

  @After
  fun removeOnlyThisTestsKeys() {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    listOf(alias, "$alias-other").forEach { store.deleteEntry(it) }
  }

  @Test
  fun createsOnePersistentNonExportableP256Key() {
    val teacher = TeacherSigningKey(alias)
    val public = teacher.publicKey()
    assertEquals(public, teacher.publicKey())
    assertEquals(public, TeacherSigningKey(alias).publicKey())
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val private = store.getKey(alias, null)
    assertEquals("EC", private.algorithm)
    assertNull(private.encoded)
    assertTrue(verifies(public, payload, teacher.sign(payload)))
  }

  @Test
  fun concurrentFirstCallsNeverReplaceEachOthersKey() {
    val workers = Executors.newFixedThreadPool(4)
    try {
      val calls = List(8) { Callable { TeacherSigningKey(alias).publicKey() } }
      val keys = workers.invokeAll(calls).map { it.get() }.toSet()
      assertEquals(1, keys.size)
    } finally {
      workers.shutdownNow()
    }
  }

  @Test
  fun changedPayloadAndAnotherTeachersKeyFail() {
    val teacher = TeacherSigningKey(alias)
    val public = teacher.publicKey()
    val signed = teacher.sign(payload)
    val other = TeacherSigningKey("$alias-other").publicKey()
    assertNotEquals(public, other)
    assertTrue(verifies(public, payload, signed))
    assertFalse(verifies(public, "$payload ", signed))
    assertFalse(verifies(other, payload, signed))
  }

  @Test
  fun fingerprintsDecodedSpkiWithPlatformSha256() {
    val public = TeacherSigningKey(alias).publicKey()
    val bytes = Base64.getDecoder().decode(public)
    val expected = MessageDigest.getInstance("SHA-256").digest(bytes)
      .joinToString("") { "%02x".format(it.toInt() and 255) }
    assertEquals(expected, signingKeyFingerprint(public))
    assertThrows(Exception::class.java) { signingKeyFingerprint("not a key") }
  }

  @Test
  fun rejectsInvalidTextBeforeCreatingAnyKey() {
    val teacher = TeacherSigningKey(alias)
    for (text in listOf("", "\ud800", "x".repeat(65_537), "\u0645".repeat(32_769))) {
      assertThrows(Exception::class.java) { teacher.sign(text) }
    }
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    assertFalse(store.containsAlias(alias))
  }

  @Test
  fun neverReplacesAnInvalidExistingAlias() {
    val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setKeySize(256)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .build()
    KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(spec)
    }.generateKey()
    assertThrows(Exception::class.java) { TeacherSigningKey(alias).publicKey() }
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    assertEquals("AES", store.getKey(alias, null).algorithm)
  }
}
