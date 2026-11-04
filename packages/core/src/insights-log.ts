// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Taking part in the insights in a teachers' demo world, and the log of what
// was sent (#622, R-1.6-01, R-1.6-03, choice D6, answer 697). Both are
// device-layer events in the world's store alone, dated by the world's date:
// the teacher's choice, off until turned on, the latest that reads counting;
// and each sending the server took, exactly as it was sent, with the class it
// was for. While insights are on, a term is due once the world's date has
// ended it, from the latest term ended on the day they were last turned on,
// so turning them on sends the term just ended and every later one, never one
// ended before; a class's sending for a term is sent once, the log keeping it.
// The log lists, by the day, newest first, each turning on or off and each
// sending, a sending opening as it was sent; no clock time is ever kept.

import { compareDays, type Day } from './day.ts';
import type { InsightsSent } from './device-events.ts';
import { eventOf } from './events.ts';
import type { Entry } from './history.ts';
import { readSending } from './insights.ts';
import type { SchoolYear, Term } from './reference.ts';

export type { InsightsSent } from './device-events.ts';

/** Whether insights are on, and the day they were last turned on. */
export interface InsightsChoice {
  readonly on: boolean;
  readonly since: Day | null;
}

/** A line of the insights log. */
export type InsightsLogLine =
  { readonly kind: 'on' | 'off'; readonly day: Day } | ({ readonly kind: 'sent'; readonly day: Day } & InsightsSent);

/** A kept sending as the store may hold it, or null when it does not read. */
export function readInsightsSent(value: unknown): InsightsSent | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { classId, sending, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length > 0 || typeof classId !== 'string' || classId === '') return null;
  const read = readSending(sending);
  return typeof read === 'string' ? null : { classId, sending: read };
}

/** The insights log, every line that reads, in the store's order. */
function lines(entries: readonly Entry[]): InsightsLogLine[] {
  const out: InsightsLogLine[] = [];
  for (const entry of entries) {
    const event = eventOf(entry);
    if (event?.kind === 'insights.choice' && typeof event.choice?.on === 'boolean') {
      out.push({ kind: event.choice.on ? 'on' : 'off', day: entry.day });
    }
    const sent = event?.kind === 'insights.sent' ? readInsightsSent(event.sent) : null;
    if (sent !== null) out.push({ kind: 'sent', day: entry.day, ...sent });
  }
  return out;
}

/** Whether insights are on: off until turned on, the latest choice counting. */
export function insightsChoice(entries: readonly Entry[]): InsightsChoice {
  let choice: InsightsChoice = { on: false, since: null };
  for (const line of lines(entries)) {
    if (line.kind === 'on') choice = { on: true, since: line.day };
    if (line.kind === 'off') choice = { on: false, since: choice.since };
  }
  return choice;
}

/** The sendings the server took, in the order they were sent. */
export function sentSendings(entries: readonly Entry[]): Extract<InsightsLogLine, { kind: 'sent' }>[] {
  return lines(entries).filter((line) => line.kind === 'sent');
}

/** The insights log, newest day first, each day's lines in the order they happened. */
export function insightsLog(entries: readonly Entry[]): InsightsLogLine[] {
  return lines(entries)
    .map((line, at) => ({ line, at }))
    .sort((a, b) => compareDays(b.line.day, a.line.day) || a.at - b.at)
    .map(({ line }) => line);
}

/** The terms due while insights are on: ended by the date, from the latest ended when they were last turned on. */
export function dueTerms(year: SchoolYear, date: Day, choice: InsightsChoice): (Term & { number: 1 | 2 | 3 })[] {
  if (!choice.on || choice.since === null) return [];
  const since = choice.since;
  const ended = year.terms.filter(
    (one): one is Term & { number: 1 | 2 | 3 } => [1, 2, 3].includes(one.number) && compareDays(one.to, date) <= 0,
  );
  const first = ended.filter((one) => compareDays(one.to, since) <= 0).at(-1);
  return first === undefined ? ended : ended.filter((one) => one.number >= first.number);
}

/** Whether the log holds a class's sending for a year and term. */
export function wasSent(entries: readonly Entry[], classId: string, year: string, term: 1 | 2 | 3): boolean {
  return sentSendings(entries).some(
    (one) => one.classId === classId && one.sending.year === year && one.sending.term === term,
  );
}
