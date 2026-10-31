// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The trial term end before the national launch (#565, PRD §7.5, R-7.5-05,
// answer 587). Joining the school's space is compulsory from the launch; during
// the trial term end before it, taking part is voluntary, paper stays the
// official record, and a class whose teacher has not joined shows its timetable
// only, marked as not joined. A teacher who joined stays joined. In a demo
// world, the trial is the last four weeks of the first term, which the world
// starts at, counted back from the start of its last week, holidays included,
// so the world opens in its trial; once the starter moves the world's date past
// the term's end, the launch has passed. Every rule here reads the world's
// date, never the device's clock.

import { addDays, isWithin, maxDay, startOfWeek, type Day, type Weekday } from './day.ts';
import type { SchoolYear } from './reference.ts';

/** How many weeks the trial term end lasts, its term's last week included. */
export const TRIAL_WEEKS = 4;

/** A trial term end: its first and last days, and the term and year it ends. */
export interface TrialTerm {
  readonly from: Day;
  readonly to: Day;
  readonly term: number;
  /** As the documents print it, such as `2026-2027`. */
  readonly year: string;
}

/** Where a teacher stands with the school's space: joined, free not to during the trial, or to join. */
export type SpaceStanding = 'joined' | 'not-joined' | 'to-join';

/** A demo world's trial term end: the first term's last four weeks, or null for a year with no term. */
export function trialTermEnd(year: SchoolYear, weekStartsOn: Weekday): TrialTerm | null {
  const first = year.terms[0];
  if (first === undefined) return null;
  const from = addDays(startOfWeek(first.to, weekStartsOn), -7 * (TRIAL_WEEKS - 1));
  return { from: maxDay(first.from, from), to: first.to, term: first.number, year: year.id };
}

/** Whether joining is the teacher's free choice on the world's date: only inside the trial term end. */
export function joiningIsVoluntary(trial: TrialTerm | null, date: Day): boolean {
  return trial !== null && isWithin(date, trial.from, trial.to);
}

/**
 * Where a teacher stands on the world's date: joined once they joined, whatever the date; during the trial, not
 * joined, which leaves their class with its timetable only; otherwise to join, as joining is compulsory.
 */
export function spaceStanding(trial: TrialTerm | null, date: Day, joined: boolean): SpaceStanding {
  if (joined) return 'joined';
  return joiningIsVoluntary(trial, date) ? 'not-joined' : 'to-join';
}
