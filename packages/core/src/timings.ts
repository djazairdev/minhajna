// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pilot's own timings (#220, PRD §3.11, §10.3, choice P7, answer 267):
// how long confirming a session or taking a roll call took on this phone, in
// tenths of a second, and whether a session was confirmed in one tap. Each
// timing keeps only the school week it fell in, never a clock time or a day,
// so minutes per week can be averaged. A tap confirming several sessions at
// once splits its time evenly among them. The teacher sees the summary and
// decides whether to share it; nothing is sent (R-10.3-01). Timings are not
// records: they stay out of the history, and clearing them deletes them.

import { isDay, startOfWeek, weekday, type Day, type Weekday } from './day.ts';

export const TIMING_KINDS = ['session', 'roll'] as const;

export type TimingKind = (typeof TIMING_KINDS)[number];

/** One timing as the phone keeps it. */
export interface Timing {
  readonly kind: TimingKind;
  /** The first day of the school week it fell in. */
  readonly week: Day;
  /** Whole tenths of a second, at least 0. */
  readonly tenths: number;
  /** For a session: confirmed in one tap on Today, with no sheet or screen. */
  readonly oneTap: boolean;
}

/** What «توقيتاتي» shows. Seconds and minutes are rounded for display by the app. */
export interface TimingSummary {
  /** Sessions timed. */
  readonly sessions: number;
  /** The median seconds per session, or null with none timed. */
  readonly median: number | null;
  /** The 90th percentile, by nearest rank, or null with none timed. */
  readonly p90: number | null;
  /** Sessions confirmed in one tap. */
  readonly oneTap: number;
  /** Weeks with any timing. */
  readonly weeks: number;
  /** Average minutes per such week on sessions and roll calls, or null with none. */
  readonly weeklyMinutes: number | null;
}

/** The week a timing on `day` is kept under: its school week's first day, never the day itself. */
export function timingWeek(day: Day, weekStartsOn: Weekday): Day {
  return startOfWeek(day, weekStartsOn);
}

/** `tenths` shared out among `count` sessions confirmed by one tap, each a whole tenth, adding up. */
export function splitTenths(tenths: number, count: number): number[] {
  const whole = Math.max(0, Math.round(tenths));
  const each = Math.floor(whole / count);
  return Array.from({ length: count }, (_, at) => each + (at < whole - each * count ? 1 : 0));
}

const rank = (sorted: readonly number[], share: number) =>
  sorted[Math.min(sorted.length, Math.max(1, Math.ceil(share * sorted.length))) - 1] ?? 0;

/** The summary of the timings kept. */
export function timingSummary(timings: readonly Timing[]): TimingSummary {
  const sessions = timings.filter((one) => one.kind === 'session');
  const seconds = sessions.map((one) => one.tenths / 10).sort((a, b) => a - b);
  const middle = seconds.length / 2;
  const median =
    seconds.length === 0
      ? null
      : seconds.length % 2 === 1
        ? (seconds[Math.floor(middle)] ?? 0)
        : ((seconds[middle - 1] ?? 0) + (seconds[middle] ?? 0)) / 2;
  const weeks = new Set(timings.map((one) => one.week)).size;
  const total = timings.reduce((sum, one) => sum + one.tenths, 0) / 600;
  return {
    sessions: sessions.length,
    median,
    p90: seconds.length === 0 ? null : rank(seconds, 0.9),
    oneTap: sessions.filter((one) => one.oneTap).length,
    weeks,
    weeklyMinutes: weeks === 0 ? null : total / weeks,
  };
}

/**
 * The timings in `value`, as the phone's storage gives them back or as they
 * go to it; anything malformed is refused, and so is a week that does not
 * start on `weekStartsOn`, so no single day is ever kept.
 */
export function readTimings(value: unknown, weekStartsOn: Weekday): Timing[] {
  if (!Array.isArray(value)) throw new TypeError('Timings are an array');
  return value.map((one: unknown) => {
    const row = one as Partial<Record<keyof Timing, unknown>> | null;
    const { kind, week, tenths, oneTap } = row ?? {};
    if (
      !(TIMING_KINDS as readonly unknown[]).includes(kind) ||
      typeof week !== 'string' ||
      !isDay(week) ||
      weekday(week) !== weekStartsOn ||
      typeof tenths !== 'number' ||
      !Number.isInteger(tenths) ||
      tenths < 0 ||
      typeof oneTap !== 'boolean'
    ) {
      throw new TypeError('A timing is malformed');
    }
    return { kind: kind as TimingKind, week, tenths, oneTap };
  });
}
