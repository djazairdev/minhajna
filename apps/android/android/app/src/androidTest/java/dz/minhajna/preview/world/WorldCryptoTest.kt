// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.world

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import dz.minhajna.preview.signature.signingKeyFingerprint
import dz.minhajna.preview.signature.verifies
import dz.minhajna.preview.storage.Hashing
import java.security.MessageDigest
import java.util.Base64
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * A demo world's cryptography on the phone gives what Node's crypto and the
 * PC's Web Crypto give (#561): the vectors below were made by Node with
 * made-up inputs, and the web app's tests check the same ones, with a pair
 * this code made, whose private half was thrown away, and an agreement of
 * Node's pairs on P-256 (#570, answer 595). The 600,000 rounds are
 * the world's own; pairs here are made at runtime and never stored. A debug
 * build, which holds the network permission for Metro, may connect; a
 * release build does once #559's notice adds the permission (answer 575).
 */
@RunWith(AndroidJUnit4::class)
class WorldCryptoTest {
  private val secret = bytes("4d4144455550574f524c44534543524554")
  private val salt = bytes("6d696e68616a6e612f776f726c642f4142434445")
  private val key = bytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20")
  private val plain = bytes("7b226d616465223a227570227d")
  private val sealedByNode =
    bytes("000102030405060708090a0b0a126cf6acb843312d5ec26319905eea2db3bba4ddc3b6fcc62e682acc")
  private val sealedEmptyByNode = bytes("000102030405060708090a0b656e7780606eefe387a3453712bd950a")
  private val agreementByNode =
    "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgohIwywKShdnSLjEHQZr4RcOlGe0IRa8HLN7HbdNK" +
      "KG6hRANCAATE1weEa+3KK3MP+4teu9jNvPYZQTvOm1JoHkCgxhy1M02mVL6EEK9TjofoHkYPTcuWijlxuKVLmUbK4kWZzmJO"
  private val peerByNode =
    bytes(
      "0471b28ea1c5aaa2a8de43d57ca5d4937578e6b022054a4bac19c03d1612a18887" +
        "b78f81138fc20c93de43eeed64205421211d2e1c0f3556e2765c21239718ab7d",
    )
  private val secretByNode = bytes("e2f4f74ef9a375f6f27e02f7d46f3ff681ab551971cbdc02683154d4bd9a10d9")

  @Test
  fun derivesAndMacsAsNodeDoes() {
    val derived = WorldCrypto.derive(secret, salt, 600_000)
    assertEquals("6371282357f1bc9d3d403bf482bcd2afa02b49196c9cdb4da7be443f3f0fa3cd", Hashing.hex(derived))
    assertEquals(
      "de2c6629050d05745e5d309a8cd0e72dd9adf7ff84a1a3fbcb802b65cea64cd6",
      Hashing.hex(WorldCrypto.derive(secret, salt, 1)),
    )
    assertEquals(
      "312fabd6c0b7056c8d027d0de7eec56ab9a7b4a3dde13264d80a6aba5df56641",
      Hashing.hex(WorldCrypto.derive(secret, ByteArray(0), 1)),
    )
    assertEquals(
      "0cec5f50794fc39e0fa88a70417dfc5ea2d720461645c38b1a247e75f51813ff",
      Hashing.hex(WorldCrypto.mac(derived, "minhajna/world/pass".toByteArray())),
    )
    assertThrows(IllegalArgumentException::class.java) { WorldCrypto.derive(secret, salt, 0) }
    assertThrows(IllegalArgumentException::class.java) { WorldCrypto.derive(ByteArray(0), salt, 1) }
    assertThrows(IllegalArgumentException::class.java) { WorldCrypto.seal(key.copyOf(16), plain, salt) }
  }

  @Test
  fun opensWhatNodeSealedAndNothingChanged() {
    assertArrayEquals(plain, WorldCrypto.open(key, sealedByNode, salt))
    assertArrayEquals(ByteArray(0), WorldCrypto.open(key, sealedEmptyByNode, salt))
    assertArrayEquals(ByteArray(0), WorldCrypto.open(key, WorldCrypto.seal(key, ByteArray(0), salt), salt))
    val changed = sealedByNode.copyOf().also { it[20] = (it[20].toInt() xor 1).toByte() }
    assertNull(WorldCrypto.open(key, changed, salt))
    assertNull(WorldCrypto.open(key, sealedByNode, "minhajna/world/FGHIJ".toByteArray()))
    assertNull(WorldCrypto.open(key.copyOf().also { it[0] = 9 }, sealedByNode, salt))
    assertNull(WorldCrypto.open(key.copyOf(16), sealedByNode, salt))
    assertNull(WorldCrypto.open(key, sealedByNode.copyOf(12), salt))
  }

  @Test
  fun sealsUnderAFreshNonceEachTime() {
    val one = WorldCrypto.seal(key, plain, salt)
    val two = WorldCrypto.seal(key, plain, salt)
    assertEquals(12 + plain.size + 16, one.size)
    assertNotEquals(Hashing.hex(one.copyOf(12)), Hashing.hex(two.copyOf(12)))
    assertArrayEquals(plain, WorldCrypto.open(key, one, salt))
    assertArrayEquals(plain, WorldCrypto.open(key, two, salt))
  }

  @Test
  fun makesAPairWhoseHalvesSignAndCheckAndWhoseFingerprintIsItsSpki() {
    val pair = WorldCrypto.newPair()
    val spki = Base64.getDecoder().decode(pair.spki)
    assertEquals(Hashing.hex(MessageDigest.getInstance("SHA-256").digest(spki)), pair.fingerprint)
    assertEquals(signingKeyFingerprint(pair.spki), pair.fingerprint)
    val text = "minhajna/world/ABCDE\nمثال تجريبي"
    val signed = WorldCrypto.sign(pair.pkcs8, text)
    assertTrue(verifies(pair.spki, text, signed))
    assertFalse(verifies(pair.spki, "$text.", signed))
    assertFalse(verifies(WorldCrypto.newPair().spki, text, signed))
    assertThrows(Exception::class.java) { WorldCrypto.sign(pair.pkcs8, "\uD800") }
    assertThrows(Exception::class.java) { WorldCrypto.sign(pair.spki, text) }
  }

  @Test
  fun agreesAsNodeDoesAndRefusesAPointOffTheCurve() {
    assertArrayEquals(secretByNode, WorldCrypto.agree(agreementByNode, peerByNode))
    val one = WorldCrypto.newAgreement()
    val other = WorldCrypto.newAgreement()
    assertEquals(65, one.publicKey.size)
    assertEquals(4.toByte(), one.publicKey[0])
    assertArrayEquals(WorldCrypto.agree(one.pkcs8, other.publicKey), WorldCrypto.agree(other.pkcs8, one.publicKey))
    val off = peerByNode.copyOf().also { it[64] = (it[64].toInt() xor 1).toByte() }
    assertThrows(Exception::class.java) { WorldCrypto.agree(agreementByNode, off) }
    assertThrows(Exception::class.java) { WorldCrypto.agree(agreementByNode, peerByNode.copyOfRange(1, 65)) }
  }

  @Test
  fun aDebugBuildMayConnect() {
    assertTrue(mayConnect(InstrumentationRegistry.getInstrumentation().targetContext))
  }

  @Test
  fun readsOnlyLowercaseHex() {
    assertArrayEquals(byteArrayOf(0, 15, -1), bytes("000fff"))
    assertArrayEquals(ByteArray(0), bytes(""))
    for (bad in listOf("0", "0F", "zz", "00 ")) {
      assertThrows(IllegalArgumentException::class.java) { bytes(bad) }
    }
  }
}
