// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.calendar

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.view.TextureView
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.ScrollView
import androidx.core.view.ViewCompat

/** An unexported, secure scan window. Permission is requested only here; Back and backgrounding release the camera. */
class CalendarScanActivity : Activity() {
  private lateinit var camera: CalendarCamera
  private var active = false
  private var finished = false
  private var asked = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    val pad = (16 * resources.displayMetrics.density).toInt()
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(Color.rgb(250, 247, 241))
      setPadding(pad, pad, pad, pad)
      layoutDirection = if (intent.getBooleanExtra("rtl", false)) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR
    }
    val title = TextView(this).apply {
      text = intent.getStringExtra("title") ?: ""
      textSize = 24f
      setTextColor(Color.BLACK)
      ViewCompat.setAccessibilityHeading(this, true)
    }
    val instruction = TextView(this).apply {
      text = intent.getStringExtra("instruction") ?: ""
      textSize = 18f
      setTextColor(Color.BLACK)
    }
    val preview = TextureView(this).apply { importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO }
    val cancel = Button(this).apply {
      text = intent.getStringExtra("cancel") ?: ""
      textSize = 18f
      minimumHeight = (48 * resources.displayMetrics.density).toInt()
      setOnClickListener { finish() }
    }
    root.addView(title)
    root.addView(instruction)
    root.addView(preview, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,
      (280 * resources.displayMetrics.density).toInt()))
    root.addView(cancel)
    root.setOnApplyWindowInsetsListener { view, insets ->
      view.setPadding(pad + insets.systemWindowInsetLeft, pad + insets.systemWindowInsetTop,
        pad + insets.systemWindowInsetRight, pad + insets.systemWindowInsetBottom)
      insets
    }
    val scroll = ScrollView(this).apply {
      isFillViewport = true
      addView(root)
    }
    setContentView(scroll)
    camera = CalendarCamera(this, preview, { text -> runOnUiThread {
      if (active && !finished) {
        finished = true
        setResult(RESULT_OK, Intent().putExtra("text", text))
        finish()
      }
    } }, { runOnUiThread { refuse() } })
  }

  override fun onResume() {
    super.onResume()
    active = true
    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) camera.start()
    else if (!asked) {
      asked = true
      requestPermissions(arrayOf(Manifest.permission.CAMERA), 1)
    } else refuse()
  }

  override fun onPause() {
    active = false
    camera.stop()
    super.onPause()
  }

  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grants: IntArray) {
    super.onRequestPermissionsResult(requestCode, permissions, grants)
    if (requestCode != 1) return
    if (grants.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
      if (active) camera.start()
    } else refuse()
  }

  private fun refuse() {
    if (finished) return
    finished = true
    setResult(RESULT_FIRST_USER)
    finish()
  }
}
