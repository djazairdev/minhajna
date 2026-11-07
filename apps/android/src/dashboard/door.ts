// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The way to the dashboard (answer 809), which a PC alone offers, from the
// pages before the teacher's history opens, as the demo worlds' door. The
// dashboard needs no passphrase and touches no history: each of its pages has
// its own edit code, held in memory. Going back shows what was under it.
// Reading a teacher's statement leaves it for reader mode's notice: on a fresh
// PC through the first passphrase, as the welcome began it; on a PC with a
// passphrase, once the lock opens, over the screen the app opens on. That wish
// holds for that opening of the history alone, and ends if the PC is back at
// its welcome.

import type { InitialState } from '@react-navigation/native';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { LockPhase } from '../lock/useLockPhase';
import { readerAfterLock, startRoute } from '../navigation/start-route';
import { onPc } from '../text/device-text';

/** Opens the dashboard from the welcome or the lock page, or null where the app offers none. */
export const DashboardDoor = createContext<(() => void) | null>(null);

/** The way to the dashboard before the history opens, or null where there is none. */
export function useDashboardDoor(): (() => void) | null {
  return useContext(DashboardDoor);
}

export interface DashboardDoors {
  /** True while the dashboard takes the lock's place. */
  readonly shown: boolean;
  readonly open: (() => void) | null;
  readonly back: () => void;
  /** Leaves for reader mode: through the welcome's way when given, else once the lock opens. */
  readonly toReader: (fromWelcome: (() => void) | null) => void;
  /** The screens the history opens on for reader mode asked from the dashboard, if it was. */
  readonly readerState: InitialState | undefined;
}

/** The dashboard's door, given whether the app's reference data opened, the lock's phase and the book once open. */
export function useDashboardDoors(
  offered: boolean,
  phase: LockPhase,
  book: Parameters<typeof startRoute>[0] | null,
): DashboardDoors {
  const [shown, setShown] = useState(false);
  const [reader, setReader] = useState<{ readonly opening: number | null } | null>(null);
  const back = useCallback(() => setShown(false), []);
  const opening = phase.kind === 'open' && book !== null ? phase.opening : null;
  if (reader !== null && phase.kind === 'welcome') setReader(null);
  else if (reader !== null && reader.opening === null && opening !== null) setReader({ opening });
  const toReader = useCallback((fromWelcome: (() => void) | null) => {
    setShown(false);
    if (fromWelcome !== null) fromWelcome();
    else setReader({ opening: null });
  }, []);
  const readerState =
    reader !== null && book !== null && opening !== null && (reader.opening ?? opening) === opening
      ? readerAfterLock(book)
      : undefined;
  return useMemo(
    () => ({
      shown: shown && offered,
      open: offered && onPc() ? () => setShown(true) : null,
      back,
      toReader,
      readerState,
    }),
    [shown, offered, back, toReader, readerState],
  );
}
