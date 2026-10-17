// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The earlier sessions still awaiting confirmation, for confirming past days
// at once (PRD §2.3, §3.3). A week is shown at a time, the earliest first,
// so the plan goes forward in the order the sessions were taught; each
// session carries the proposal it would be confirmed with, as if the
// earlier ones went as planned. The list is for the screen only: never
// printed, exported or totalled (PRD §3.9), and a session awaiting
// confirmation is never read as an absence (charter point 3).

import type { Context } from './context.ts';
import { addDays, compareDays, minDay, startOfWeek, type Day } from './day.ts';
import { walkCourse, type CourseWalk } from './engine.ts';
import { awaitingBetween, type TodaySession } from './today.ts';

export interface BacklogDay {
  readonly day: Day;
  readonly sessions: readonly TodaySession[];
}

export interface Backlog {
  /** The first day of the week shown, or null when nothing earlier awaits confirmation. */
  readonly week: Day | null;
  /** The week's days with sessions awaiting confirmation, in order. */
  readonly days: readonly BacklogDay[];
  /** Every earlier session awaiting confirmation, in this week and the ones after it. */
  readonly awaiting: number;
}

/** The earliest week of sessions before `day` still awaiting confirmation. */
export function backlogOf(context: Context, day: Day): Backlog {
  const { ref } = context;
  const before = addDays(day, -1);
  const all = compareDays(before, ref.year.from) < 0 ? [] : awaitingBetween(context, ref.year.from, before);
  const [first] = all;
  if (first === undefined) return { week: null, days: [], awaiting: 0 };

  const week = startOfWeek(first.day, ref.country.weekStartsOn);
  const end = minDay(addDays(week, 6), before);
  const shown = all.filter((session) => compareDays(session.day, end) <= 0);
  const walks = new Map<string, CourseWalk>();
  for (const id of new Set(shown.map((session) => session.courseId))) walks.set(id, walkCourse(context, id, end));

  const days: { day: Day; sessions: TodaySession[] }[] = [];
  for (const session of shown) {
    const walk = walks.get(session.courseId);
    if (walk === undefined) continue;
    const item: TodaySession = {
      session,
      course: walk.setup.course,
      status: 'awaiting',
      proposal: walk.proposals.get(session.key) ?? null,
      record: null,
      packMissing: walk.setup.packMissing,
    };
    const last = days.at(-1);
    if (last?.day === session.day) last.sessions.push(item);
    else days.push({ day: session.day, sessions: [item] });
  }
  return { week, days, awaiting: all.length };
}
