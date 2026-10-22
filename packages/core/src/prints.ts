// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the teacher has printed (#215, Print-set, R-3.8-55): each time the
// week's print set goes to a printer or to the print shop's PDF, the history
// keeps which documents it held and the days each covered, so the next set
// can offer what is new since. A print counts no later than the day it was
// made, as days printed ahead may still change, and a reprint of older days
// never moves a document's last printed day back. A document printed whole,
// such as the front pages before the year starts, counts as far as it went.
// A primary re-pace draft printed for the director is kept too, with the
// choices ticked on it (#229, repace-print.ts). A document printed or saved
// as a PDF from its own output is kept apart, for the activity log only
// (#235, answer 426). The records are the teacher's own and stay private
// (PRD §5.4).

import { compareDays, minDay, type Day } from './day.ts';
import type { State } from './state.ts';

/** A document the set held: its name, as the app calls it, such as `journal`, and the days it covered. */
export interface PrintedDocument {
  readonly id: string;
  readonly from: Day;
  readonly to: Day;
  /** For a re-pace draft, the keys of the choices ticked on it. */
  readonly choices?: readonly string[];
}

/** One print of the set. */
export interface PrintRecord {
  readonly id: string;
  readonly documents: readonly PrintedDocument[];
}

/** A document printed or saved as a PDF from its output: never its content, file name or recipient. */
export interface OutputRecord {
  readonly id: string;
  /** The document's name, as the app calls it, such as `journal`. */
  readonly document: string;
  /** What it covered, as its file is named: a day, a month such as `2026-10`, or a school year such as `2026-2027`. */
  readonly period: string;
  readonly how: 'print' | 'pdf';
  readonly blank: boolean;
}

/** A document's last print: its day, the last day its prints covered up to each one's day, and the last at all. */
export interface LastPrint {
  readonly day: Day;
  readonly through: Day;
  /** The last day any print covered, ahead of its day too, for a document printed whole, such as the timetable. */
  readonly reached: Day;
}

const later = (a: Day, b: Day) => (compareDays(a, b) > 0 ? a : b);

/** When a document was last printed, and the days its prints covered; null when it never was. */
export function lastPrinted(state: Pick<State, 'prints'>, document: string): LastPrint | null {
  let found: LastPrint | null = null;
  for (const version of state.prints) {
    for (const one of version.value.documents) {
      if (one.id !== document) continue;
      const to = minDay(one.to, version.day);
      found = {
        day: version.day,
        through: found === null ? to : later(to, found.through),
        reached: found === null ? one.to : later(one.to, found.reached),
      };
    }
  }
  return found;
}

/** Whether a print held the document up to exactly `day`, such as the timetable's version from the day it applies. */
export function printedTo(state: Pick<State, 'prints'>, document: string, day: Day): boolean {
  return state.prints.some((version) => version.value.documents.some((one) => one.id === document && one.to === day));
}

/**
 * Whether the document was printed with `entry`'s day on or before `day`, so
 * a change made that day may be on paper already and needs correcting there
 * too (#218). The history keeps days, not times, so a print on the day of
 * the change counts as before it.
 */
export function printedBefore(state: Pick<State, 'prints'>, document: string, entry: Day, day: Day): boolean {
  return state.prints.some(
    (version) =>
      compareDays(version.day, day) <= 0 &&
      version.value.documents.some(
        (one) =>
          one.id === document &&
          compareDays(one.from, entry) <= 0 &&
          compareDays(entry, minDay(one.to, version.day)) <= 0,
      ),
  );
}
