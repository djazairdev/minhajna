// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Day } from './day.ts';

// PRD §3.8: dates use Western digits, the Algerian month names in Arabic
// (جانفي … أوت), and the school year as "2026-2027". The texts book keeps its
// own form (yyyy/mm/dd). Country specifics live as reference data (PRD §1.14),
// but Algeria is the sole country through 2027/28 and month names follow
// Algerian usage.

const MONTHS_AR = [
  'جانفي',
  'فيفري',
  'مارس',
  'أفريل',
  'ماي',
  'جوان',
  'جويلية',
  'أوت',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const;

const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Formats a Day as dd/mm/yyyy with Western digits (PRD §3.8). */
export function formatDay(day: Day): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
}

/** Formats a Day for the texts-book pages as yyyy/mm/dd (PRD §3.8). */
export function formatTextsBookDay(day: Day): string {
  return `${day.slice(0, 4)}/${day.slice(5, 7)}/${day.slice(8, 10)}`;
}

/**
 * Formats a Day with its month name in Arabic (Algerian), French, or English (PRD §3.8).
 * Single-digit narrative day numbers are not zero-padded, and digits are always Western.
 */
export function formatDayWithMonth(day: Day, language: 'ar' | 'fr' | 'en'): string {
  const monthIndex = Number(day.slice(5, 7)) - 1;
  const date = Number(day.slice(8, 10));
  const year = day.slice(0, 4);

  let monthName: string | undefined;
  if (language === 'ar') {
    monthName = MONTHS_AR[monthIndex];
  } else if (language === 'fr') {
    monthName = MONTHS_FR[monthIndex];
  } else if (language === 'en') {
    monthName = MONTHS_EN[monthIndex];
  } else {
    throw new RangeError(`Unsupported language: ${String(language)}`);
  }

  if (monthName === undefined) {
    throw new RangeError(`Not a valid month in day: ${day}`);
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
