// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Taking the working copy back from the other device (#250, answers 503,
// 514 and 515): its transfer file under the one-time key, or its backup
// under the recovery key, read and checked as a restore reads them, then
// taken only if it continues this device's history. What the other device
// recorded since is added after this device's own entries, then the end of
// the handover, all in one write: a take-back that fails stores nothing,
// so it can simply be tried again. The content its erasures name is erased
// as the history reopens, which the app does once it is stored.

import { HandoverError, HistoryError, takenBack, type Entry } from '@minhajna/core';
import type { Spec as Storage } from '../native/NativeMinhajnaStorage';
import { toRow } from '../storage/history';
import { openedFile, type RestoreDeps, type RestoreInput, type RestoreResult } from './restore-run';

export interface TakeBackDeps extends Pick<RestoreDeps, 'files' | 'deps'> {
  readonly storage: Pick<Storage, 'appendEntries'>;
  /** This device's history as stored. */
  readonly ours: readonly Entry[];
}

/** Adds the copy the other device sends back to this history, or says why not. */
export async function takeBackFile(
  input: RestoreInput,
  { files, storage, deps, ours }: TakeBackDeps,
): Promise<RestoreResult> {
  if (input.route === 'archive') return { ok: false, problem: 'not-continued' };
  const read = await openedFile(input, { files, deps });
  if (!read.ok) return read;
  let back;
  try {
    back = await takenBack(ours, read.opened, input.day, deps);
  } catch (error: unknown) {
    if (error instanceof HandoverError) return { ok: false, problem: error.problem };
    return { ok: false, problem: error instanceof HistoryError ? 'changed' : 'failed' };
  }
  try {
    await storage.appendEntries(JSON.stringify(back.entries.map(toRow)));
  } catch {
    return { ok: false, problem: 'failed' };
  }
  return { ok: true };
}
