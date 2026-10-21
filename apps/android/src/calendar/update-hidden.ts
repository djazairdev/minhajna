// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The calendar update whose Today card the teacher hid (answer 311): kept
// on this phone only, outside the history, and replaced by the next one.

import { useSyncExternalStore } from 'react';
import face from '../native/NativeMinhajnaInterface';

const KEY = 'calendar-update-hidden';
const listeners = new Set<() => void>();
let cached: string | null | undefined;

/** The release whose card is hidden, or null. */
export function hiddenUpdate(): string | null {
  if (cached === undefined) cached = face.setting(KEY) ?? null;
  return cached;
}

/** Keeps the release first, then tells every mounted view. */
export function hideUpdate(release: string): void {
  face.setSetting(KEY, release);
  cached = release;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The hidden release, including one hidden while this view stayed mounted. */
export function useHiddenUpdate(): string | null {
  return useSyncExternalStore(subscribe, hiddenUpdate);
}
