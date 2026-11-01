// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's standing on the director's dashboard, read from its course's signed
// weeks (#549, answer 627), never from a statement, which stays the teacher's
// printed projection. Each week counts at the version given, the latest read;
// the class's place in the plan is the furthest item of its pinned pack, in the
// plan's order, that any signed week worked on, so going back over an earlier
// item does not move it back, an item the pack does not hold left out; how far
// it has reached and whether it runs long come from its latest week; the
// sessions not held are those lost to a closure, as the weeks' totals count
// them, and those for any other cause, every session not held on a day that is
// neither a closure nor an exam day, since exams replace lessons and are not
// losses, each session's day counted from its week's own first day; and the
// sessions awaiting confirmation are counted for the screen alone. A course
// with no signed week has no standing.

import { addDays, compareDays, weekday, type Day } from './day.ts';
import type { PackItem } from './pack.ts';
import type { StatementItem } from './statement-read.ts';
import type { WeekRecord } from './week-record.ts';

/** What the school's space holds for a class and subject once its teacher has signed a week. */
export interface CourseStanding {
  /** The furthest item of the plan, in its order, that a signed week worked on, or null before any. */
  readonly position: StatementItem | null;
  /** How far the class has reached, in thousandths of the plan's budget, on its latest week. */
  readonly reached: number;
  /** Whether the budget left is more than the year's remaining sessions give at the class's pace, on the last week. */
  readonly runsLong: boolean;
  /** Sessions not held for a closure, and for any other cause, exam days left out. */
  readonly notHeld: { readonly closure: number; readonly other: number };
  /** Sessions awaiting confirmation: shown on the screen only, never printed, exported, totalled or kept. */
  readonly awaiting: number;
}

/** A class's standing from its course's weeks, each once, or null when none was signed. */
export function weekStanding(
  weeks: readonly WeekRecord[],
  items: readonly PackItem[],
  calendar: { readonly closure: (day: Day) => boolean; readonly exam: (day: Day) => boolean },
): CourseStanding | null {
  const sorted = [...weeks].sort((a, b) => compareDays(a.week, b.week));
  const latest = sorted.at(-1);
  if (latest === undefined) return null;
  const order = new Map(items.map((one, at) => [one.id, at]));
  let [last, closure, other, awaiting] = [-1, 0, 0, 0];
  for (const week of sorted) {
    for (const one of week.totals.items) {
      const at = order.get(one.item);
      if (one.sessions > 0 && at !== undefined && at > last) last = at;
    }
    for (const session of week.sessions) {
      const day = addDays(week.week, (session.day - weekday(week.week) + 7) % 7);
      if (session.state === 'awaiting') awaiting += 1;
      else if (session.state === 'not-held' && !calendar.closure(day) && !calendar.exam(day)) other += 1;
    }
    closure += week.totals.closed;
  }
  const item = items[last];
  return {
    position: item === undefined ? null : { id: item.id, title: item.title },
    reached: latest.totals.reached,
    runsLong: latest.totals.runsLong,
    notHeld: { closure, other },
    awaiting,
  };
}
