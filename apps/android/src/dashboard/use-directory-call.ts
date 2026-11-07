// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One page's calls to the directory: whether one is on its way, whether the
// server is waking, which the client tries through for over a minute, and what
// went wrong last, by the error's code. An answer that comes after the page
// left changes nothing.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DirectoryOptions } from '../network/directory-network';

export type DirectoryProblem = 'refused' | 'stale' | 'missing' | 'asleep' | 'busy' | 'full' | 'bad' | 'network';

const PROBLEMS: Readonly<Record<string, DirectoryProblem>> = {
  E_DIRECTORY_REFUSED: 'refused',
  E_DIRECTORY_STALE: 'stale',
  E_DIRECTORY_MISSING: 'missing',
  E_DIRECTORY_WAKING: 'asleep',
  E_DIRECTORY_BUSY: 'busy',
  E_DIRECTORY_FULL: 'full',
  E_DIRECTORY_BAD: 'bad',
};

/** What went wrong, by the client's error code; anything else is the network's. */
export function problemOf(error: unknown): DirectoryProblem {
  const code = (error as { code?: unknown } | null)?.code;
  return (typeof code === 'string' ? PROBLEMS[code] : undefined) ?? 'network';
}

export interface DirectoryCall {
  readonly busy: boolean;
  readonly waking: boolean;
  readonly problem: DirectoryProblem | null;
  /** The server's own sentence for what it would not read. */
  readonly detail: string | null;
  /** Runs a call and answers its value, or undefined once its problem is set. */
  readonly run: <T>(call: (options: DirectoryOptions) => Promise<T>) => Promise<T | undefined>;
  readonly clear: () => void;
}

/** A page's calls, one state for all of them. */
export function useDirectoryCall(): DirectoryCall {
  const [running, setRunning] = useState(0);
  const [waking, setWaking] = useState(false);
  const [failure, setFailure] = useState<{ problem: DirectoryProblem; detail: string | null } | null>(null);
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
    };
  }, []);
  const run = useCallback(async <T>(call: (options: DirectoryOptions) => Promise<T>) => {
    setRunning((count) => count + 1);
    setFailure(null);
    try {
      return await call({ onWaking: () => open.current && setWaking(true) });
    } catch (error) {
      const problem = problemOf(error);
      if (open.current) setFailure({ problem, detail: problem === 'bad' ? (error as Error).message : null });
      return undefined;
    } finally {
      if (open.current) {
        setRunning((count) => count - 1);
        setWaking(false);
      }
    }
  }, []);
  const clear = useCallback(() => setFailure(null), []);
  return useMemo(
    () => ({
      busy: running > 0,
      waking,
      problem: failure?.problem ?? null,
      detail: failure?.detail ?? null,
      run,
      clear,
    }),
    [running, waking, failure, run, clear],
  );
}
