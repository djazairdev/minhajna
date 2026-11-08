// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Leaving reader mode for the dashboard's home (answer 856), which locks the
// history first; a lock the storage module refuses keeps reader mode, which
// locks through the shell instead. From a screen of the open history, the last
// changes are saved first: when they are not, reader mode stays, and says so
// as the language page does.

import { createContext, useCallback, useContext, useState } from 'react';
import { useAppData } from '../../android/src/storage/AppData';

/** Locks the history and goes back to the dashboard's home. */
export const ReaderLeave = createContext<() => void>(() => undefined);

/** Leaves reader mode once the last changes are saved, from inside the open history, and whether they failed to. */
export function useSavedLeave(): { readonly leave: () => void; readonly failed: boolean } {
  const leave = useContext(ReaderLeave);
  const { allSaved } = useAppData();
  const [failed, setFailed] = useState(false);
  const saveThenLeave = useCallback(() => {
    setFailed(false);
    void allSaved()
      .catch(() => false)
      .then((saved) => {
        if (saved) leave();
        else setFailed(true);
      });
  }, [allSaved, leave]);
  return { leave: saveThenLeave, failed };
}
