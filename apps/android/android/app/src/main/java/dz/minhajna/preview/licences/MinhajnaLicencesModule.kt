// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.licences

import android.content.res.AssetManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import dz.minhajna.preview.BuildConfig
import dz.minhajna.preview.storage.NativeMinhajnaLicencesSpec
import java.util.concurrent.Executors

/** Reads only public APK assets, on a worker, without storage or network access. */
class MinhajnaLicencesModule(context: ReactApplicationContext) : NativeMinhajnaLicencesSpec(context) {
  private val assets = context.assets
  private val worker = Executors.newSingleThreadExecutor { task -> Thread(task, "minhajna-licences") }

  override fun readNotices(promise: Promise) {
    worker.execute {
      try {
        val notices = Arguments.createArray()
        for (notice in bundledNotices(assets)) {
          notices.pushMap(Arguments.createMap().apply {
            putString("name", notice.name)
            putString("text", notice.text)
          })
        }
        promise.resolve(Arguments.createMap().apply {
          putString("version", BuildConfig.VERSION_NAME)
          putArray("notices", notices)
        })
      } catch (e: Exception) {
        promise.reject("E_LICENCES", "Bundled notices could not be read", e)
      }
    }
  }

  override fun invalidate() {
    worker.shutdown()
    super.invalidate()
  }
}

/** A verbatim UTF-8 file from the public licences asset directory. */
internal data class BundledNotice(val name: String, val text: String)

/** Sorted discovery has no filename allowlist: new notices appear in the next build. */
internal fun bundledNotices(assets: AssetManager): List<BundledNotice> {
  return collectNotices(checkNotNull(assets.list("licenses")).toList()) { name ->
    assets.open("licenses/$name").bufferedReader(Charsets.UTF_8).use { it.readText() }
  }
}

/** Keeps discovery testable with new names and non-ASCII text, without real files or records. */
internal fun collectNotices(names: List<String>, readText: (String) -> String): List<BundledNotice> {
  check(names.contains("minhajna.txt")) { "The app licence is missing" }
  return names.sorted().map { name -> BundledNotice(name, readText(name)) }
}
