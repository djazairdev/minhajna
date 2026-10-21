// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.signature

import androidx.test.ext.junit.runners.AndroidJUnit4
import java.security.KeyPairGenerator
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.Base64
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Signatures as the founder's Node signing tool makes them must check on the
 * phone. The fixed vector below was signed by Node with a key made for it
 * and thrown away: only its public half and the signature are kept. Other
 * keys are made at runtime and never stored.
 */
@RunWith(AndroidJUnit4::class)
class SignatureCheckTest {
  private val spki =
    "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEymYpxgDXCIP8zaFcbyk2KP+JyaGt1nOFFIOB14l6CITa472mB5bY/99O9RX9LRsJmkwc/JT5UEAISIeTpVqEKw=="
  private val payload = "{\"example\":\"مثال تجريبي\",\"n\":1}"
  private val signature =
    "MEUCIQC0vcGyJbEQAbSCWkiGhomYCprwShCGqLCUbwyhgxCstAIgQ5h7q3l4dK48+TmctmXx/ZNZk8Slmvl30cDlAK7dXGA="
  private val spkiP384 =
    "MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEWW28yKRjhpa70BvWqvy/44holHG9M2Qsg62OtDwdV1ZJJ5DvfjL7/foXbzyRMTHAOIIqj5Co+09Xp+2ngeFKquzeRCSnr0+p5vWTAabaRTFURJN4UjyvQsrV8hUCFmte"
  private val signatureP384 =
    "MGYCMQDJF65/UxNQ2c6MH5zWnfvCQpgNu3RWuQe+q09JjqxVRGQ/kGWJyHEYJqK4ORSqqB4CMQDHHzB0uFza6euOISTdmZyZDfeBGWWoN/DfGTRr+CoiN5jbKJw8yw3fBeqmOkTbjHg="

  @Test
  fun checksASignatureMadeByNode() {
    assertTrue(verifies(spki, payload, signature))
  }

  @Test
  fun refusesAChangedPayloadOrAnotherKey() {
    assertFalse(verifies(spki, payload.replace("1", "2"), signature))
    assertFalse(verifies(spki, "$payload ", signature))
    val other = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()
    assertFalse(verifies(Base64.getEncoder().encodeToString(other.public.encoded), payload, signature))
  }

  @Test
  fun checksASignatureMadeOnThePhone() {
    val pair = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()
    val signed = Signature.getInstance("SHA256withECDSA").run {
      initSign(pair.private)
      update(payload.toByteArray(Charsets.UTF_8))
      sign()
    }
    val encoder = Base64.getEncoder()
    assertTrue(verifies(encoder.encodeToString(pair.public.encoded), payload, encoder.encodeToString(signed)))
  }

  @Test
  fun refusesAnotherCurveAndMalformedInput() {
    assertFalse(verifies(spkiP384, payload, signatureP384))
    assertFalse(verifies("not base64!", payload, signature))
    assertFalse(verifies(spki, payload, "not base64!"))
    assertFalse(verifies(spki, payload, "AAAA"))
    assertFalse(verifies("", payload, signature))
    assertFalse(verifies(spki, payload, ""))
  }
}
