// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pilot's own timings on this phone (#220, choice P7, answer 267): kept
// by the native module in a table of their own beside the history, never in
// it, so they travel nowhere and clearing them deletes them. Screens reach
// them through `PilotTimings`; with none given, as outside a pilot build or
// in a screen's own test, nothing is timed. Each batch is checked before it
// is kept, its week the school week's first day, so no single day is kept.

import { readTimings, type Timing, type Weekday } from '@minhajna/core';
import { createContext, useContext } from 'react';
import type { Spec as Storage } from '../native/NativeMinhajnaStorage';

export interface TimingStore {
  /** Every timing kept, oldest first. */
  load(): Promise<Timing[]>;
  /** Keeps the timings, all or none. */
  add(timings: readonly Timing[]): Promise<void>;
  /** Deletes every timing. */
  clear(): Promise<void>;
}

/** The store over the app's native module, for a school week starting on `weekStartsOn`. */
export function timingStore(
  storage: Pick<Storage, 'loadTimings' | 'addTimings' | 'clearTimings'>,
  weekStartsOn: Weekday,
): TimingStore {
  return {
    load: async () => readTimings(JSON.parse(await storage.loadTimings()) as unknown, weekStartsOn),
    add: async (timings) => {
      const checked = readTimings(timings, weekStartsOn);
      if (checked.length > 0) await storage.addTimings(JSON.stringify(checked));
    },
    clear: () => storage.clearTimings(),
  };
}

export const PilotTimings = createContext<TimingStore | null>(null);

/** The pilot's timing store, or null when nothing is timed. */
export function useTimingStore(): TimingStore | null {
  return useContext(PilotTimings);
}
