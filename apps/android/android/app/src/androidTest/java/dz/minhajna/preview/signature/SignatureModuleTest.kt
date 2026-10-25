// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.signature

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.ReadableMap
import java.lang.reflect.InvocationHandler
import java.lang.reflect.Method
import java.lang.reflect.Proxy
import java.security.KeyStore
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/** Actual worker and bridge values, with an injected test alias instead of the production teacher key. */
@RunWith(AndroidJUnit4::class)
class SignatureModuleTest {
  private val alias = "minhajna-test-teacher-${UUID.randomUUID()}"

  @After
  fun removeOnlyThisTestsKey() {
    KeyStore.getInstance("AndroidKeyStore").apply {
      load(null)
      deleteEntry(alias)
    }
  }

  private fun module(): MinhajnaSignatureModule = MinhajnaSignatureModule(
    BridgeReactContext(InstrumentationRegistry.getInstrumentation().targetContext), TeacherSigningKey(alias),
  )

  @Test
  fun resolvesBridgeValuesAndRejectsNewCallsAfterShutdown() {
    val module = module()
    try {
      val public = Reply().apply { module.teacherKey(promise); await() }.value as String
      val payload = "{\"example\":1}"
      val signed = Reply().apply { module.sign(payload, promise); await() }.value as String
      assertTrue(verifies(public, payload, signed))
      val fingerprint = Reply().apply { module.keyFingerprint(public, promise); await() }.value as String
      assertEquals(signingKeyFingerprint(public), fingerprint)
      val qr = Reply().apply { module.qrMatrix(payload, promise); await() }.value as ReadableMap
      assertTrue(qr.getInt("size") in 29..125)
      assertEquals(qr.getInt("size"), qr.getArray("rows")!!.size())
    } finally {
      module.invalidate()
    }
    val closed = Reply().apply { module.teacherKey(promise); await() }
    assertEquals(listOf("E_SIGNATURE_CLOSED", "Signing service unavailable"), closed.failure)
    val verify = Reply().apply { module.verify("bad", "example", "bad", promise); await() }
    assertEquals(false, verify.value)
  }

  @Test
  fun rejectsWithFixedMessagesAndNoThrowableOrPayload() {
    val module = module()
    try {
      val signing = Reply().apply { module.sign("\ud800", promise); await() }
      assertEquals(listOf("E_SIGNING", "Signing failed"), signing.failure)
      val fingerprint = Reply().apply { module.keyFingerprint("Invented private detail", promise); await() }
      assertEquals(listOf("E_SIGNING", "Signing failed"), fingerprint.failure)
      val qr = Reply().apply { module.qrMatrix("x".repeat(997), promise); await() }
      assertEquals(listOf("E_QR", "QR encoding failed"), qr.failure)
    } finally {
      module.invalidate()
    }
  }
}

/** Captures the exact Promise overload used; a reject carrying a Throwable would fail the equality checks. */
private class Reply : InvocationHandler {
  private val ready = CountDownLatch(1)
  var value: Any? = null
  var failure: List<Any?>? = null
  val promise = Proxy.newProxyInstance(Promise::class.java.classLoader, arrayOf(Promise::class.java), this) as Promise

  override fun invoke(proxy: Any, method: Method, args: Array<out Any?>?): Any? {
    when (method.name) {
      "resolve" -> { value = args?.get(0); ready.countDown() }
      "reject" -> { failure = args?.toList(); ready.countDown() }
    }
    return null
  }

  fun await() {
    assertTrue("Native reply timed out", ready.await(10, TimeUnit.SECONDS))
  }
}
