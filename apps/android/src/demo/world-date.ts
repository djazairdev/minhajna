// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A demo world's date as its band writes it (#557): the weekday, the day,
// the month in the interface language and the year, such as «الأحد 2 جوان
// 2030».

import type { CountryProfile, Day } from '@minhajna/core';
import type { Language, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';

type Translate = ReturnType<typeof useText>;

/** The world's date written out for its band. */
export function worldDate(t: Translate, day: Day, language: Language, profile: Pick<CountryProfile, 'months'>): string {
  return `${dayName(t, day, language, profile)} ${Number(day.slice(0, 4))}`;
}
