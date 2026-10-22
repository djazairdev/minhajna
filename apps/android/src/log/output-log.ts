// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Every print, and every PDF saved, from a screen that makes one goes into
// the activity log (#235, answer 426): the document's name, the period its
// file is named after, print or PDF, and whether it was blank; never its
// content, its file name or where it went. A print counts once it reaches
// Android's print screen, which never tells the app whether it printed.

import { useAppData } from '../storage/AppData';

/** What a print or a saved PDF of `document`, for `period`, records once it is made. */
export function useOutputLog(): (
  document: string,
  period: string,
  blank?: boolean,
) => {
  readonly printed: () => void;
  readonly saved: () => void;
} {
  const { record, newId } = useAppData();
  return (document, period, blank = false) => {
    const made = (how: 'print' | 'pdf') => () =>
      record({ kind: 'output.recorded', output: { id: newId(), document, period, how, blank } });
    return { printed: made('print'), saved: made('pdf') };
  };
}
