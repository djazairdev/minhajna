// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Fetching what the school gives the teacher (answer 808): the joining code
// goes to `POST /directory/join`, and nothing else of the teacher's goes with
// it. The answer is held in memory until the teacher approves it. While it
// loads, while the server wakes or when it stayed asleep, with no network,
// past the server's limits, for a code that opens nothing, or an answer the
// reader refuses, the screen says so. Leaving the screen stops the request,
// and nothing starts once it has left.

import { readTeacherDelivery, type TeacherDelivery } from '@minhajna/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { directoryPost, JOIN_PATH } from '../network/directory-network';

export type JoinLoad =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly waking: boolean }
  | { readonly kind: 'ready'; readonly code: string; readonly delivery: TeacherDelivery }
  | { readonly kind: 'unknown' | 'offline' | 'busy' | 'asleep' | 'refused' };

function failure(error: unknown): JoinLoad {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'E_DIRECTORY_MISSING' || code === 'E_DIRECTORY_BAD') return { kind: 'unknown' };
  if (code === 'E_DIRECTORY_BUSY' || code === 'E_DIRECTORY_FULL') return { kind: 'busy' };
  if (code === 'E_DIRECTORY_WAKING') return { kind: 'asleep' };
  return { kind: 'offline' };
}

/** The delivery as it loads for a code read with `readJoiningCode`; `ask` starts again with a code. */
export function useJoin(): { readonly load: JoinLoad; readonly ask: (code: string) => void } {
  const [load, setLoad] = useState<JoinLoad>({ kind: 'idle' });
  const control = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      control.current?.abort();
    };
  }, []);
  const ask = useCallback((code: string) => {
    if (!alive.current) return;
    control.current?.abort();
    const now = new AbortController();
    control.current = now;
    setLoad({ kind: 'loading', waking: false });
    const onWaking = () => {
      if (!now.signal.aborted) setLoad({ kind: 'loading', waking: true });
    };
    directoryPost(JOIN_PATH, { code }, undefined, { onWaking, signal: now.signal }).then(
      (answer) => {
        if (now.signal.aborted) return;
        const delivery = readTeacherDelivery(answer);
        setLoad(typeof delivery === 'string' ? { kind: 'refused' } : { kind: 'ready', code, delivery });
      },
      (error: unknown) => {
        if (!now.signal.aborted) setLoad(failure(error));
      },
    );
  }, []);
  return { load, ask };
}
