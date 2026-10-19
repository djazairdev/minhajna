// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What «توقيتاتي» says (#220, R-3.11-05, answer 267): the median seconds
// to confirm a session, with the time 9 sessions in 10 take at most, the
// share confirmed in one tap, the minutes a week on sessions and roll
// calls, and the term's export, «لم يتم بعد» until it exists. The median is
// rounded and the 90th percentile rounded up, so «أو أقل» stays true. The
// lines a teacher may share are the same as those shown, word for word,
// and carry no day, no class and nothing that names anyone.

import type { TimingSummary } from '@minhajna/core';
import type { Translate } from '../documents/document-data';

export interface TimingCard {
  readonly id: 'median' | 'one-tap' | 'weekly' | 'export';
  /** The figure, or «—» while there is none. */
  readonly value: string;
  /** The figure's unit, such as «ثوانٍ», when it has one. */
  readonly unit?: string;
  readonly label: string;
  readonly line: string;
}

export interface SharedLine {
  readonly label: string;
  readonly value: string;
}

interface Figures {
  readonly median: number;
  readonly p90: number;
  readonly percent: number;
}

/** The sessions' figures, or null before the first session is timed; roll calls count only in the minutes. */
function figures(summary: TimingSummary): Figures | null {
  if (summary.median === null || summary.p90 === null) return null;
  return {
    median: Math.round(summary.median),
    p90: Math.ceil(summary.p90),
    percent: Math.round((summary.oneTap / summary.sessions) * 100),
  };
}

const minutesOf = (summary: TimingSummary) =>
  summary.weeklyMinutes === null ? null : Math.round(summary.weeklyMinutes);

/** The four cards, in the design's order. */
export function timingCards(t: Translate, summary: TimingSummary): TimingCard[] {
  const found = figures(summary);
  const minutes = minutesOf(summary);
  const none = t('pilotTimings.empty');
  return [
    {
      id: 'median',
      value: found === null ? none : String(found.median),
      ...(found !== null && { unit: t('pilotTimings.seconds', { count: found.median }) }),
      label: t('pilotTimings.median'),
      line: found === null ? '' : t('pilotTimings.p90', { count: found.p90 }),
    },
    {
      id: 'one-tap',
      value: found === null ? none : `${found.percent}%`,
      label: t('pilotTimings.oneTap'),
      line: found === null ? '' : t('pilotTimings.oneTapOf', { oneTap: summary.oneTap, count: summary.sessions }),
    },
    {
      id: 'weekly',
      value: minutes === null ? none : String(minutes),
      ...(minutes !== null && { unit: t('pilotTimings.minutes', { count: minutes }) }),
      label: t('pilotTimings.weekly'),
      line: t('pilotTimings.weeks', { count: summary.weeks }),
    },
    {
      id: 'export',
      value: t('pilotTimings.notYet'),
      label: t('pilotTimings.export'),
      line: t('pilotTimings.exportLine'),
    },
  ];
}

/** The lines shared, as «ما يُرسل بالضبط» shows them; none before the first timing. */
export function sharedLines(t: Translate, summary: TimingSummary, version: string): SharedLine[] {
  const found = figures(summary);
  const minutes = minutesOf(summary);
  const none = t('pilotTimings.empty');
  if (minutes === null) return [];
  return [
    { label: t('pilotTimings.version'), value: t('pilotTimings.versionValue', { version }) },
    {
      label: t('pilotTimings.perSession'),
      value: found === null ? none : t('pilotTimings.perSessionValue', { median: found.median, p90: found.p90 }),
    },
    {
      label: t('pilotTimings.byOneTap'),
      value:
        found === null
          ? none
          : t('pilotTimings.byOneTapValue', {
              percent: found.percent,
              oneTap: summary.oneTap,
              count: summary.sessions,
            }),
    },
    {
      label: t('pilotTimings.perWeek'),
      value: t('pilotTimings.perWeekValue', {
        minutes,
        weeks: t('pilotTimings.weeks', { count: summary.weeks }),
      }),
    },
    { label: t('pilotTimings.export'), value: t('pilotTimings.notYet') },
  ];
}

/** The text the share sheet carries: the title, then each shared line. */
export function shareText(t: Translate, lines: readonly SharedLine[]): string {
  return [t('pilotTimings.shareTitle'), ...lines.map((line) => `${line.label}: ${line.value}`)].join('\n');
}
