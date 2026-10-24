// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How a restore (#247) reaches App: once the restored history is stored, the
// record book is read again from the store, and the app opens where that
// history stands, on Today once setup was finished on the old phone.

import { createContext, useContext } from 'react';

export const ReopenHistory = createContext<(() => void) | null>(null);

/** Reads the history again; it needs ReopenHistory from App. */
export function useReopen(): () => void {
  const reopen = useContext(ReopenHistory);
  if (reopen === null) throw new Error('useReopen needs ReopenHistory from App');
  return reopen;
}
