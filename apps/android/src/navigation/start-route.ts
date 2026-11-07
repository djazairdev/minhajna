// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The screen the app opens on (#183, #246, answer 490): Today once setup is
// finished; reader mode's home for a director or an inspector who kept a
// statement and never set up teaching; else the welcome. Nothing records the
// choice: a reader who kept no statement yet starts from the welcome again.

import { receivedStatements, type Entry } from '@minhajna/core';
import type { InitialState } from '@react-navigation/native';

export function startRoute(book: {
  readonly state: { readonly setupFinished: boolean };
  readonly entries: readonly Entry[];
}): 'Home' | 'ReaderHome' | 'Welcome' {
  if (book.state.setupFinished) return 'Home';
  return receivedStatements(book.entries).length > 0 ? 'ReaderHome' : 'Welcome';
}

/** What the welcome began, before the first PIN. */
export type Begin = 'setup' | 'restore' | 'reader';

/**
 * After the first PIN, with the welcome under it for Back: setup goes on at the privacy notice, the restore at the
 * restore (#247), and reader mode at the notice that leads to its home (#246).
 */
export const AFTER_FIRST_PIN: Record<Begin, InitialState> = {
  setup: { index: 1, routes: [{ name: 'Welcome' }, { name: 'Privacy' }] },
  restore: { index: 1, routes: [{ name: 'Welcome' }, { name: 'Restore' }] },
  reader: { index: 1, routes: [{ name: 'Welcome' }, { name: 'Privacy', params: { reader: true } }] },
};

/** Reader mode from the dashboard on a PC with a passphrase: its notice over the screen the app opens on. */
export function readerAfterLock(book: Parameters<typeof startRoute>[0]): InitialState {
  return { index: 1, routes: [{ name: startRoute(book) }, { name: 'Privacy', params: { reader: true } }] };
}
