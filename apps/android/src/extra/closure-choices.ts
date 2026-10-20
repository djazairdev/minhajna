// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CalendarEntry, CountryProfile } from '@minhajna/core';
import { currentLanguage, type useText } from '../text/i18n';
import { dayName } from '../today/DayMark';

/** A morning and an afternoon closure on the same date remain distinguishable. */
export function closureChoices(
  t: ReturnType<typeof useText>,
  profile: CountryProfile,
  closures: readonly CalendarEntry[],
) {
  return [
    ...closures.map((one) => ({
      value: one.id,
      label: [
        dayName(t, one.from, currentLanguage(), profile),
        ...(one.half === undefined ? [] : [t(`calendarView.periods.${one.half}`)]),
      ].join(' · '),
    })),
    { value: 'none', label: t('addSessions.noClosure') },
  ];
}
