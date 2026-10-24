// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { RecordBook } from '@minhajna/core';
import { useEffect, useState } from 'react';
import type { Spec as Storage } from '../native/NativeMinhajnaStorage';
import { readBroken, type BrokenHistory } from './broken-history';
import { openRecordBook } from './history';

export type HistoryStatus = 'opening' | 'open' | 'refused' | 'broken';

export interface History {
  readonly status: HistoryStatus;
  readonly book: RecordBook | null;
  readonly broken: BrokenHistory | null;
}

/**
 * Opens the history each time the lock opens it, and lets it go when the
 * lock closes it, so no record stays in memory behind the lock. A history
 * that does not verify, or whose key is gone, is never opened: the teacher
 * sees one short line, which names no pupil, and nothing from it is used
 * (PRD §5.5). One whose rows still read but whose chain breaks is inspected
 * read-only, to show what still checks (answer 427).
 */
export function useHistory(storage: Storage, opening: number | null): History {
  const [history, setHistory] = useState<History & { opening: number | null }>({
    status: 'opening',
    book: null,
    broken: null,
    opening: null,
  });
  useEffect(() => {
    if (opening === null) return;
    let current = true;
    openRecordBook(storage).then(
      (book) => {
        if (current) setHistory({ status: 'open', book, broken: null, opening });
      },
      (error: unknown) => {
        if (__DEV__) console.warn('History refused', error);
        void readBroken(storage).then((broken) => {
          if (current) setHistory({ status: broken === null ? 'refused' : 'broken', book: null, broken, opening });
        });
      },
    );
    return () => {
      current = false;
      setHistory({ status: 'opening', book: null, broken: null, opening: null });
    };
  }, [storage, opening]);
  if (opening === null || history.opening !== opening) return { status: 'opening', book: null, broken: null };
  return history;
}
