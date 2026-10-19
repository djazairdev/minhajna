// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Never push an item past an exam window silently (#221, PRD §4.7,
// R-4.7-32, answer 268). From today's records and the sessions ahead, the
// plan's own projection says on which day each item would be taught. An
// item the pack places in the window's term or before it, and not a buffer,
// that would still be taught on the window's first day or later, or never
// this year, is past the window. The app warns, and the warning stays until
// the teacher decides: leave out an optional item, merge two items, add a
// make-up session, or postpone the items, which the warning then leaves
// alone. A window that has begun warns no more. Only lessons are checked,
// not TD, which the September check counts apart too. The window is the
// course's own grade's, in a joint class as anywhere.

import { courseSetup } from './choices.ts';
import type { Context } from './context.ts';
import { compareDays, type Day } from './day.ts';
import { walkCourse } from './engine.ts';
import { courseGrade, forGrade } from './joint.ts';
import { queueItems, type PackItem } from './pack.ts';
import { decisionsFor } from './plan-decisions.ts';
import { wholeGroup } from './records.ts';
import type { Confidence } from './reference.ts';
import { sessionsBetween } from './sessions.ts';

export interface PastWindow {
  readonly courseId: string;
  readonly term: number;
  /** The exam window's first and last days, and how sure its date is. */
  readonly window: { readonly from: Day; readonly to: Day; readonly confidence: Confidence };
  /** The items past it, in the plan's order, with the first day they would be taught on or after it. */
  readonly items: readonly { readonly item: PackItem; readonly lands: Day | null }[];
}

/** The items a course's plan would push past its next exam window, as of `today`; null when none. */
export function pastWindow(context: Context, courseId: string, today: Day): PastWindow | null {
  const setup = courseSetup(context, courseId);
  const pack = setup.pack;
  const school = context.state.schools.get(setup.schoolClass.schoolId);
  if (pack === null || school === undefined) return null;
  const exam = context.calendar
    .entriesFor(school, forGrade(setup.schoolClass, courseGrade(setup.course, setup.schoolClass)))
    .filter((entry) => entry.effect === 'exam' && entry.term !== undefined && compareDays(entry.to, today) >= 0)
    .sort((a, b) => compareDays(a.from, b.from))[0];
  if (exam?.term === undefined || compareDays(exam.from, today) <= 0) return null;
  const term = exam.term;

  const postponed = new Set(
    decisionsFor(context.state.decisions, courseId).flatMap((decision) =>
      decision.kind === 'postpone' && decision.term === term ? decision.items : [],
    ),
  );
  const projection = walkCourse(context, courseId, context.ref.year.to);
  const whole = wholeGroup(setup.schoolClass).id;
  const days = new Map<string, Day[]>();
  for (const session of sessionsBetween(context, context.ref.year.from, context.ref.year.to, new Set([courseId]))) {
    const proposal = projection.proposals.get(session.key);
    if (proposal == null) continue;
    for (const item of [proposal.item, proposal.with?.item]) {
      if (item !== undefined) days.set(item.id, [...(days.get(item.id) ?? []), session.day]);
    }
  }

  const items = queueItems(pack, 'main').flatMap((item) => {
    if (item.term === undefined || item.term > term || item.buffer === true || postponed.has(item.id)) return [];
    if (projection.progress.isFinished(pack, item, whole)) return [];
    const proposed = days.get(item.id) ?? [];
    const lands = proposed.find((day) => compareDays(day, exam.from) >= 0) ?? null;
    return lands !== null || proposed.length === 0 ? [{ item, lands }] : [];
  });
  return items.length === 0
    ? null
    : { courseId, term, window: { from: exam.from, to: exam.to, confidence: exam.confidence }, items };
}
