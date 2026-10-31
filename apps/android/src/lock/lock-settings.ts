// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The lock's choices on this phone (#210): the delay before it locks, and
// whether screenshots are allowed on screens with pupils' records. The
// native module keeps them outside the history, so the lock screen can say
// its delay before anything opens. Every screen reading them redraws once
// one changes. A part of a screen showing a key, such as the school's recovery
// parts (#571), keeps the guard up as for a PIN pad while it shows.

import { useSyncExternalStore } from 'react';
import NativeLock, { type LockSettings } from '../native/NativeMinhajnaLock';
import { DEFAULT_LOCK_DELAY, LOCK_DELAYS } from './lock-rules';
import type { ScreenKind } from './screen-guard';

export type { LockSettings } from '../native/NativeMinhajnaLock';

let snapshot: LockSettings = { delayMinutes: DEFAULT_LOCK_DELAY, screenshots: false };
const listeners = new Set<() => void>();

/** The kept settings, as one object that stays the same until a setting changes. */
export function lockSettings(): LockSettings {
  const kept = NativeLock.settings();
  const delayMinutes = (LOCK_DELAYS as readonly number[]).includes(kept.delayMinutes)
    ? kept.delayMinutes
    : DEFAULT_LOCK_DELAY;
  const screenshots = kept.screenshots === true;
  if (delayMinutes !== snapshot.delayMinutes || screenshots !== snapshot.screenshots) {
    snapshot = { delayMinutes, screenshots };
  }
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function changed() {
  for (const listener of [...listeners]) listener();
}

/** The lock's settings, redrawn when one changes. */
export function useLockSettings(): LockSettings {
  return useSyncExternalStore(subscribe, lockSettings);
}

/** Keeps the delay, 1, 5 or 15 minutes; the automatic lock counts with it at once. */
export async function setLockDelay(minutes: number): Promise<void> {
  await NativeLock.setDelay(minutes);
  changed();
}

/** Keeps whether screenshots are allowed, and applies it to the screen in front. */
export async function allowScreenshots(allowed: boolean): Promise<void> {
  await NativeLock.allowScreenshots(allowed);
  changed();
}

/** What the screen in front is, and how many keys show on it. */
let front: ScreenKind = 'records';
let keys = 0;

/** Tells the native guard what kind of screen is in front; a key showing keeps it guarded as a PIN pad. */
export function guardScreen(kind: ScreenKind): void {
  front = kind;
  NativeLock.showing(keys > 0 ? 'pin' : kind);
}

/** Guards the screen as a PIN pad while a key shows on it, until the answer is called. */
export function guardKey(): () => void {
  keys += 1;
  NativeLock.showing('pin');
  let shown = true;
  return () => {
    if (!shown) return;
    shown = false;
    keys -= 1;
    NativeLock.showing(keys > 0 ? 'pin' : front);
  };
}
