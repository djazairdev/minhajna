// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.signature

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import dz.minhajna.preview.storage.WorldGate
import java.nio.CharBuffer
import java.nio.charset.CodingErrorAction
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.util.Base64

/**
 * A teacher's P-256 key (#437, PRD §5.5, §6.5), distinct from the database's
 * wrapping keys. The private half never exports, enters a file, backup or
 * transfer, or leaves Android's Keystore. A new phone makes a new key;
 * reader mode must check its continuity, not treat a signature as identity
 * or state certification. Device erasure (#248) must delete ALIAS too.
 * Invalid existing entries fail; they are never silently replaced. While a
 * demo world is open (#558), the teacher's key neither signs nor answers
 * with its public half, so nothing a world makes carries it.
 */
class TeacherSigningKey(private val alias: String = ALIAS) {
  fun publicKey(): String {
    WorldGate.refuse()
    return Base64.getEncoder().encodeToString(entry().certificate.publicKey.encoded)
  }

  fun sign(payload: String): String {
    WorldGate.refuse()
    val bytes = signatureBytes(payload, 65_536)
    return Signature.getInstance("SHA256withECDSA").run {
      initSign(entry().privateKey)
      update(bytes)
      Base64.getEncoder().encodeToString(sign())
    }
  }

  private fun entry(): KeyStore.PrivateKeyEntry = synchronized(TeacherSigningKey::class.java) {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    if (!store.containsAlias(alias)) {
      val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
        .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
        .setDigests(KeyProperties.DIGEST_SHA256)
        .build()
      KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore").apply {
        initialize(spec)
      }.generateKeyPair()
    }
    val stored = store.getEntry(alias, null) as? KeyStore.PrivateKeyEntry
      ?: throw IllegalStateException("Signing key unavailable")
    val public = stored.certificate.publicKey
    check(public is ECPublicKey && isP256(public.params) && stored.privateKey.algorithm == "EC") {
      "Signing key unavailable"
    }
    stored
  }

  companion object {
    const val ALIAS = "minhajna-teacher-signing-v1"
  }
}

/** Shared UTF-8 bounds for signing and QR: never replace malformed Unicode with different bytes. */
internal fun signatureBytes(text: String, limit: Int): ByteArray {
  require(text.isNotEmpty() && text.length <= limit) { "Invalid signing text" }
  val encoded = Charsets.UTF_8.newEncoder()
    .onMalformedInput(CodingErrorAction.REPORT)
    .onUnmappableCharacter(CodingErrorAction.REPORT)
    .encode(CharBuffer.wrap(text))
  require(encoded.remaining() <= limit) { "Signing text exceeds limit" }
  return ByteArray(encoded.remaining()).also(encoded::get)
}
