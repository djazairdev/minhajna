// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind the plan pages (#30): the classes that share a grade and
// subject, and each class's pin, read from its course for the year. A joint
// class is in each of its years' groups, with a course and a pin for each
// year (#43). The pins arrive with the school's classes (answer 808).

import { classGrades, courseOf, type PinnedPack, type PlanPack, type SchoolClass, type State } from '@minhajna/core';

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

/**
 * A class's pin for the subject and year, of one year in a joint class: the release, or null for free entry or none
 * yet.
 */
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
