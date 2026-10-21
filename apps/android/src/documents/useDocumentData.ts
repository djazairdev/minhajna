// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The record book, the reference data, today and the interface's language,
// as the documents read them (#212).

import { useLocale } from '@react-navigation/native';
import type { Day } from '@minhajna/core';
import { useMemo } from 'react';
import { useAppData } from '../storage/AppData';
import { currentLanguage } from '../text/i18n';
import type { DocumentData } from './document-data';

/** What the documents are made from, for `on` or else today, in the interface's language and direction. */
export function useDocumentData(on?: Day): DocumentData {
  const { state, profile, year, calendar, calendarRelease, packs, bells, today } = useAppData();
  const { direction } = useLocale();
  const now = today();
  const day = on ?? now;
  const lang = currentLanguage();
  return useMemo(
    () => ({ state, profile, year, calendar, calendarRelease, packs, bells, day, today: now, lang, dir: direction }),
    [state, profile, year, calendar, calendarRelease, packs, bells, day, now, lang, direction],
  );
}
