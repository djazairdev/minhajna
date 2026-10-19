// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Timing a confirmation on the phone (#220, answer 267): a screen's clock
// runs while it is in front and the app is open, from the moment it opens
// or from its last lap, and stops while another screen covers it or the
// app is in the background. Only the elapsed tenths are kept, with the
// school week's first day: the clock's own readings are never stored. A tap
// confirming several sessions splits its time evenly among them. Outside a
// pilot build, no timing is made or kept.

import { splitTenths, timingWeek, type Timing, type TimingKind } from '@minhajna/core';
import { NavigationContext } from '@react-navigation/native';
import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { useAppData } from '../storage/AppData';
import { useTimingStore } from './timing-store';

/** The time this screen has been in front, in tenths, since it opened or since the last lap, which starts anew. */
export function useStopwatch(): () => number {
  const navigation = useContext(NavigationContext);
  const total = useRef(0);
  const since = useRef<number | null>(null);
  useEffect(() => {
    const focused = () => navigation?.isFocused() ?? true;
    const run = () => {
      const now = performance.now();
      if (since.current !== null) total.current += now - since.current;
      const away = AppState.currentState === 'background' || AppState.currentState === 'inactive';
      since.current = focused() && !away ? now : null;
    };
    run();
    const app = AppState.addEventListener('change', run);
    const focus = navigation?.addListener('focus', run);
    const blur = navigation?.addListener('blur', run);
    return () => {
      app.remove();
      focus?.();
      blur?.();
      since.current = null;
    };
  }, [navigation]);
  return useCallback(() => {
    const now = performance.now();
    const elapsed = total.current + (since.current === null ? 0 : now - since.current);
    total.current = 0;
    if (since.current !== null) since.current = now;
    return Math.round(elapsed / 100);
  }, []);
}

export interface PilotTiming {
  /** The tenths since the clock last started, which starts it anew. */
  readonly lap: () => number;
  /** `tenths` split among `count` timings of `kind`, under this school week; none outside a pilot build. */
  readonly timings: (kind: TimingKind, count: number, tenths: number, oneTap: boolean) => Timing[];
  /** Keeps the timings; a failure to keep one costs the teacher nothing. */
  readonly keep: (timings: readonly Timing[]) => void;
}

/** The screen's clock, and the pilot's store when there is one. */
export function usePilotTiming(): PilotTiming {
  const store = useTimingStore();
  const { profile, today } = useAppData();
  const lap = useStopwatch();
  return useMemo(
    () => ({
      lap,
      timings: (kind, count, tenths, oneTap) =>
        store === null || count < 1
          ? []
          : splitTenths(tenths, count).map((each) => ({
              kind,
              week: timingWeek(today(), profile.weekStartsOn),
              tenths: each,
              oneTap,
            })),
      keep: (timings) => {
        if (store !== null && timings.length > 0) store.add(timings).catch(() => undefined);
      },
    }),
    [lap, store, today, profile.weekStartsOn],
  );
}
