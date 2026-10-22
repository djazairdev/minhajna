// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind Setup-6-Plan and Setup-6b-Packs (#30): the classes that
// share a grade and subject, each class's pin, and the records that pin a
// pack, or free entry, to some of them. A class's course for the year is made
// the first time it is needed. A joint class is in each of its years' groups,
// with a course and a pin for each year (#43).

import {
  classGrades,
  courseOf,
  isJoint,
  type Course,
  type PinnedPack,
  type PlanPack,
  type RecordEvent,
  type SchoolClass,
  type State,
} from '@minhajna/core';

/** The classes of one grade that are taught one subject, which a pack is chosen for together. */
export interface PlanGroup {
  readonly key: string;
  readonly grade: string;
  readonly subject: string;
  readonly classes: readonly SchoolClass[];
}

/** Each grade and subject the teacher teaches, in the order the classes were added; archived classes aside (#231). */
export function planGroups(state: State): PlanGroup[] {
  const groups = new Map<string, { grade: string; subject: string; classes: SchoolClass[] }>();
  for (const schoolClass of state.classes.values()) {
    if (schoolClass.archivedFrom !== undefined) continue;
    for (const grade of classGrades(schoolClass)) {
      for (const subject of state.schools.get(schoolClass.schoolId)?.subjects ?? []) {
        const key = `${grade}/${subject}`;
        const group = groups.get(key) ?? { grade, subject, classes: [] };
        group.classes.push(schoolClass);
        groups.set(key, group);
      }
    }
  }
  return [...groups].map(([key, group]) => ({ key, ...group }));
}

/** A class's pin for the subject and year, of one year in a joint class: the release, or null for free entry or none yet. */
export function pinOfClass(
  state: State,
  classId: string,
  subject: string,
  year: string,
  grade?: string,
): PinnedPack | null {
  return courseOf(state, classId, subject, year, grade)?.pack ?? null;
}

/** The pack a pin names, among those that read. */
export function packOfPin(packs: readonly PlanPack[], pin: PinnedPack | null): PlanPack | undefined {
  return pin === null ? undefined : packs.find((pack) => pack.id === pin.id && pack.release === pin.release);
}

/**
 * The records that pin `pack`, or free entry, to each class, making a course where a class has none. In a joint
 * class, the course is `grade`'s.
 */
export function pinEvents(
  state: State,
  classIds: readonly string[],
  subject: string,
  year: string,
  pack: PinnedPack | null,
  newId: () => string,
  grade?: string,
): RecordEvent[] {
  return classIds.map((classId): RecordEvent => {
    const schoolClass = state.classes.get(classId);
    const joint = schoolClass !== undefined && isJoint(schoolClass) ? grade : undefined;
    const course: Course = courseOf(state, classId, subject, year, joint) ?? {
      id: newId(),
      classId,
      subject,
      year,
      pack: null,
      ...(joint !== undefined && { grade: joint }),
    };
    return { kind: 'course.set', course: { ...course, pack } };
  });
}
