// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The lock's choices on this phone (#210): the delay before it locks, and
// whether screenshots are allowed on screens with pupils' records. The
// native module keeps them outside the history, so the lock screen can say
// its delay before anything opens. Every screen reading them redraws once
// one changes.

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

/** Tells the native guard what kind of screen is in front. */
export function guardScreen(kind: ScreenKind): void {
  NativeLock.showing(kind);
}
