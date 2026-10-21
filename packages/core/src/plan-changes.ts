// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Parallel classes keep their own queues (PRD §4.7, R-4.7-36): the same
// subject and grade in the same school and year, on the same pack.
// «مواءمة … مع X» is offered only while this class is behind class X.
// It brings X's next item to this class's next place, as one move in the
// class's layer, so the items passed follow it and none is dropped; it is
// undone like any other change (answer 286).
//
// Every change is checked before it is recorded: it takes the next place in
// the course's order, names items the class's plan has, keeps at least one
// session, keeps a title to one line of at most 160 characters with no
// bidi controls, as it prints in the texts book, and a move
// or a join stays within its queue, a join between neighbours. An item an
// exam-window answer names is not split, so that answer keeps its meaning.
// Taking a change back records an `undo`; nothing is deleted.

import { courseSetup } from './choices.ts';
import type { Context } from './context.ts';
import type { Day } from './day.ts';
import { courseGrade } from './joint.ts';
import type { RecordEvent } from './events.ts';
import { decisionsFor } from './plan-decisions.ts';
import { changesFor, nextSeq, type PlanChange } from './plan-layer.ts';
import { queueItems } from './pack.ts';
import { planView } from './plan-view.ts';
import type { Course } from './records.ts';

/** The other courses parallel to this one, by class name. */
export function parallelCourses(context: Context, courseId: string): Course[] {
  const { state } = context;
  const course = state.courses.get(courseId);
  const schoolClass = course && state.classes.get(course.classId);
  if (course === undefined || schoolClass === undefined || course.pack === null) return [];
  const grade = courseGrade(course, schoolClass);
  return [...state.courses.values()]
    .filter((other) => {
      const otherClass = state.classes.get(other.classId);
      return (
        other.id !== course.id &&
        otherClass !== undefined &&
        other.classId !== course.classId &&
        other.subject === course.subject &&
        other.year === course.year &&
        other.pack?.id === course.pack?.id &&
        otherClass.schoolId === schoolClass.schoolId &&
        otherClass.stream === schoolClass.stream &&
        courseGrade(other, otherClass) === grade
      );
    })
    .sort((a, b) => (state.classes.get(a.classId)?.name ?? '').localeCompare(state.classes.get(b.classId)?.name ?? ''));
}

/** The item a class goes on with in its main queue, as of `today`. */
function nextItem(context: Context, courseId: string, today: Day): string | undefined {
  return planView(context, courseId, today)?.main.find((row) => row.position)?.item.id;
}

/**
 * The move that aligns this course on a parallel one, or null when this
 * class is not behind it: X's next item must come later in this class's
 * plan and still be open or started here.
 */
export function alignChange(
  context: Context,
  courseId: string,
  otherId: string,
  today: Day,
  id: string,
): PlanChange | null {
  const other = context.state.courses.get(otherId);
  if (other === undefined || !parallelCourses(context, courseId).some((one) => one.id === otherId)) return null;
  const view = planView(context, courseId, today);
  const target = nextItem(context, otherId, today);
  if (view === null || target === undefined) return null;
  const here = view.main.findIndex((row) => row.position);
  const there = view.main.findIndex((row) => row.item.id === target);
  const row = view.main[there];
  if (here < 0 || there <= here || row === undefined || row.status === 'done' || row.status === 'skipped') return null;
  return {
    id,
    courseId,
    day: today,
    seq: nextSeq(context.state.decisions, courseId),
    kind: 'move',
    item: target,
    before: view.main[here]!.item.id,
    align: other.classId,
  };
}

/** The event that records one of the class's own changes, once checked against its plan. */
export function recordChange(context: Context, change: PlanChange): RecordEvent {
  const pack = courseSetup(context, change.courseId).pack;
  if (pack === null) throw new RangeError('A class without a pack has no plan to change');
  const { decisions } = context.state;
  if (decisions.has(change.id) || change.seq !== nextSeq(decisions, change.courseId)) {
    throw new RangeError('This change is already recorded, or out of order');
  }
  const item = (id: string) => pack.items.find((one) => one.id === id && one.kind !== 'unit');
  const queue = (id: string) => (item(id)?.kind === 'td' ? 'td' : 'main');
  const sessions = (n: number) => Number.isInteger(n) && n >= 1 && n <= 60;
  const line = (text: string) =>
    text.trim() !== '' &&
    text.length <= 160 &&
    ![...text].some((char) => {
      const point = char.codePointAt(0)!;
      return (
        point < 32 ||
        point === 127 ||
        point === 0x061c ||
        point === 0x200e ||
        point === 0x200f ||
        point === 0x2028 ||
        point === 0x2029 ||
        (point >= 0x202a && point <= 0x202e) ||
        (point >= 0x2066 && point <= 0x2069)
      );
    });
  const answered = (id: string) =>
    decisionsFor(decisions, change.courseId).some((one) =>
      one.kind === 'leave-out' ? one.item === id : one.items.includes(id),
    );
  const sideBySide = ([a, b]: readonly [string, string]) => {
    const order = queueItems(pack, queue(a)).map((one) => one.id);
    return queue(a) === queue(b) && Math.abs(order.indexOf(a) - order.indexOf(b)) === 1;
  };
  const fits = ((): boolean => {
    switch (change.kind) {
      case 'move':
        return (
          item(change.item) !== undefined &&
          change.before !== change.item &&
          (change.before === null || (item(change.before) !== undefined && queue(change.before) === queue(change.item)))
        );
      case 'budget':
        return item(change.item) !== undefined && sessions(change.sessions);
      case 'split':
        return item(change.item) !== undefined && !answered(change.item) && change.titles.every(line);
      case 'add':
        return (
          line(change.title) &&
          sessions(change.sessions) &&
          (change.before === null || (item(change.before) !== undefined && queue(change.before) === 'main'))
        );
      case 'skip':
        return item(change.item) !== undefined;
      case 'join':
        return change.items.every((id) => item(id) !== undefined) && sideBySide(change.items);
      case 'undo':
        return changesFor(decisions, change.courseId).some((one) => one.id === change.change);
    }
  })();
  if (!fits) throw new RangeError("This change does not fit the class's plan");
  return { kind: 'plan.decided', decision: change };
}
