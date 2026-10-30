// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

package dz.minhajna.preview.storage

/**
 * Which demo world is open, if any (#558, choice D4 of the 0.7.0 demo).
 * While one is, the teacher's own history is closed and refuses to open or
 * to be read or written, the teacher's lock refuses every call that reads
 * or changes it, and erasing the device waits until the world is left: a
 * world's data lives only in the world's own store ([MinhajnaWorldModule]),
 * and nothing of it reaches the teacher's records or lock. A restart of the
 * app leaves the world.
 */
object WorldGate {

  @Volatile
  var world: String? = null
    private set

  val isOpen: Boolean
    get() = world != null

  fun enter(id: String) {
    world = id
  }

  fun leave() {
    world = null
  }

  /** Throws [WorldOpenException] while a world is open. */
  fun refuse() {
    if (isOpen) throw WorldOpenException()
  }
}

/** An error the modules answer with its own code. */
interface Coded {
  val code: String
}

/** The teacher's own history was asked for while a demo world is open. */
class WorldOpenException : IllegalStateException("A demo world is open: the teacher's history stays closed"), Coded {
  override val code = "E_WORLD"
}
