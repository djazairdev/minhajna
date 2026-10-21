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
import { addDays, compareDays, isWithin, maxDay, type Day } from './day.ts';
import { courseSetup, type CourseSetup } from './choices.ts';
import { walkCourse } from './engine.ts';
import { courseGrade, forGrade } from './joint.ts';
import type { Progress } from './progress.ts';
import { budgetInSessions, queueItems, stageCount, type PackItem, type PlanPack } from './pack.ts';
import { findSessionType, type CalendarEntry, type Confidence, type Queue } from './reference.ts';
import { compareSessions, sessionsBetween, type Session } from './sessions.ts';
import { current } from './state.ts';
import { rotationCredits } from './rotation-sessions.ts';

export interface Pace {
  /** Ordinary sessions of the main plan recorded so far, held or not. */
  readonly recorded: number;
  /**
   * Sessions lost to the calendar so far, by cause. `teacher` counts those
   * lost to the teacher's own calendar, such as training days: it is
   * private, and only the teacher sees it (PRD §4.5).
   */
  readonly lost: {
    readonly holiday: number;
    readonly closure: number;
    readonly teacher: number;
    readonly rotation: number;
  };
  /** Where the class is, in sessions of the plan's budgets. */
  readonly position: number;
  /** Where the plan says the class should be, in the same unit. Only a reference (PRD §4.7). */
  readonly expected: number;
  /** Behind the plan, but within the buffers left before the next exams. */
  readonly bufferUsed: number;
  /** The buffers still left before the next exams, once those used are taken off. */
  readonly bufferLeft: number;
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
export function itemShare(pack: PlanPack, progress: Progress, item: PackItem, groupId: string, budget: number): number {
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

/** Where what is left of a session's item goes on. */
export interface CarryTo {
  /** The next session of the same class, group and subject in the same queue. */
  readonly next: Session | null;
  /** The first session of another kind before it, such as a test, which the item passes over. */
  readonly passed: Session | null;
}

/**
 * Where what is left of this session's item goes on (PRD §4.7): the next
 * session of the same class, group and subject in the same queue, never a
 * TD, remediation or exam session in between, nor one the calendar takes.
 * Looks eight weeks ahead.
 */
export function carryTo(context: Context, session: Session): CarryTo {
  const queue = queueOf(context, session);
  const later = sessionsBetween(context, session.day, addDays(session.day, 56), new Set([session.courseId])).filter(
    (other) => other.groupId === session.groupId && other.calendar === null && compareSessions(other, session) > 0,
  );
  const at = later.findIndex((other) => queueOf(context, other) === queue);
  return { next: later[at] ?? null, passed: at > 0 ? (later[0] ?? null) : null };
}

/** A TD item's term: its own, or else the last term its unit's lessons fall in. */
function tdTerm(pack: PlanPack, item: PackItem): number | undefined {
  if (item.term !== undefined || item.unit === undefined) return item.term;
  const terms = pack.items.flatMap((other) =>
    other.unit === item.unit && other.kind !== 'td' && other.term !== undefined ? [other.term] : [],
  );
  return terms.length === 0 ? undefined : Math.max(...terms);
}

/** The term whose exams come next on `today`, or the term `today` is in when no exam window is known. */
export function nextExamTerm(context: Context, setup: CourseSetup, today: Day): number | undefined {
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
    (sum, item) => sum + budgetOf(item) * itemShare(pack, progress, item, whole, budgetOf(item)),
    0,
  );

  let expected = Math.min(total, rotationCredits(recorded));
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
    expected = Math.max(0, before + Math.min(during, thisWeek) - (recorded.length - rotationCredits(recorded)));
    const firstOpen = items.find((item) => !progress.isFinished(pack, item, whole));
    weeksBehind = firstOpen?.week === undefined ? 0 : Math.max(0, planWeek - firstOpen.week);
  }

  const term = nextExamTerm(context, setup, today);
  const bufferLeft = items
    .filter((item) => item.buffer === true && (term === undefined || item.term === undefined || item.term === term))
    .reduce((sum, item) => sum + budgetOf(item) * (1 - itemShare(pack, progress, item, whole, budgetOf(item))), 0);

  const behind = expected - position;
  const delay = Math.max(0, behind - bufferLeft);
  return {
    recorded: recorded.length,
    lost: {
      holiday: sessions.filter((session) => session.calendar === 'holiday').length,
      closure: sessions.filter((session) => session.calendar === 'closure').length,
      teacher: sessions.filter((session) => session.calendar === 'teacher').length,
      rotation:
        ordinary.length -
        rotationCredits(ordinary) +
        sessions.filter((session) => session.calendar === 'rotation').length,
    },
    position,
    expected,
    bufferUsed: Math.min(Math.max(0, behind), bufferLeft),
    bufferLeft: bufferLeft - Math.min(Math.max(0, behind), bufferLeft),
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
  /** How sure the exam window's date is; null when the term's end is used. */
  readonly confidence: Confidence | null;
  /** Sessions the plan still needs before then. */
  readonly needs: number;
  /** Sessions the timetable and the calendar give from `from` until then. */
  readonly gives: number;
  /** Plan items before then that do not fit in the sessions it gives, in plan order; 0 once then is past. */
  readonly itemsAfter: number;
  /** Sessions given after the exam window's last part until the term's end (answer 323); null without a window. */
  readonly afterExams: number | null;
  /** The first moved part of the exam window: its dates before an update moved it, and why (R-7.10-06). */
  readonly moved: CalendarEntry['moved'] | null;
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
  const parts = (
    school ? calendar.entriesFor(school, forGrade(setup.schoolClass, courseGrade(setup.course, setup.schoolClass))) : []
  )
    .filter((entry) => entry.effect === 'exam' && entry.term === term.number)
    .sort((a, b) => compareDays(a.from, b.from));
  const exam = parts[0];
  const before = exam?.from ?? addDays(term.to, 1);

  const whole = setup.schoolClass.groups.find((group) => group.kind === 'whole')?.id ?? '';
  const progress = walkCourse(context, courseId, addDays(before, -1)).progress;
  const left = items
    .filter((item) => item.term !== undefined && item.term <= term.number)
    .map((item) => {
      const budget = budgetInSessions(pack, item, setup.sessionMinutes);
      return budget * (1 - itemShare(pack, progress, item, whole, budget));
    });
  const needs = left.reduce((sum, rest) => sum + rest, 0);
  const open = (queue: Queue, until = addDays(before, -1), start = from): number => {
    if (compareDays(start, until) > 0) return 0;
    const all = queueSessions(context, setup, ref.year.from, until, queue);
    const recorded = all.filter((session) => current(state.sessions.get(session.key)) !== null);
    const future = all.filter(
      (session) =>
        session.day >= start && session.calendar === null && current(state.sessions.get(session.key)) === null,
    );
    return rotationCredits([...recorded, ...future]) - rotationCredits(recorded);
  };
  const tdItems = queueItems(pack, 'td').filter((item) => {
    const itemTerm = tdTerm(pack, item);
    if (itemTerm === undefined || itemTerm > term.number) return false;
    return itemShare(pack, progress, item, whole, budgetInSessions(pack, item, setup.sessionMinutes)) < 1;
  });

  const gives = open('main');
  let planned = 0;
  const itemsAfter = left.filter((rest) => rest > 1e-9 && (planned += rest) > gives + 1e-9).length;
  return {
    term: term.number,
    before,
    basis: exam === undefined ? 'term-end' : 'exam-window',
    confidence: exam?.confidence ?? null,
    needs: Math.ceil(needs - 1e-9),
    gives,
    itemsAfter: compareDays(from, before) < 0 ? itemsAfter : 0,
    afterExams: exam
      ? open('main', term.to, maxDay(from, addDays(parts.map((part) => part.to).reduce(maxDay), 1)))
      : null,
    moved: parts.find((part) => part.moved !== undefined)?.moved ?? null,
    td: { gives: open('td'), items: tdItems.length },
  };
}
