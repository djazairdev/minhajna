// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Time is counted in sessions, not hours (PRD §4.7). Sessions lost to the
// calendar are counted apart, so a closure never reads as slow teaching, and
// the plan's own buffers absorb a delay before any delay is shown. Figures
// are stated as facts for the teacher alone (PRD §3.1, rule 8).
//
// Only recorded sessions place the class. A session still awaiting
// confirmation is counted apart and never reads as a delay: a missing entry
// is never an absence (PRD §2.3, rule 5).

import type { Context } from './context.ts';
import { addDays, compareDays, isWithin, type Day } from './day.ts';
import { courseSetup, type CourseSetup } from './choices.ts';
import { walkCourse } from './engine.ts';
import type { Progress } from './progress.ts';
import { budgetInSessions, queueItems, stageCount, type PackItem, type PlanPack } from './pack.ts';
import { findSessionType, type Queue } from './reference.ts';
import { sessionsBetween, type Session } from './sessions.ts';
import { current } from './state.ts';

export interface Pace {
  /** Ordinary sessions of the main plan recorded so far, held or not. */
  readonly recorded: number;
  /**
   * Sessions lost to the calendar so far, by cause. `teacher` counts those
   * lost to the teacher's own calendar, such as training days: it is
   * private, and only the teacher sees it (PRD §4.5).
   */
  readonly lost: { readonly holiday: number; readonly closure: number; readonly teacher: number };
  /** Where the class is, in sessions of the plan's budgets. */
  readonly position: number;
  /** Where the plan says the class should be, in the same unit. Only a reference (PRD §4.7). */
  readonly expected: number;
  /** Behind the plan, but within the buffers left before the next exams. */
  readonly bufferUsed: number;
  /** Behind the plan beyond the buffers, in sessions. */
  readonly delay: number;
  /** Ahead of the plan, in sessions. */
  readonly ahead: number;
  /** For week packs: plan weeks behind, beyond the buffers. Null for other packs. */
  readonly weeksBehind: number | null;
  /** Sessions still awaiting confirmation. They do not move the position. */
  readonly awaiting: number;
}

function queueOf(context: Context, session: Session): string {
  const record = current(context.state.sessions.get(session.key));
  return findSessionType(context.ref.country, record?.sessionType ?? session.sessionType).queue;
}

/**
 * How much of an item's budget the class has used, from 0 to 1. Finished and
 * skipped items count in full. An item with stages is measured by its
 * stages. One without runs as "in progress / done", so the sessions spent on
 * it are all there is.
 */
function share(pack: PlanPack, progress: Progress, item: PackItem, groupId: string, budget: number): number {
  if (progress.isFinished(pack, item, groupId)) return 1;
  const stages = stageCount(pack, item);
  if (stages > 1) return progress.covered(item.id, groupId) / stages;
  return Math.min(1, progress.spent(item.id, groupId) / budget);
}

function queueSessions(context: Context, setup: CourseSetup, from: Day, to: Day, queue: Queue): Session[] {
  return sessionsBetween(context, from, to, new Set([setup.course.id])).filter(
    (session) => queueOf(context, session) === queue,
  );
}

/** A TD item's term: its own, or else the last term its unit's lessons fall in. */
function tdTerm(pack: PlanPack, item: PackItem): number | undefined {
  if (item.term !== undefined || item.unit === undefined) return item.term;
  const terms = pack.items.flatMap((other) =>
    other.unit === item.unit && other.kind !== 'td' && other.term !== undefined ? [other.term] : [],
  );
  return terms.length === 0 ? undefined : Math.max(...terms);
}

function nextExamTerm(context: Context, setup: CourseSetup, today: Day): number | undefined {
  const school = context.state.schools.get(setup.schoolClass.schoolId);
  if (school === undefined) return undefined;
  const exams = context.calendar
    .entriesFor(school, setup.schoolClass)
    .filter((entry) => entry.effect === 'exam' && entry.term !== undefined && compareDays(entry.to, today) >= 0)
    .sort((a, b) => compareDays(a.from, b.from));
  return exams[0]?.term ?? context.ref.year.terms.find((term) => isWithin(today, term.from, term.to))?.number;
}

/**
 * Where a course stands against its plan on `today`. Null without a pack.
 *
 * Week packs place the class by the teaching week: the weeks so far in
 * which the class had a recorded session of this subject.
 */
export function pace(context: Context, courseId: string, today: Day): Pace | null {
  const setup = courseSetup(context, courseId);
  const pack = setup.pack;
  if (pack === null) return null;
  const { calendar, ref, state } = context;
  const whole = setup.schoolClass.groups.find((group) => group.kind === 'whole')?.id ?? '';
  const progress = walkCourse(context, courseId, today).progress;
  const sessions = queueSessions(context, setup, ref.year.from, today, 'main');
  const ordinary = sessions.filter((session) => session.calendar === null);
  const recorded = ordinary.filter((session) => current(state.sessions.get(session.key)) !== null);
  const items = queueItems(pack, 'main');
  const budgets = new Map(items.map((item) => [item.id, budgetInSessions(pack, item, setup.sessionMinutes)]));
  const budgetOf = (item: PackItem): number => budgets.get(item.id) ?? 1;
  const total = items.reduce((sum, item) => sum + budgetOf(item), 0);
  const position = items.reduce(
    (sum, item) => sum + budgetOf(item) * share(pack, progress, item, whole, budgetOf(item)),
    0,
  );

  let expected = Math.min(total, recorded.length);
  let weeksBehind: number | null = null;
  if (pack.anchor.kind === 'weeks') {
    const school = state.schools.get(setup.schoolClass.schoolId);
    const weekStarts = new Set<string>();
    for (const session of recorded) {
      const week = school === undefined ? null : calendar.weekOf(session.day, school);
      if (week !== null) weekStarts.add(week.start);
    }
    const planWeek = weekStarts.size;
    const lastWeekStart = [...weekStarts].at(-1);
    const thisWeek = recorded.filter((session) => {
      const week = school === undefined ? null : calendar.weekOf(session.day, school);
      return week !== null && week.start === lastWeekStart;
    }).length;
    const before = items.filter((item) => (item.week ?? 0) < planWeek).reduce((sum, item) => sum + budgetOf(item), 0);
    const during = items.filter((item) => item.week === planWeek).reduce((sum, item) => sum + budgetOf(item), 0);
    expected = before + Math.min(during, thisWeek);
    const firstOpen = items.find((item) => !progress.isFinished(pack, item, whole));
    weeksBehind = firstOpen?.week === undefined ? 0 : Math.max(0, planWeek - firstOpen.week);
  }

  const term = nextExamTerm(context, setup, today);
  const bufferLeft = items
    .filter((item) => item.buffer === true && (term === undefined || item.term === undefined || item.term === term))
    .reduce((sum, item) => sum + budgetOf(item) * (1 - share(pack, progress, item, whole, budgetOf(item))), 0);

  const behind = expected - position;
  const delay = Math.max(0, behind - bufferLeft);
  return {
    recorded: recorded.length,
    lost: {
      holiday: sessions.filter((session) => session.calendar === 'holiday').length,
      closure: sessions.filter((session) => session.calendar === 'closure').length,
      teacher: sessions.filter((session) => session.calendar === 'teacher').length,
    },
    position,
    expected,
    bufferUsed: Math.min(Math.max(0, behind), bufferLeft),
    delay,
    ahead: Math.max(0, -behind),
    weeksBehind: weeksBehind === null ? null : delay > 0 ? weeksBehind : 0,
    awaiting: ordinary.length - recorded.length,
  };
}

export interface TermCheck {
  readonly term: number;
  /** The first day of the term's exams, or the day after the term when no exam window is known yet. */
  readonly before: Day;
  readonly basis: 'exam-window' | 'term-end';
  /** Sessions the plan still needs before then. */
  readonly needs: number;
  /** Sessions the timetable and the calendar give from `from` until then. */
  readonly gives: number;
  /**
   * TD has its own queue, counted apart: it never adds to the plan's
   * sessions nor to its spare ones (PRD §4.7). `items` are the TD items
   * still to do before then, and `gives` the TD sessions left.
   */
  readonly td: { readonly gives: number; readonly items: number };
}

/**
 * The September check: "The plan needs N sessions before the term-1 exams.
 * Your timetable and the calendar give M." (PRD §4.7). Null without a pack,
 * or when the pack does not place its items in terms.
 *
 * Every recorded session counts towards the progress, and `gives` counts
 * only sessions not yet recorded. A fraction of a session still needs a
 * whole session.
 */
export function termCheck(context: Context, courseId: string, from: Day, termNumber?: number): TermCheck | null {
  const setup = courseSetup(context, courseId);
  const pack = setup.pack;
  if (pack === null) return null;
  const { ref, state, calendar } = context;
  const term = ref.year.terms.find((candidate) =>
    termNumber === undefined ? isWithin(from, candidate.from, candidate.to) : candidate.number === termNumber,
  );
  const items = queueItems(pack, 'main');
  if (term === undefined || !items.some((item) => item.term !== undefined)) return null;

  const school = state.schools.get(setup.schoolClass.schoolId);
  const exam = school
    ? calendar
        .entriesFor(school, setup.schoolClass)
        .filter((entry) => entry.effect === 'exam' && entry.term === term.number)
        .sort((a, b) => compareDays(a.from, b.from))[0]
    : undefined;
  const before = exam?.from ?? addDays(term.to, 1);

  const whole = setup.schoolClass.groups.find((group) => group.kind === 'whole')?.id ?? '';
  const progress = walkCourse(context, courseId, addDays(before, -1)).progress;
  const needs = items
    .filter((item) => item.term !== undefined && item.term <= term.number)
    .reduce((sum, item) => {
      const budget = budgetInSessions(pack, item, setup.sessionMinutes);
      return sum + budget * (1 - share(pack, progress, item, whole, budget));
    }, 0);
  const open = (queue: Queue): number =>
    compareDays(from, before) < 0
      ? queueSessions(context, setup, from, addDays(before, -1), queue).filter(
          (session) => session.calendar === null && current(state.sessions.get(session.key)) === null,
        ).length
      : 0;
  const tdItems = queueItems(pack, 'td').filter((item) => {
    const itemTerm = tdTerm(pack, item);
    if (itemTerm === undefined || itemTerm > term.number) return false;
    return share(pack, progress, item, whole, budgetInSessions(pack, item, setup.sessionMinutes)) < 1;
  });

  return {
    term: term.number,
    before,
    basis: exam === undefined ? 'term-end' : 'exam-window',
    needs: Math.ceil(needs - 1e-9),
    gives: open('main'),
    td: { gives: open('td'), items: tdItems.length },
  };
}
