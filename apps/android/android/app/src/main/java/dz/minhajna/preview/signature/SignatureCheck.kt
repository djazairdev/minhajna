// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.signature

import java.security.AlgorithmParameters
import java.security.KeyFactory
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.X509EncodedKeySpec
import java.util.Base64

/** The P-256 curve as the platform names it: its field, coefficients, base point, order and cofactor. */
private val P256: ECParameterSpec by lazy {
  AlgorithmParameters.getInstance("EC").run {
    init(ECGenParameterSpec("secp256r1"))
    getParameterSpec(ECParameterSpec::class.java)
  }
}

private fun isP256(params: ECParameterSpec): Boolean =
  params.curve == P256.curve &&
    params.generator == P256.generator &&
    params.order == P256.order &&
    params.cofactor == P256.cofactor

/**
 * Whether `signature` (DER, base64) is an ECDSA P-256 signature over SHA-256
 * of the payload's UTF-8 bytes by the public key `spki` (SubjectPublicKeyInfo,
 * DER, base64), with Android's own crypto (#223, answer 303). A key on
 * another curve, a malformed key or signature, or any error is a signature
 * that does not check, never an exception.
 */
fun verifies(spki: String, payload: String, signature: String): Boolean =
  try {
    val key = KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(Base64.getDecoder().decode(spki)))
    if (key !is ECPublicKey || !isP256(key.params)) {
      false
    } else {
      Signature.getInstance("SHA256withECDSA").run {
        initVerify(key)
        update(payload.toByteArray(Charsets.UTF_8))
        verify(Base64.getDecoder().decode(signature))
      }
    }
  } catch (e: Exception) {
    false
  }
