// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.signature

import dz.minhajna.preview.storage.Hashing
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.interfaces.ECPublicKey
import java.security.spec.X509EncodedKeySpec
import java.util.Base64

/** Hashes decoded SPKI bytes, as the reference-data tooling does, never their base64 text. */
internal fun signingKeyFingerprint(spki: String): String {
  require(spki.length in 1..200) { "Invalid public key" }
  val bytes = Base64.getDecoder().decode(spki)
  val key = KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(bytes))
  require(key is ECPublicKey && isP256(key.params)) { "Invalid public key" }
  return Hashing.hex(MessageDigest.getInstance("SHA-256").digest(bytes))
}
