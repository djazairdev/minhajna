// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSyncExternalStore } from 'react';
import face from '../native/NativeMinhajnaInterface';

const KEY = 'count-minutes';
const listeners = new Set<() => void>();
let cached: boolean | undefined;

/** An optional display choice on this phone only; it never changes the plan or the history. */
export function countMinutes(): boolean {
  cached ??= face.setting(KEY) === 'true';
  return cached;
}

/** Keep first, then notify every mounted view; a failed write leaves their choice unchanged. */
export function setCountMinutes(value: boolean): void {
  face.setSetting(KEY, String(value));
  cached = value;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The saved choice, including a change made while this view remained mounted. */
export function useCountMinutes(): boolean {
  return useSyncExternalStore(subscribe, countMinutes);
}
