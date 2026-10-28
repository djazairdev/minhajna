// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Locking at once, from the PC's rail (#251, answer 524): App hands down the
// step the automatic lock takes, which keeps the screen to come back to.

import { createContext, useContext } from 'react';

export const LockAway = createContext<(() => void) | null>(null);

/** Locks the history now; null where App gives no lock. */
export function useLockAway(): (() => void) | null {
  return useContext(LockAway);
}
