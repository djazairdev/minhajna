// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The automatic lock (R-6.4-05, #210): once the app has gone unused for the
// teacher's delay, it locks. A touch anywhere and any change in a text field
// count as use. The check runs every few seconds while the app shows, and at
// once when it comes back to the front, so time spent behind another app
// counts too. A clock moved back locks, rather than waiting longer.

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { onUse } from './activity';
import { idleLongEnough } from './lock-rules';

/** How often the delay is checked while the app shows, in milliseconds. */
export const CHECK_EVERY = 10_000;

/** Calls `lock` once the app has gone unused for `minutes`, while `active`. */
export function useAutoLock(active: boolean, minutes: number, lock: () => void, now: () => number = Date.now): void {
  const latest = useRef(lock);
  useEffect(() => {
    latest.current = lock;
  }, [lock]);
  useEffect(() => {
    if (!active) return;
    let lastUsed = now();
    let locked = false;
    const check = () => {
      if (locked || !idleLongEnough(lastUsed, now(), minutes)) return;
      locked = true;
      latest.current();
    };
    const stopUse = onUse(() => {
      lastUsed = now();
    });
    const timer = setInterval(check, CHECK_EVERY);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      stopUse();
      clearInterval(timer);
      subscription.remove();
    };
  }, [active, minutes, now]);
}
