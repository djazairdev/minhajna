// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.world

import dz.minhajna.preview.signature.isP256
import dz.minhajna.preview.storage.Hashing
import java.nio.CharBuffer
import java.nio.charset.CodingErrorAction
import java.security.GeneralSecurityException
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.Signature
import java.security.interfaces.ECPrivateKey
import java.security.spec.ECGenParameterSpec
import java.security.spec.PKCS8EncodedKeySpec
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/** A world's new pair, as WorldKit.newPair gives it. */
data class WorldPair(val spki: String, val pkcs8: String, val fingerprint: String)

/**
 * The cryptography a demo world needs on the phone (#561, answers 568 and
 * 572), byte for byte as the PC's Web Crypto: PBKDF2-HMAC-SHA256 to 32
 * bytes, written out over HMAC so no provider reads the secret as text;
 * HMAC-SHA256; AES-256-GCM with a fresh random 12-byte nonce first and a
 * 128-bit tag; and ECDSA P-256 over SHA-256 with software keys, never the
 * Keystore's, since a world's keys are made up and travel sealed with it.
 * A seal that does not open gives null; any other failure throws.
 */
object WorldCrypto {
  private const val NONCE = 12
  private const val TAG_BITS = 128
  private const val MOST_ROUNDS = 1_000_000
  private val random = SecureRandom()

  fun derive(secret: ByteArray, salt: ByteArray, rounds: Int): ByteArray {
    require(secret.isNotEmpty() && rounds in 1..MOST_ROUNDS) { "Invalid derivation" }
    val mac = hmac(secret)
    var block = mac.run {
      update(salt)
      doFinal(byteArrayOf(0, 0, 0, 1))
    }
    val out = block.copyOf()
    repeat(rounds - 1) {
      block = mac.doFinal(block)
      for (i in out.indices) out[i] = (out[i].toInt() xor block[i].toInt()).toByte()
    }
    return out
  }

  fun mac(key: ByteArray, data: ByteArray): ByteArray = hmac(key).doFinal(data)

  fun seal(key: ByteArray, plain: ByteArray, additional: ByteArray): ByteArray {
    val nonce = ByteArray(NONCE).also(random::nextBytes)
    val sealed = aes(Cipher.ENCRYPT_MODE, key, nonce, additional).doFinal(plain)
    return nonce + sealed
  }

  fun open(key: ByteArray, sealed: ByteArray, additional: ByteArray): ByteArray? {
    if (sealed.size <= NONCE) return null
    return try {
      aes(Cipher.DECRYPT_MODE, key, sealed.copyOfRange(0, NONCE), additional)
        .doFinal(sealed, NONCE, sealed.size - NONCE)
    } catch (_: GeneralSecurityException) {
      null
    } catch (_: IllegalArgumentException) {
      null
    }
  }

  fun sign(pkcs8: String, text: String): String {
    val key = KeyFactory.getInstance("EC").generatePrivate(PKCS8EncodedKeySpec(Base64.getDecoder().decode(pkcs8)))
    require(key is ECPrivateKey && isP256(key.params)) { "Invalid private key" }
    val bytes = Charsets.UTF_8.newEncoder()
      .onMalformedInput(CodingErrorAction.REPORT)
      .onUnmappableCharacter(CodingErrorAction.REPORT)
      .encode(CharBuffer.wrap(text))
    val signed = Signature.getInstance("SHA256withECDSA").run {
      initSign(key)
      update(bytes)
      sign()
    }
    return Base64.getEncoder().encodeToString(signed)
  }

  fun newPair(): WorldPair {
    val pair = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }
      .generateKeyPair()
    val spki = pair.public.encoded
    val encoder = Base64.getEncoder()
    return WorldPair(
      spki = encoder.encodeToString(spki),
      pkcs8 = encoder.encodeToString(pair.private.encoded),
      fingerprint = Hashing.hex(MessageDigest.getInstance("SHA-256").digest(spki)),
    )
  }

  private fun hmac(key: ByteArray): Mac = Mac.getInstance("HmacSHA256").apply { init(SecretKeySpec(key, "HmacSHA256")) }

  private fun aes(mode: Int, key: ByteArray, nonce: ByteArray, additional: ByteArray): Cipher {
    require(key.size == 32) { "Invalid key" }
    return Cipher.getInstance("AES/GCM/NoPadding").apply {
      init(mode, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, nonce))
      updateAAD(additional)
    }
  }
}
