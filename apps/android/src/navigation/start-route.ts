// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The screen the app opens on (#183, #246, answer 490): Today once setup is
// finished; reader mode's home for a director or an inspector who kept a
// statement and never set up teaching; else the welcome. Nothing records the
// choice: a reader who kept no statement yet starts from the welcome again.

import { receivedStatements, type Entry } from '@minhajna/core';

export function startRoute(book: {
  readonly state: { readonly setupFinished: boolean };
  readonly entries: readonly Entry[];
}): 'Home' | 'ReaderHome' | 'Welcome' {
  if (book.state.setupFinished) return 'Home';
  return receivedStatements(book.entries).length > 0 ? 'ReaderHome' : 'Welcome';
}
