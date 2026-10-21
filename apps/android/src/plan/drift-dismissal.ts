// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تجاهل» on the drift warning (#225, R-4.7-37, answer 293): kept on this
// phone only, outside the history, for each class, as the day of the common
// test or exam window and the gap it was dismissed at. The warning comes
// back for a later test or window, or once the gap grows. Entries for days
// already past are dropped whenever one is kept.

import { compareDays, type Day, type Drift } from '@minhajna/core';
import { useSyncExternalStore } from 'react';
import face from '../native/NativeMinhajnaInterface';

const KEY = 'drift-dismissed';
const listeners = new Set<() => void>();
type Dismissed = Readonly<Record<string, { readonly day: Day; readonly gap: number }>>;
let cached: Dismissed | undefined;

function read(): Dismissed {
  if (cached !== undefined) return cached;
  try {
    const value: unknown = JSON.parse(face.setting(KEY) ?? '{}');
    cached = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Dismissed) : {};
  } catch {
    cached = {};
  }
  return cached;
}

/** Whether the teacher dismissed this drift: the same test or window, and a gap no larger. */
export function isDismissed(dismissed: Dismissed, courseId: string, drift: Drift): boolean {
  const one = dismissed[courseId];
  return one !== undefined && one.day === drift.before.day && drift.gap <= one.gap;
}

/** Keeps the dismissal first, then notifies every mounted view. */
export function dismissDrift(courseId: string, drift: Drift, today: Day): void {
  const kept = Object.fromEntries(
    Object.entries(read()).filter(([id, one]) => id !== courseId && compareDays(one.day, today) >= 0),
  );
  const next = { ...kept, [courseId]: { day: drift.before.day, gap: drift.gap } };
  face.setSetting(KEY, JSON.stringify(next));
  cached = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The dismissals kept on this phone, including one made while this view stays mounted. */
export function useDismissedDrifts(): Dismissed {
  return useSyncExternalStore(subscribe, read);
}
