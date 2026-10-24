// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The day the backup reminder was put off to (#247, answer 482): by
// «تذكيري لاحقاً», 7 days on, or by a restore, 30 days on. It is kept on this
// phone only, outside the history, and never logged. A value that cannot be
// read counts as none.

import { BACKUP_REMINDER_DAYS, addDays, parseDay, type Day } from '@minhajna/core';
import { useSyncExternalStore } from 'react';
import face from '../native/NativeMinhajnaInterface';

const KEY = 'backup-later';
const listeners = new Set<() => void>();
let cached: Day | null | undefined;

/** The day the reminder was put off to, or null. */
export function backupLater(): Day | null {
  if (cached !== undefined) return cached;
  try {
    cached = parseDay(face.setting(KEY) ?? '');
  } catch {
    cached = null;
  }
  return cached;
}

/** Puts the reminder off to `day`, or clears that with null; a failed write throws and changes nothing. */
export function setBackupLater(day: Day | null): void {
  face.setSetting(KEY, day ?? '');
  cached = day;
  for (const listener of listeners) listener();
}

/** Puts the reminder off 30 days from a restore on `day`; false when it could not be kept, which leaves the restore. */
export function putOffFromRestore(day: Day): boolean {
  try {
    setBackupLater(addDays(day, BACKUP_REMINDER_DAYS));
    return true;
  } catch {
    return false;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The day the reminder was put off to, including a change made while this view stays mounted. */
export function useBackupLater(): Day | null {
  return useSyncExternalStore(subscribe, backupLater);
}
