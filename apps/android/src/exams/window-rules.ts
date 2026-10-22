// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the exam-window warning reads (#221, Exam-window, R-4.7-32, answers
// 268 and 269): each of the teacher's courses whose plan would push items
// past its next exam window, in the order the Classes tab lists them, and
// the items as a sentence quotes them; the items a course postponed, which
// the plan tags until they are taught. A course's warning is kept until
// something it reads changes: the day, the reference, the class's courses,
// the class and its school, the timetables, the teacher's calendar, and
// the course's sessions, tests and decisions. A tap that confirms another
// class's session does not walk this one's year again.

import {
  classGrades,
  courseDecisions,
  courseGrade,
  decisionsFor,
  pastWindow,
  type Context,
  type Day,
  type PackItem,
  type PastWindow,
} from '@minhajna/core';
import type { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

type Translate = ReturnType<typeof useText>;

type Kept = {
  readonly ref: Context['ref'];
  readonly packs: string;
  readonly stamp: string;
  readonly warning: PastWindow | null;
};

const kept = new Map<string, Kept>();

function stampOf(context: Context, courseId: string, day: Day): string {
  const { state } = context;
  const course = state.courses.get(courseId);
  const room = course && state.classes.get(course.classId);
  const sessions: string[] = [];
  for (const [key, versions] of state.sessions) {
    if (key.startsWith(`${courseId}/`)) sessions.push(`${key}:${versions.length}`);
  }
  return JSON.stringify([
    day,
    [...state.courses.values()].filter((other) => other.classId === course?.classId),
    room,
    room && state.schools.get(room.schoolId),
    state.timetables,
    state.calendar,
    sessions,
    [...state.tests.values()].filter((test) => test.courseId === courseId),
    decisionsFor(courseDecisions(state, courseId), courseId),
  ]);
}

/** A course's warning, kept until something it reads changes. */
function warningOf(context: Context, courseId: string, day: Day): PastWindow | null {
  const packs = [...context.ref.packs.keys()].join(' ');
  const stamp = stampOf(context, courseId, day);
  const old = kept.get(courseId);
  if (old !== undefined && old.ref.country === context.ref.country && old.ref.year === context.ref.year) {
    if (old.ref.calendar === context.ref.calendar && old.packs === packs && old.stamp === stamp) return old.warning;
  }
  const warning = pastWindow(context, courseId, day);
  kept.set(courseId, { ref: context.ref, packs, stamp, warning });
  return warning;
}

/** The courses with items past their next exam window, as of `day`, as the Classes tab orders them; only `courseId` when given. */
export function courseWarnings(context: Context, day: Day, courseId?: string): PastWindow[] {
  const { state } = context;
  const ids = courseId === undefined ? [...state.courses.keys()] : [courseId];
  const order = (one: PastWindow) => {
    const course = state.courses.get(one.courseId);
    const room = course && state.classes.get(course.classId);
    return {
      name: room?.name ?? one.courseId,
      grade: course && room ? classGrades(room).indexOf(courseGrade(course, room)) : 0,
      subject: course?.subject ?? '',
    };
  };
  return ids
    .filter((id) => {
      const course = state.courses.get(id);
      return course !== undefined && state.classes.has(course.classId);
    })
    .flatMap((id) => warningOf(context, id, day) ?? [])
    .sort((a, b) => {
      const [x, y] = [order(a), order(b)];
      return x.name.localeCompare(y.name, 'ar') || x.grade - y.grade || x.subject.localeCompare(y.subject);
    });
}

/** The items quoted and listed, as a sentence names them. */
export function quotedItems(t: Translate, items: readonly PackItem[], comma: string): string {
  return items.map((item) => t('tests.quoted', { title: isolate(item.title) })).join(comma);
}

/** The items a course postponed past an exam window. */
export function postponedItems(context: Context, courseId: string): ReadonlySet<string> {
  return new Set(
    decisionsFor(courseDecisions(context.state, courseId), courseId).flatMap((decision) =>
      decision.kind === 'postpone' ? decision.items : [],
    ),
  );
}
