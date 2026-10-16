// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Records keep the day of each change, never the time of day (PRD §5.5,
// charter point 3). Days are plain civil dates worked out by arithmetic,
// because a Date object carries a time zone, and the same moment can fall on
// two different days depending on the device's settings.

/** A civil date, written YYYY-MM-DD. */
export type Day = string & { readonly __day: unique symbol };

/** 0 is Sunday and 6 is Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parts(text: string): [number, number, number] | null {
  const match = PATTERN.exec(text);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return [year, month, day];
}

export function isDay(text: string): text is Day {
  return parts(text) !== null;
}

/** Checks a date written YYYY-MM-DD, and throws if it is not a real day. */
export function parseDay(text: string): Day {
  if (!isDay(text)) throw new RangeError(`Not a valid day: ${text}`);
  return text;
}

// Days since 1970-01-01, from Howard Hinnant's days_from_civil algorithm.
export function dayNumber(day: Day): number {
  const p = parts(day);
  if (p === null) throw new RangeError(`Not a valid day: ${day}`);
  const [y0, month, date] = p;
  const year = month <= 2 ? y0 - 1 : y0;
  const era = Math.floor(year / 400);
  const yearOfEra = year - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + date - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

export function fromDayNumber(count: number): Day {
  const z = count + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365,
  );
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const mp = Math.floor((5 * dayOfYear + 2) / 153);
  const date = dayOfYear - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  const text = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
  return parseDay(text);
}

export function addDays(day: Day, count: number): Day {
  return fromDayNumber(dayNumber(day) + count);
}

/** The number of days from `from` to `to`: positive when `to` is later. */
export function daysBetween(from: Day, to: Day): number {
  return dayNumber(to) - dayNumber(from);
}

/** The day of the week of `day`. 1970-01-01, day 0, was a Thursday. */
export function weekday(day: Day): Weekday {
  return ((((dayNumber(day) + 4) % 7) + 7) % 7) as Weekday;
}

export function compareDays(a: Day, b: Day): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function minDay(a: Day, b: Day): Day {
  return compareDays(a, b) <= 0 ? a : b;
}

export function maxDay(a: Day, b: Day): Day {
  return compareDays(a, b) >= 0 ? a : b;
}

/** Whether `day` falls between `from` and `to`, both included. */
export function isWithin(day: Day, from: Day, to: Day): boolean {
  return compareDays(from, day) <= 0 && compareDays(day, to) <= 0;
}

/** Every day from `from` to `to`, both included. */
export function eachDay(from: Day, to: Day): Day[] {
  const days: Day[] = [];
  const last = dayNumber(to);
  for (let n = dayNumber(from); n <= last; n += 1) days.push(fromDayNumber(n));
  return days;
}

/** The first day of the week that holds `day`, for a week starting on `weekStartsOn`. */
export function startOfWeek(day: Day, weekStartsOn: Weekday): Day {
  const back = (weekday(day) - weekStartsOn + 7) % 7;
  return addDays(day, -back);
}

/** The month that holds `day`, written YYYY-MM. */
export function monthOf(day: Day): string {
  return day.slice(0, 7);
}

/** The first and last days of a month written YYYY-MM. */
export function monthRange(month: string): { from: Day; to: Day } {
  const from = parseDay(`${month}-01`);
  const [year, monthNumber] = month.split('-').map(Number);
  if (year === undefined || monthNumber === undefined) throw new RangeError(`Not a month: ${month}`);
  return { from, to: parseDay(`${month}-${String(daysInMonth(year, monthNumber)).padStart(2, '0')}`) };
}
