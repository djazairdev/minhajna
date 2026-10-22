// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Parallel classes drifting apart before a common test or an exam window
// (#225, PRD §4.7, R-4.7-37, answers 292 to 295). For the next one, the
// common test this class has scheduled or its next exam window, whichever
// comes first, each parallel class's plan is walked to the day before, as
// it stands. Its place is the pack content it would have covered by then,
// whatever the order: each item of its pack's main queue counts its own
// budget in sessions times the share covered, the parts of a split
// together, a skipped item as covered, and an item the class added not at
// all. So moving items, aligning one included, never changes the gap.
// The class is warned when another would be two sessions or more apart.
// Parallel classes may be on different releases; each counts its own.

import { courseSetup } from './choices.ts';
import type { Context } from './context.ts';
import { addDays, compareDays, type Day } from './day.ts';
import { walkCourse } from './engine.ts';
import { nextExams } from './exam-window.ts';
import { budgetInSessions, queueItems, type PackItem, type PlanPack } from './pack.ts';
import { itemShare } from './pacing.ts';
import { parallelCourses } from './plan-changes.ts';
import { addedId } from './plan-layer.ts';
import { packKey } from './reference.ts';
import { wholeGroup } from './records.ts';

/** The gap, in sessions, from which parallel classes count as drifted apart (answer 292). */
export const DRIFT_SESSIONS = 2;

export interface Drift {
  /** The common test or the exam window the classes are measured before. */
  readonly before:
    | { readonly kind: 'test'; readonly day: Day; readonly title: string }
    | { readonly kind: 'exams'; readonly day: Day; readonly term: number };
  /** The parallel course furthest from this one. */
  readonly other: string;
  /** Whole sessions between the two classes, at least `DRIFT_SESSIONS`. */
  readonly gap: number;
  /** Whether this class would be behind the other. */
  readonly behind: boolean;
  /** The item each class would be on, if any is left. */
  readonly here: PackItem | undefined;
  readonly there: PackItem | undefined;
}

/** The next common test of the course or its next exam window, from `today` on, whichever comes first. */
function nextFixedPoint(context: Context, courseId: string, today: Day): Drift['before'] | null {
  const test = [...context.state.tests.values()]
    .filter((one) => one.courseId === courseId && one.common === true && compareDays(one.day, today) >= 0)
    .sort((a, b) => compareDays(a.day, b.day))[0];
  const exams = nextExams(context, courseId, today);
  const window =
    exams?.term !== undefined && compareDays(exams.from, today) >= 0
      ? { kind: 'exams' as const, day: exams.from, term: exams.term }
      : undefined;
  if (test !== undefined && (window === undefined || compareDays(test.day, window.day) <= 0)) {
    return { kind: 'test', day: test.day, title: test.title };
  }
  return window ?? null;
}

/** The sessions of its own pack's main content a course would have covered on `day`, and the item it would be on. */
function placeOn(context: Context, courseId: string, day: Day): { at: number; item: PackItem | undefined } | null {
  const setup = courseSetup(context, courseId);
  const pin = setup.course.pack;
  const raw: PlanPack | undefined = pin === null ? undefined : context.ref.packs.get(packKey(pin.id, pin.release));
  const plan = setup.pack;
  if (raw === undefined || plan === null || setup.packStale) return null;
  const progress = walkCourse(context, courseId, day).projected;
  const whole = wholeGroup(setup.schoolClass).id;
  const sessionsOf = (pack: PlanPack, item: PackItem): number => budgetInSessions(pack, item, setup.sessionMinutes);
  const shareOf = (item: PackItem): number => itemShare(plan, progress, item, whole, sessionsOf(plan, item));
  const planMain = queueItems(plan, 'main');
  const at = queueItems(raw, 'main').reduce((sum, item) => {
    const parts = planMain.filter(
      (one) => one.id === item.id || (one.id.startsWith(`${item.id}~`) && !one.id.startsWith(addedId(''))),
    );
    const weights = parts.map((part) => sessionsOf(plan, part));
    const weight = weights.reduce((total, one) => total + one, 0);
    const done = parts.reduce((total, part, n) => total + weights[n]! * shareOf(part), 0);
    return sum + sessionsOf(raw, item) * (weight > 0 ? done / weight : 1);
  }, 0);
  return { at, item: planMain.find((item) => shareOf(item) < 1) };
}

/** The drift to warn about before the course's next common test or exam window, as of `today`; null when none. */
export function driftBefore(context: Context, courseId: string, today: Day): Drift | null {
  const others = parallelCourses(context, courseId);
  if (others.length === 0) return null;
  const before = nextFixedPoint(context, courseId, today);
  if (before === null) return null;
  const day = addDays(before.day, -1);
  const here = placeOn(context, courseId, day);
  if (here === null) return null;
  let found: Drift | null = null;
  for (const other of others) {
    const there = placeOn(context, other.id, day);
    if (there === null) continue;
    const gap = Math.floor(Math.abs(here.at - there.at) + 1e-9);
    if (gap >= DRIFT_SESSIONS && (found === null || gap > found.gap)) {
      found = { before, other: other.id, gap, behind: here.at < there.at, here: here.item, there: there.item };
    }
  }
  return found;
}
