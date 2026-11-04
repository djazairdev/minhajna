// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The plans a school's share of the totals reads to give how far each grade got
// (#601, answer 631, share-grades.ts), from the school's records on the device
// that holds the school key: for each class and subject its timetable holds,
// the course its class's name and the subject make in the school's space, as
// the signed weeks name it (week-record.ts), with the class's grade, the
// teacher of its first session in the week that names one, so a course two
// teachers share counts one of them, which only hides more under the floors,
// and the items, in order, of the pack the world pins for the class in the
// subject, as the director's dashboard reads it (answer 627), none when it pins
// none, so its classes still count. Only names the server takes go in: an item
// otherwise named, or past the most a grade gives, is left out, and a class
// whose grade is otherwise named gives no plan, a session with no teacher
// counting for none, so a bad pack costs only its reach and never the share. A
// class the timetable names but the school does not list is left out, and each
// class and subject is worked out once, the first of two classes whose names
// make one course giving its plan.

import type { DemoSchool } from './demo-world.ts';
import { ITEM_ID } from './pack-fields.ts';
import type { PinnedPack } from './records.ts';
import { ENTRY_ID, isName } from './reference-fields.ts';
import { MOST_GRADE_ITEMS, type CoursePlan } from './share-grades.ts';
import { courseId } from './week-record.ts';
import type { WorldMac } from './world-keys.ts';

/** By course, each class and subject's plan, `itemsOf` giving a pinned pack's items in order, or none if unknown. */
export async function schoolPlans(
  space: string,
  school: Pick<DemoSchool, 'classes' | 'week'>,
  itemsOf: (pinned: PinnedPack) => readonly string[] | undefined,
  mac: WorldMac,
): Promise<Record<string, CoursePlan>> {
  const plans: Record<string, CoursePlan> = {};
  const seen = new Set<string>();
  for (const session of school.week) {
    const one = school.classes.find((each) => each.id === session.classId);
    const key = `${session.classId}\n${session.subject}`;
    if (one === undefined || session.teacherId.length === 0 || seen.has(key)) continue;
    seen.add(key);
    if (!isName(one.grade, ENTRY_ID)) continue;
    const course = await courseId(space, one.name, session.subject, mac);
    if (Object.hasOwn(plans, course)) continue;
    const pinned = one.packs[session.subject];
    const listed = pinned === undefined ? [] : (itemsOf(pinned) ?? []);
    const items = [...new Set(listed.filter((item) => isName(item, ITEM_ID)))].slice(0, MOST_GRADE_ITEMS);
    plans[course] = { grade: one.grade, teacher: session.teacherId, items };
  }
  return plans;
}
