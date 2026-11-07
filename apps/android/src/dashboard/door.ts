// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The way to the dashboard (answer 809), which a PC alone offers, from the
// pages before the teacher's history opens, as the demo worlds' door. The
// dashboard needs no passphrase and touches no history: each of its pages has
// its own edit code, held in memory. Going back shows what was under it.

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
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
}

/** The dashboard's door, given whether the app's reference data opened. */
export function useDashboardDoors(offered: boolean): DashboardDoors {
  const [shown, setShown] = useState(false);
  const back = useCallback(() => setShown(false), []);
  return useMemo(
    () => ({ shown: shown && offered, open: offered && onPc() ? () => setShown(true) : null, back }),
    [shown, offered, back],
  );
}
