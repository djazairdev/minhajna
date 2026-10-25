// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Whether the phone serves a reader only (#246, answer 490): setup is not
// finished and no school is entered, so Settings and Help leave out what
// needs teaching set up.

import type { State } from '@minhajna/core';

export const readerOnly = (state: Pick<State, 'setupFinished' | 'schools'>): boolean =>
  !state.setupFinished && state.schools.size === 0;
