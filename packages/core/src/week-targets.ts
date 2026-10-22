// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A hybrid plan's weekly targets (#231, Plan-lycee, R-4.2-03, answer 387):
// the last main item a hybrid pack marks with week N is due by the end of
// the class's Nth teaching week, holiday weeks skipped. Each target says
// whether the class has reached it, and how many main sessions are left
// until it beside how many the items up to it still need, buffers aside, so
// the plan can say in time whether it will be reached. The expected position
// stays the budgets'; a remediation week stays a buffer.

import { courseSetup } from './choices.ts';
import type { Context } from './context.ts';
import { addDays, compareDays, weekday, type Day } from './day.ts';
import { walkCourse } from './engine.ts';
import { budgetInSessions, queueItems, type PackItem, type PlanPack } from './pack.ts';
import { itemShare, queueOf } from './pacing.ts';
import { wholeGroup, type School } from './records.ts';
import { halfTurns, rotationCredits } from './rotation-sessions.ts';
import { sessionsBetween, type Session } from './sessions.ts';
import { current } from './versions.ts';

export interface WeekTarget {
  readonly week: number;
  /** The last main item the pack marks with the week. */
  readonly item: PackItem;
  /** The last school day of the class's teaching week; null when the year has fewer teaching weeks. */
  readonly due: Day | null;
  readonly reached: boolean;
  /**
   * The main sessions from `today` to the due day still awaiting confirmation, a half-group pair counted once, on the
   * day its second half has it, as the term check counts them.
   */
  readonly left: number;
  /** The sessions the items up to the target still need, by their budgets; buffers, such as remediation, aside. */
  readonly needed: number;
}

/** The target week an item of a hybrid pack counts toward: its own, or that of the next item marked; null otherwise. */
export function targetWeekOf(pack: PlanPack | null | undefined, itemId: string): number | null {
  if (pack?.anchor.kind !== 'hybrid') return null;
  const items = queueItems(pack, 'main');
  const index = items.findIndex((item) => item.id === itemId);
  return index < 0 ? null : (items.slice(index).find((item) => item.week !== undefined)?.week ?? null);
}

/** A course's weekly targets, in week order, as of `today`; none unless its pack is hybrid and in use. */
export function weekTargets(context: Context, courseId: string, today: Day): WeekTarget[] {
  const setup = courseSetup(context, courseId);
  const { pack, schoolClass } = setup;
  const school = context.state.schools.get(schoolClass.schoolId);
  if (pack === null || setup.packStale || pack.anchor.kind !== 'hybrid' || school === undefined) return [];
  const items = queueItems(pack, 'main');
  const last = new Map<number, number>();
  items.forEach((item, index) => item.week !== undefined && last.set(item.week, index));
  const whole = wholeGroup(schoolClass).id;
  const progress = walkCourse(context, courseId, today).progress;
  const budget = (item: PackItem) => budgetInSessions(pack, item, setup.sessionMinutes);
  const owed = items.map((item) =>
    item.buffer === true ? 0 : budget(item) * (1 - itemShare(pack, progress, item, whole, budget(item))),
  );
  const weeks = context.calendar.teachingWeeks(school);
  const turns = halfTurns(context);
  const main = (session: Session) => session.calendar === null && queueOf(context, session) === 'main';
  const onRecord = (session: Session) => current(context.state.sessions.get(session.key)) !== null;
  const recorded = sessionsBetween(context, context.ref.year.from, today, new Set([courseId])).filter(
    (session) => main(session) && onRecord(session),
  );
  const credits = rotationCredits(recorded, turns);
  return [...last.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, index]) => {
      const item = items[index]!;
      const start = weeks[week - 1]?.start;
      const due = start === undefined ? null : lastSchoolDay(context, school, start);
      const left =
        due === null || compareDays(due, today) < 0
          ? 0
          : rotationCredits(
              [
                ...recorded,
                ...sessionsBetween(context, today, due, new Set([courseId])).filter(
                  (session) => main(session) && !onRecord(session),
                ),
              ],
              turns,
            ) - credits;
      const needed = owed.slice(0, index + 1).reduce((sum, one) => sum + one, 0);
      return { week, item, due, reached: progress.isFinished(pack, item, whole), left, needed };
    });
}

/** The last school day of the week that starts on `start`. */
function lastSchoolDay(context: Context, school: School, start: Day): Day {
  const { workingDays } = context.ref.country;
  for (let offset = 6; offset > 0; offset -= 1) {
    const day = addDays(start, offset);
    if (workingDays.includes(weekday(day)) && context.calendar.info(day, school).schoolDay) return day;
  }
  return start;
}
