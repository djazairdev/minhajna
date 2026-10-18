// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The core's shared storage checks (#76), run on the phone for #19: the app's
// JavaScript adapter, the bridge, the native module's code, SQLCipher and the
// Keystore, with the phone's own SHA-256 and random bytes. Each check gets a
// fresh throwaway history from the debug-only check module, deleted after it.

import { historyStoreTests } from '@minhajna/core/test-support';
import type { Spec as StorageSpec } from '../native/NativeMinhajnaStorage';
import type { Spec as CheckSpec } from '../native/NativeMinhajnaStorageCheck';
import { fromRow, nativeDeps, nativeStore, type HistorySpec } from '../storage/history';

/** The prefix of every line the storage check logs, for scripts that read the results over adb. */
export const LOG_PREFIX = '[storage-check]';

export interface CheckResult {
  readonly name: string;
  readonly passed: boolean;
  /** The failure's message: the check's own, or SQLite's, never a record's content. */
  readonly error?: string;
  readonly milliseconds: number;
}

type Row = Parameters<typeof fromRow>[0];

/** The app's storage module, with its history calls sent to one throwaway history instead. */
export function throwawaySpec(storage: StorageSpec, check: CheckSpec, name: string): HistorySpec {
  return {
    randomBytes: (length) => storage.randomBytes(length),
    digest: (texts) => storage.digest(texts),
    openHistory: () => check.openHistory(name),
    loadHistory: () => check.loadHistory(name),
    appendEntry: (entry) => check.appendEntry(name, entry),
    eraseContent: (ids) => check.eraseContent(name, ids),
  };
}

/** Runs every check in turn, reporting each as it ends, and returns them all. */
export async function runStorageChecks(
  storage: StorageSpec,
  check: CheckSpec,
  onResult: (result: CheckResult) => void = () => {},
): Promise<readonly CheckResult[]> {
  const checks: { name: string; run: () => Promise<void> }[] = [];
  historyStoreTests(
    (name, run) => checks.push({ name, run }),
    async () => {
      const name = `run-${storage.randomBytes(8)}`;
      const spec = throwawaySpec(storage, check, name);
      await spec.openHistory();
      return {
        store: nativeStore(spec),
        readCommitted: async () => (JSON.parse(await check.readCommitted(name)) as Row[]).map(fromRow),
        dispose: () => check.deleteHistory(name),
      };
    },
    nativeDeps(storage),
  );
  const results: CheckResult[] = [];
  for (const { name, run } of checks) {
    const start = Date.now();
    let result: CheckResult;
    try {
      await run();
      result = { name, passed: true, milliseconds: Date.now() - start };
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      result = { name, passed: false, error: message, milliseconds: Date.now() - start };
    }
    results.push(result);
    onResult(result);
  }
  return results;
}
