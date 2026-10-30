// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The way into the demo worlds from the pages before the teacher's history
// opens (#560, answer 573): the app gives it only where it holds the
// platform's cryptography for worlds, which is a PC until #561, and the
// welcome and the lock page show it only when it is given.

import { createContext, useContext } from 'react';

/** Opens the demo worlds' entry, or null where the app offers none. */
export const DemoDoor = createContext<(() => void) | null>(null);

/** The way into the demo worlds, or null where there is none. */
export function useDemoDoor(): (() => void) | null {
  return useContext(DemoDoor);
}
