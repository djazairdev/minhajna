// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.world

import dz.minhajna.preview.signature.isP256
import dz.minhajna.preview.storage.Hashing
import java.math.BigInteger
import java.nio.CharBuffer
import java.nio.charset.CodingErrorAction
import java.security.GeneralSecurityException
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.Signature
import java.security.interfaces.ECPrivateKey
import java.security.interfaces.ECPublicKey
import java.security.spec.ECFieldFp
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECPoint
import java.security.spec.ECPublicKeySpec
import java.security.spec.PKCS8EncodedKeySpec
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyAgreement
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/** A world's new pair, as WorldKit.newPair gives it. */
data class WorldPair(val spki: String, val pkcs8: String, val fingerprint: String)

/** A new pair for key agreement, as WorldKit.newAgreement gives it: the uncompressed point, and PKCS #8. */
class WorldAgreement(val publicKey: ByteArray, val pkcs8: String)

/**
 * The cryptography a demo world needs on the phone (#561, answers 568 and
 * 572), byte for byte as the PC's Web Crypto: PBKDF2-HMAC-SHA256 to 32
 * bytes, written out over HMAC so no provider reads the secret as text;
 * HMAC-SHA256; AES-256-GCM with a fresh random 12-byte nonce first and a
 * 128-bit tag; ECDSA P-256 over SHA-256; and ECDH P-256 for the key
 * agreement that seals the school key to a device (answer 595), its public
 * half the uncompressed point and a point off the curve refused; all with
 * software keys, never the Keystore's, since a world's keys are made up and
 * travel sealed with it.
 * A seal that does not open gives null; any other failure throws.
 */
object WorldCrypto {
  private const val NONCE = 12
  private const val TAG_BITS = 128
  private const val MOST_ROUNDS = 1_000_000
  private const val POINT = 65
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

  fun newAgreement(): WorldAgreement {
    val pair = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }
      .generateKeyPair()
    val point = (pair.public as ECPublicKey).w
    val publicKey = byteArrayOf(4) + fixed(point.affineX) + fixed(point.affineY)
    return WorldAgreement(publicKey, Base64.getEncoder().encodeToString(pair.private.encoded))
  }

  fun agree(pkcs8: String, publicKey: ByteArray): ByteArray {
    val own = KeyFactory.getInstance("EC").generatePrivate(PKCS8EncodedKeySpec(Base64.getDecoder().decode(pkcs8)))
    require(own is ECPrivateKey && isP256(own.params)) { "Invalid private key" }
    require(publicKey.size == POINT && publicKey[0] == 4.toByte()) { "Invalid public key" }
    val x = BigInteger(1, publicKey.copyOfRange(1, 33))
    val y = BigInteger(1, publicKey.copyOfRange(33, POINT))
    val curve = own.params.curve
    val p = (curve.field as ECFieldFp).p
    require(x < p && y < p && y.pow(2).mod(p) == x.pow(3).add(curve.a.multiply(x)).add(curve.b).mod(p)) {
      "Not on the curve"
    }
    val theirs = KeyFactory.getInstance("EC").generatePublic(ECPublicKeySpec(ECPoint(x, y), own.params))
    val secret = KeyAgreement.getInstance("ECDH").run {
      init(own)
      doPhase(theirs, true)
      generateSecret()
    }
    require(secret.size == 32) { "Invalid secret" }
    return secret
  }

  /** A coordinate as its 32 bytes, big-endian. */
  private fun fixed(value: BigInteger): ByteArray {
    val bytes = value.toByteArray().dropWhile { it == 0.toByte() }.toByteArray()
    return ByteArray(32 - bytes.size) + bytes
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
