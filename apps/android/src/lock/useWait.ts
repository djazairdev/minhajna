// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The wait after repeated wrong PINs (#210), read from the native module
// each second and when the app comes back to the front. Its clock counts
// time asleep and ignores a change of the phone's time, so the wait ends
// when the device says, never earlier or later.

import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Spec as Storage } from '../native/NativeMinhajnaStorage';
import { errorCode } from './lock-rules';

/** Seconds left before another PIN may be tried, and a way to start a wait; `onOver` runs once it ends. */
export function useWait(
  storage: Storage,
  initial: number,
  onOver: () => void,
): readonly [number, (seconds: number) => void] {
  const [wait, setWait] = useState(initial);
  const over = useRef(onOver);
  useEffect(() => {
    over.current = onOver;
  }, [onOver]);

  const waiting = wait > 0;
  useEffect(() => {
    if (!waiting) return;
    let live = true;
    const tick = () => {
      storage.lockStatus().then(
        (status) => {
          if (!live) return;
          setWait(status.waitSeconds);
          if (status.waitSeconds === 0) over.current();
        },
        (error: unknown) => {
          if (__DEV__) console.warn('The lock status did not read', errorCode(error));
        },
      );
    };
    const timer = setInterval(tick, 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      live = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [storage, waiting]);

  return [wait, setWait];
}
