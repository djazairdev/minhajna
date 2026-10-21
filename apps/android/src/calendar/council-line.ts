// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CalendarEntry, State } from '@minhajna/core';
import { bookClock } from '../entry/book-lines';
import type { useText } from '../text/i18n';

/** A council's class, term and time, «4م2 · الفصل الأول · 14سا»; null for any other entry. */
export function councilLine(t: ReturnType<typeof useText>, state: State, entry: CalendarEntry): string | null {
  const council = entry.council;
  if (council === undefined) return null;
  return t('calendarView.council.row', {
    class: state.classes.get(council.classId)?.name ?? '',
    term: t(`calendarView.council.terms.${council.term as 1 | 2 | 3}`),
    at: bookClock(council.at, t),
  });
}
