// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The timetable versions that apply (PRD §4.6). A version saved again under
// its ID while the week is drawn replaces itself, so drawing a week adds one
// version, not one for each change. A version recorded later replaces any
// earlier one that has not started by its first day, such as a week drawn
// during setup and corrected before the year begins.

import { compareDays, maxDay, type Day } from './day.ts';
import type { TimetableVersion } from './records.ts';

/** A timetable version, the day it was recorded, and the first day it applies (PRD §4.6). */
export interface RecordedTimetable {
  readonly version: TimetableVersion;
  /** The day of its history entry. */
  readonly recorded: Day;
  /** Its own `from` for the first version, and never earlier than `recorded` for a later one. */
  readonly from: Day;
}

/**
 * Adds a timetable version recorded on `day`. Saved again under the ID of the last one, it replaces it and keeps the
 * day that one was recorded. The first version, `firstId`, applies from its own day, so setup can fill in the weeks
 * already gone. A later one never reaches back before the day it was recorded, and it takes the place of every earlier
 * one that would start on its first day or later, none of which has applied before that day: the past never moves
 * (PRD §4.6).
 */
export function addTimetable(
  timetables: RecordedTimetable[],
  version: TimetableVersion,
  day: Day,
  firstId: string,
): void {
  const redrawn = timetables.at(-1)?.version.id === version.id ? timetables.pop() : undefined;
  const recorded = redrawn?.recorded ?? day;
  const first = version.id === firstId && (redrawn !== undefined || timetables.length === 0);
  const from = first ? version.from : maxDay(version.from, recorded);
  const kept = timetables.filter((timetable) => compareDays(timetable.from, from) < 0);
  timetables.splice(0, timetables.length, ...kept, { version, recorded, from });
}
