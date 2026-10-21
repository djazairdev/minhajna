// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Ramadan cards the teacher hid on Today (answer 336): kept on this
// phone only, outside the history, as the Ramadan, its first day and the
// lengths they showed, so new lengths or another Ramadan bring them back.

import { useSyncExternalStore } from 'react';
import face from '../native/NativeMinhajnaInterface';

const KEY = 'ramadan-cards-hidden';
const listeners = new Set<() => void>();
let cached: string | null | undefined;

/** What the hidden cards showed, or null. */
export function hiddenRamadan(): string | null {
  if (cached === undefined) cached = face.setting(KEY) ?? null;
  return cached;
}

/** Keeps it first, then tells every mounted view. */
export function hideRamadan(shown: string): void {
  face.setSetting(KEY, shown);
  cached = shown;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** What the hidden cards showed, including cards hidden while this view stayed mounted. */
export function useHiddenRamadan(): string | null {
  return useSyncExternalStore(subscribe, hiddenRamadan);
}
