// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The native storage module the app opened its history with, for the
// screens inside the navigator that change the lock: «القفل والأمان» and the
// PIN pages it opens (#210).

import { createContext, useContext } from 'react';
import type { Spec as Storage } from '../native/NativeMinhajnaStorage';

export const LockStorage = createContext<Storage | null>(null);

/** The storage module App gives the navigator; only screens shown once the history is open use it. */
export function useLockStorage(): Storage {
  const storage = useContext(LockStorage);
  if (storage === null) throw new Error('useLockStorage needs LockStorage from App');
  return storage;
}
