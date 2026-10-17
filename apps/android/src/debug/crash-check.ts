// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The crash check for #19: killing the app during a write must lose nothing
// already confirmed (PRD §6.8). The app writes synthetic notes to a throwaway
// history, without end, and logs each one once its write is confirmed. A
// script kills the app at a random moment, starts it again and asks it to
// verify: the history must open, verify, and hold every confirmed note.

import { HistoryLog, parseDay } from '@minhajna/core';
import type { Spec as StorageSpec } from '../native/NativeMinhajnaStorage';
import type { Spec as CheckSpec } from '../native/NativeMinhajnaStorageCheck';
import { nativeDeps, nativeStore } from '../storage/history';
import { throwawaySpec } from './storage-check';

/** The throwaway history the crash check writes to, kept between runs until deleted. */
export const CRASH_HISTORY = 'crash';

async function openCrashLog(storage: StorageSpec, check: CheckSpec): Promise<HistoryLog> {
  const spec = throwawaySpec(storage, check, CRASH_HISTORY);
  await spec.openHistory();
  return HistoryLog.open(nativeStore(spec), nativeDeps(storage));
}

/**
 * Adds notes one after the other until `stop` says so, reporting each entry's
 * sequence number once its write is confirmed.
 */
export async function writeUntilStopped(
  storage: StorageSpec,
  check: CheckSpec,
  stop: () => boolean,
  confirmed: (seq: number) => void,
): Promise<number> {
  const history = await openCrashLog(storage, check);
  const day = parseDay('2026-10-01');
  while (!stop()) {
    const entry = await history.append(day, 'lesson-record', 'note', { text: 'Synthetic crash-check note' });
    confirmed(entry.seq);
  }
  return history.entries.length;
}

/** Opens the crash history, which must verify, and returns how many entries it holds. */
export async function verifyCrashHistory(storage: StorageSpec, check: CheckSpec): Promise<number> {
  return (await openCrashLog(storage, check)).entries.length;
}
