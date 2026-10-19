// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What «مواعيد الفروض» reads (#221, Test-schedule, answers 268 and 269): a
// course's tests in date order; the days a new test can take, those with a
// session of the course the calendar leaves, not yet recorded and not
// already a test's; a day's sessions to choose from; and what a test would
// change before it is saved: the sessions it takes from the term, the item
// whose session it takes, and the items it would push past the exams. The
// sessions left are counted in the test's own term, from today or the
// term's first day, up to its exams or its end; a test after them counts
// none.

import {
  TEST_SESSION_TYPE,
  compareSlots,
  current,
  findSessionType,
  pastWindow,
  proposalAt,
  sessionsBetween,
  termCheck,
  withPlanChanges,
  type Context,
  type Day,
  type PackItem,
  type Queue,
  type ScheduledTest,
  type Session,
} from '@minhajna/core';

/** A course's tests, by day, then slot. */
export function courseTests(context: Context, courseId: string): ScheduledTest[] {
  return [...context.state.tests.values()]
    .filter((test) => test.courseId === courseId)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : compareSlots(a.slot, b.slot)));
}

/** The course's sessions from `from` to `to` a test can take. */
export function openSessions(context: Context, courseId: string, from: Day, to: Day): Session[] {
  if (from > to) return [];
  return sessionsBetween(context, from, to, new Set([courseId])).filter(
    (session) =>
      session.calendar === null &&
      session.test === undefined &&
      session.sessionType !== TEST_SESSION_TYPE &&
      current(context.state.sessions.get(session.key)) === null,
  );
}

/** The test a session would hold, as a record, before an ID is given. */
export function testOn(session: Session, title: string, common: boolean): Omit<ScheduledTest, 'id'> {
  return {
    courseId: session.courseId,
    day: session.day,
    slot: session.slot,
    groupId: session.groupId,
    title: title.trim(),
    ...(common && { common: true }),
  };
}

export interface TestEffect {
  /** The lesson and TD sessions left before the exams or the term's end, before and after; null without a plan. */
  readonly left: {
    readonly lessons: { readonly before: number; readonly after: number };
    readonly td: { readonly before: number; readonly after: number };
  } | null;
  /** The queue the session's type feeds: lessons, TD, or neither, such as remediation. */
  readonly queue: Queue;
  /** The item the session would have taught, which moves to the next session with its followers. */
  readonly moves: PackItem | null;
  /** The items newly past the exams with the test. */
  readonly past: readonly PackItem[];
  /** The exam window's first day, when items would be past it. */
  readonly examsFrom: Day | null;
}

/** What adding a test on `session` changes, as of `today`. */
export function testEffect(context: Context, session: Session, test: ScheduledTest, today: Day): TestEffect {
  const preview = withPlanChanges(context, { tests: [test] });
  const term = context.ref.year.terms.find((one) => one.from <= session.day && session.day <= one.to);
  const from = term === undefined || term.from < today ? today : term.from;
  const was = term === undefined ? null : termCheck(context, session.courseId, from, term.number);
  const will = term === undefined ? null : termCheck(preview, session.courseId, from, term.number);
  const before = pastWindow(context, session.courseId, today);
  const after = pastWindow(preview, session.courseId, today);
  const already = new Set(before?.items.map(({ item }) => item.id) ?? []);
  const past = after?.items.map(({ item }) => item).filter((item) => !already.has(item.id)) ?? [];
  return {
    left:
      was === null || will === null || session.day >= was.before
        ? null
        : {
            lessons: { before: was.gives, after: will.gives },
            td: { before: was.td.gives, after: will.td.gives },
          },
    queue: findSessionType(context.ref.country, session.sessionType).queue,
    moves: proposalAt(context, session)?.item ?? null,
    past,
    examsFrom: past.length === 0 ? null : (after?.window.from ?? null),
  };
}
