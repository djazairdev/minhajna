// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Every print, and every PDF saved, from a screen that makes one goes into the
// activity log (#235, answer 426), and every file of the term export saved or
// shared (#242, answer 467), and every full export (#248): the document's name,
// the period its file is named after, print, PDF, CSV or the archive, and
// whether it was blank; never its content, its file name, its password or where
// it went. A print counts once it reaches Android's print screen, which never
// tells the app whether it printed, and a share once it reaches the share
// screen.

import { useAppData } from '../storage/AppData';

/** What a print or a saved PDF of `document`, for `period`, records once it is made. */
export function useOutputLog(): (
  document: string,
  period: string,
  blank?: boolean,
) => {
  readonly printed: () => void;
  readonly saved: () => void;
  readonly filed: (how: 'pdf' | 'csv' | 'archive') => void;
} {
  const { record, newId } = useAppData();
  return (document, period, blank = false) => {
    const made = (how: 'print' | 'pdf' | 'csv' | 'archive') =>
      record({ kind: 'output.recorded', output: { id: newId(), document, period, how, blank } });
    return { printed: () => made('print'), saved: () => made('pdf'), filed: made };
  };
}
