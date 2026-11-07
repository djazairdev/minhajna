// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's book as the desk holds it now, for the side panels: a panel is
// made when it opens, so it reads the newest book from here at each draw
// rather than the copy it was opened with.

import type { SchoolBook } from '@minhajna/core';
import { createContext, useContext } from 'react';

export interface DeskBook {
  readonly book: SchoolBook;
  readonly update: (step: (book: SchoolBook) => SchoolBook) => void;
  readonly adopt: (step: (book: SchoolBook) => SchoolBook) => void;
}

export const DeskBookContext = createContext<DeskBook | null>(null);

/** The newest book, given the copy a panel was opened with for when no desk holds one. */
export function useDeskBook(opened: DeskBook): DeskBook {
  return useContext(DeskBookContext) ?? opened;
}
