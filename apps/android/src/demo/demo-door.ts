// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The ways into the demo worlds (#560 and #561, answers 573 and 575), which
// the app gives only where it holds the platform's cryptography for worlds:
// from the pages before the teacher's history opens, the welcome and the lock
// page, on a PC only; and from Help, wherever there is a kit, which locks the
// history first, so the entry takes the lock's place.

import { createContext, useContext } from 'react';

/** Opens the demo worlds' entry from the welcome or the lock page, or null where the app offers none. */
export const DemoDoor = createContext<(() => void) | null>(null);

/** The way into the demo worlds before the history opens, or null where there is none. */
export function useDemoDoor(): (() => void) | null {
  return useContext(DemoDoor);
}

/** Locks the history and opens the demo worlds' entry from Help, or null where the app offers none. */
export const HelpDoor = createContext<(() => void) | null>(null);

/** The way into the demo worlds from Help, or null where there is none. */
export function useHelpDoor(): (() => void) | null {
  return useContext(HelpDoor);
}
