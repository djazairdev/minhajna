// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Use of the app, for the automatic lock (#210). A touch reaches the app's
// root view, but typing on the phone's keyboard does not, so text fields
// report each change here: a long note is never locked away while it is
// being typed.

type Listener = () => void;

const listeners = new Set<Listener>();

/** Says the teacher is using the app now. */
export function noteUse(): void {
  for (const listener of listeners) listener();
}

/** Calls `listener` on each use until the returned function is called. */
export function onUse(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
