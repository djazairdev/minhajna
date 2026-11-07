// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The directory's reference list for the school selects (answers 804 and
// 809), fetched whole while the screen is open and held in memory only: the
// request sends nothing, so the server never learns which school is chosen.
// While it loads, while the server wakes, with no network, past the server's
// limits, with nothing published, a list that offers nothing to choose, or a
// list the reader refuses, the screen says so and offers a retry. Leaving the
// screen stops the request.

import { readReferenceList, type ReferenceList } from '@minhajna/core';
import { useCallback, useEffect, useState } from 'react';
import { directoryGet } from '../network/directory-network';
import { hasChoices } from './school-choice';

export type ReferenceLoad =
  | { readonly kind: 'loading'; readonly waking: boolean }
  | { readonly kind: 'ready'; readonly list: ReferenceList }
  | { readonly kind: 'none' | 'offline' | 'busy' | 'refused' };

/** The path of the published list. */
export const REFERENCE_PATH = '/directory/reference';

function failure(error: unknown): ReferenceLoad {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'E_DIRECTORY_MISSING') return { kind: 'none' };
  if (code === 'E_DIRECTORY_BUSY') return { kind: 'busy' };
  if (code === 'E_DIRECTORY_BAD' || code === 'E_DIRECTORY_FULL') return { kind: 'refused' };
  return { kind: 'offline' };
}

/** The list as it loads, and a retry. */
export function useReference(): { readonly load: ReferenceLoad; readonly retry: () => void } {
  const [load, setLoad] = useState<ReferenceLoad>({ kind: 'loading', waking: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const control = new AbortController();
    const onWaking = () => {
      if (!control.signal.aborted) setLoad({ kind: 'loading', waking: true });
    };
    directoryGet(REFERENCE_PATH, undefined, { onWaking, signal: control.signal }).then(
      (answer) => {
        if (control.signal.aborted) return;
        const list = readReferenceList(answer);
        if (typeof list === 'string') setLoad({ kind: 'refused' });
        else setLoad(hasChoices(list) ? { kind: 'ready', list } : { kind: 'none' });
      },
      (error: unknown) => {
        if (!control.signal.aborted) setLoad(failure(error));
      },
    );
    return () => control.abort();
  }, [attempt]);
  const retry = useCallback(() => {
    setLoad({ kind: 'loading', waking: false });
    setAttempt((count) => count + 1);
  }, []);
  return { load, retry };
}
