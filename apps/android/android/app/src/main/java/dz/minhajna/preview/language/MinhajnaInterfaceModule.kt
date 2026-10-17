// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.language

import android.view.View
import android.view.ViewTreeObserver
import android.view.accessibility.AccessibilityNodeInfo
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.IllegalViewOperationException
import com.facebook.react.uimanager.UIManagerHelper
import dz.minhajna.preview.storage.NativeMinhajnaInterfaceSpec

/** Native interface settings and presentation; only [InterfaceLanguage] keeps a preference. */
class MinhajnaInterfaceModule(context: ReactApplicationContext) : NativeMinhajnaInterfaceSpec(context) {
  private var focusRequest = 0L
  private var pendingFocus: (() -> Unit)? = null

  override fun language(): String? = InterfaceLanguage.language(reactApplicationContext)

  override fun setLanguage(code: String) = InterfaceLanguage.set(reactApplicationContext, code)

  /** Reloads React Native, which reads the direction again as it starts. */
  override fun restart() {
    val host = (reactApplicationContext.applicationContext as ReactApplication).reactHost ?: return
    UiThreadUtil.runOnUiThread { host.reload("The interface language changed direction") }
  }

  /**
   * React Native 0.87 gates View.focus behind a disabled flag. Request actual
   * Android focus in touch mode and accessibility focus on the same target.
   * Removed views are an expected close/navigation race, not an app error.
   */
  override fun focusView(reactTag: Double) {
    if (!reactTag.isFinite() || reactTag <= 0 || reactTag.toInt().toDouble() != reactTag) return
    UiThreadUtil.runOnUiThread {
      clearFocusRequest()
      val view = try {
        UIManagerHelper.getUIManagerForReactTag(reactApplicationContext, reactTag.toInt())
          ?.resolveView(reactTag.toInt())
      } catch (_: IllegalViewOperationException) {
        null
      }
      if (view != null && view.isAttachedToWindow && view.isShown && view.isEnabled) queueFocus(view)
    }
  }

  /** Waits for the target window, then its next frame; detachment or another request removes every listener. */
  private fun queueFocus(view: View) {
    val request = focusRequest
    val observer = view.viewTreeObserver
    val apply = Runnable {
      if (request != focusRequest) return@Runnable
      if (!view.isAttachedToWindow || !view.isShown || !view.isEnabled) {
        clearFocusRequest()
        return@Runnable
      }
      if (!view.hasWindowFocus()) return@Runnable
      clearFocusRequest()
      view.isFocusableInTouchMode = true
      view.requestFocus()
      view.performAccessibilityAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS, null)
    }
    val window = ViewTreeObserver.OnWindowFocusChangeListener { hasFocus ->
      if (hasFocus && request == focusRequest) view.postOnAnimation(apply)
    }
    val attachment = object : View.OnAttachStateChangeListener {
      override fun onViewAttachedToWindow(target: View) = Unit
      override fun onViewDetachedFromWindow(target: View) {
        if (request == focusRequest) clearFocusRequest()
      }
    }
    pendingFocus = {
      if (observer.isAlive) observer.removeOnWindowFocusChangeListener(window)
      view.removeOnAttachStateChangeListener(attachment)
      view.removeCallbacks(apply)
    }
    observer.addOnWindowFocusChangeListener(window)
    view.addOnAttachStateChangeListener(attachment)
    view.postOnAnimation(apply)
  }

  /** Invalidates queued UI work and releases any window listener and target. UI thread only. */
  private fun clearFocusRequest() {
    focusRequest += 1
    pendingFocus?.invoke()
    pendingFocus = null
  }

  /** Reopening or leaving a screen must cancel its pending window-focus request. */
  override fun cancelFocusRequest() {
    UiThreadUtil.runOnUiThread { clearFocusRequest() }
  }

  /** A destroyed React instance must never deliver a queued UI request. */
  override fun invalidate() {
    cancelFocusRequest()
    super.invalidate()
  }

  /** Android logs the time since launch, as "Fully drawn", for timing a start on any phone. */
  override fun reportFullyDrawn() {
    val activity = reactApplicationContext.currentActivity ?: return
    UiThreadUtil.runOnUiThread { activity.reportFullyDrawn() }
  }
}
