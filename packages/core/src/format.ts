// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// PRD §3.8: document dates and numbers use Western digits. The country profile
// supplies month names (PRD §1.14), never the engine's locale. Missing names
// are an error, not permission to change the document's date form or language.

import type { Day } from './day.ts';
import type { CountryProfile, MonthNames } from './reference.ts';

/** Formats a Day as dd/mm/yyyy with Western digits (PRD §3.8). */
export function formatDay(day: Day): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
}

/** Formats a Day for the texts-book pages as yyyy/mm/dd (PRD §3.8). */
export function formatTextsBookDay(day: Day): string {
  return `${day.slice(0, 4)}/${day.slice(5, 7)}/${day.slice(8, 10)}`;
}

/**
 * Formats a Day with the profile's month name (PRD §3.8, §1.14), with Western digits.
 * Narrative day numbers are not zero-padded. Missing names throw; there is no fallback form or language.
 */
export function formatDayWithMonth(
  day: Day,
  language: keyof MonthNames,
  profile: Pick<CountryProfile, 'months'>,
): string {
  if (language !== 'ar' && language !== 'fr' && language !== 'en') {
    throw new RangeError(`Unsupported language: ${String(language)}`);
  }
  if (profile.months === undefined) throw new RangeError('Month names are missing from the country profile');
  const monthIndex = Number(day.slice(5, 7)) - 1;
  const date = Number(day.slice(8, 10));
  const year = day.slice(0, 4);

  const monthName = profile.months[monthIndex]?.[language];
  if (monthName === undefined || monthName.trim() === '') {
    throw new RangeError(`Month names are incomplete for ${language}`);
  }

  return `${date} ${monthName} ${year}`;
}

/** Formats a positive integer start year as a school year `YYYY-YYYY` (PRD §3.8). */
export function formatSchoolYear(startYear: number): string {
  if (!Number.isInteger(startYear) || startYear <= 0) {
    throw new RangeError(`Not a valid school year: ${startYear}`);
  }
  return `${startYear}-${startYear + 1}`;
}

/** Formats a whole number using Western ASCII digits. */
export function formatWholeNumber(value: number): string {
  if (!Number.isInteger(value)) {
    throw new RangeError(`Not a whole number: ${value}`);
  }
  if (Object.is(value, -0)) return '0';
  return String(value);
}
