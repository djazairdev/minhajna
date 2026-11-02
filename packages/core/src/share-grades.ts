// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How far each grade's classes got in a subject's plan, for a school's share of
// the totals (#601, answer 631): for each course the share counts, under the
// subject its latest week in the term names, the course's plan, as the school's
// records give it, names its class's grade, its teacher and its pinned pack's
// items in the plan's order; its position is the furthest of those items that
// any of its weeks over the whole year up to the day worked on, as on the
// director's dashboard (answer 627), so going back over an earlier item does
// not move it back, and every item up to it counts as reached. By subject and
// grade, the share adds the teachers, each once, the classes, and by item how
// many classes reached it, an item no class reached left out, as none. A course
// without a plan is left out, and so are grades and items past what the server
// takes, MOST_GRADES grades of MOST_GRADE_ITEMS items in all, the last in order
// of their names, which no school's plans reach. A grade or item is named as
// the reference data names them, never as a name an object already holds, and a
// plan lists each item once, as the server takes them; a week naming a subject
// or item otherwise is left out of the share, though it is signed and read as
// any other. The teacher's name never leaves the device: only how many there
// are does.

import { ITEM_ID } from './pack-fields.ts';
import { ENTRY_ID } from './reference-fields.ts';
import { ID } from './school-key-shape.ts';
import type { WeekForTotals } from './week-totals.ts';

/** The most grades a subject's share gives, and the most items over them, as the server takes them. */
export const MOST_GRADES = 16;
export const MOST_GRADE_ITEMS = 2000;

/** What the school's records give of a course: its class's grade, its teacher, and its pinned pack's items in order. */
export interface CoursePlan {
  readonly grade: string;
  readonly teacher: string;
  readonly items: readonly string[];
}

/** A grade's teachers and classes in a subject, and by plan item how many of the classes reached it. */
export interface GradeReach {
  readonly teachers: number;
  readonly classes: number;
  readonly items: Readonly<Record<string, number>>;
}

/** Whether a name has the shape `shape` and is none an object already holds, as the server takes names. */
export const isName = (name: unknown, shape: RegExp): name is string =>
  typeof name === 'string' && shape.test(name) && !name.startsWith('__') && !(name in Object.prototype);

/** Whether a week's subject and items are named as the server takes them, so a share may count it. */
export const shareable = ({ totals }: WeekForTotals): boolean =>
  isName(totals.subject, ENTRY_ID) && totals.items.every(({ item }) => isName(item, ITEM_ID));

/** Refuses plans written otherwise than by course, grade, teacher and items. */
export function checkPlans(plans: unknown): asserts plans is Readonly<Record<string, CoursePlan>> {
  const isPlan = (plan: unknown) => {
    if (typeof plan !== 'object' || plan === null || Array.isArray(plan)) return false;
    const { grade, teacher, items } = plan as Record<string, unknown>;
    return (
      isName(grade, ENTRY_ID) &&
      typeof teacher === 'string' &&
      teacher.length > 0 &&
      Array.isArray(items) &&
      items.length <= MOST_GRADE_ITEMS &&
      items.every((item) => isName(item, ITEM_ID)) &&
      new Set(items).size === items.length
    );
  };
  const listed = typeof plans === 'object' && plans !== null && !Array.isArray(plans) ? Object.entries(plans) : null;
  if (listed === null || !listed.every(([course, plan]) => ID.test(course) && isPlan(plan))) {
    throw new RangeError('Plans are given by course, grade, teacher and items');
  }
}

/** The furthest item of a plan that any of the weeks worked on, by its place, or -1 before any. */
function positionOf(weeks: readonly WeekForTotals[], items: readonly string[]): number {
  const order = new Map(items.map((item, at) => [item, at]));
  let last = -1;
  for (const { totals } of weeks)
    for (const one of totals.items) {
      const at = order.get(one.item);
      if (one.sessions > 0 && at !== undefined && at > last) last = at;
    }
  return last;
}

/**
 * By subject and grade, how far the counted courses got: `counted` holds each course's weeks in the term, in order,
 * and `year` each course's weeks over the year up to the day, by course.
 */
export function gradeReach(
  counted: readonly (readonly WeekForTotals[])[],
  year: ReadonlyMap<string, readonly WeekForTotals[]>,
  plans: Readonly<Record<string, CoursePlan>>,
): Map<string, Record<string, GradeReach>> {
  type Adding = { teachers: Set<string>; classes: number; items: Map<string, number> };
  const subjects = new Map<string, Map<string, Adding>>();
  for (const weeks of counted) {
    const last = weeks.at(-1);
    const plan = last === undefined || !Object.hasOwn(plans, last.course) ? undefined : plans[last.course]!;
    if (last === undefined || plan === undefined) continue;
    const grades = subjects.get(last.totals.subject) ?? new Map<string, Adding>();
    subjects.set(last.totals.subject, grades);
    const held = grades.get(plan.grade) ?? {
      teachers: new Set<string>(),
      classes: 0,
      items: new Map<string, number>(),
    };
    grades.set(plan.grade, held);
    held.teachers.add(plan.teacher);
    held.classes += 1;
    const position = positionOf(year.get(last.course) ?? weeks, plan.items);
    for (const item of plan.items.slice(0, position + 1)) held.items.set(item, (held.items.get(item) ?? 0) + 1);
  }
  const byName = <T>(entries: Iterable<[string, T]>) =>
    Object.fromEntries([...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const result = new Map<string, Record<string, GradeReach>>();
  for (const [subject, grades] of subjects) {
    const kept = [...grades].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).slice(0, MOST_GRADES);
    let room = MOST_GRADE_ITEMS;
    const reach = kept.map(([grade, { teachers, classes, items }]): [string, GradeReach] => {
      const listed = [...items].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).slice(0, Math.max(room, 0));
      room -= listed.length;
      return [grade, { teachers: teachers.size, classes, items: byName(listed) }];
    });
    if (reach.length > 0) result.set(subject, byName(reach));
  }
  return result;
}
