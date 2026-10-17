// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind a joint class (#43, Setup-4d-Joint): a primary class with
// two or three years, each on its own plan (PRD §3.2). Each year is a group
// of the class, and a pupil's year is their group (joint.ts in the core).

import {
  JOINT_LEVELS,
  levelGroups,
  type CountryProfile,
  type Grade,
  type Pupil,
  type School,
  type SchoolClass,
} from '@minhajna/core';

/** Only primary has joint classes. */
export const JOINT_LEVEL = 'primary';

/** The schools that teach primary. */
export function jointSchools(schools: readonly School[]): School[] {
  return schools.filter((school) => school.levels.includes(JOINT_LEVEL));
}

/** Primary's years, in order. */
export function jointGrades(profile: CountryProfile): readonly Grade[] {
  return profile.levels.find((level) => level.code === JOINT_LEVEL)?.grades ?? [];
}

/** A new joint class: the whole class and one group per year, in the years' order. */
export function newJointClass(
  ids: { readonly id: string; readonly groupId: string },
  profile: CountryProfile,
  school: School,
  grades: readonly string[],
  name: string,
  newId: () => string,
): SchoolClass {
  const trimmed = name.trim();
  const ordered = jointGrades(profile)
    .map((grade) => grade.code)
    .filter((code) => grades.includes(code));
  return {
    id: ids.id,
    schoolId: school.id,
    level: JOINT_LEVEL,
    grade: ordered[0] ?? '',
    name: trimmed,
    groups: [
      { id: ids.groupId, kind: 'whole', name: trimmed },
      ...ordered.map((grade) => ({ id: newId(), kind: 'level' as const, name: grade.toUpperCase(), grade })),
    ],
  };
}

/** Whether the chosen years make a joint class: two or three different years of primary. */
export function yearsValid(profile: CountryProfile, grades: readonly string[]): boolean {
  const codes = jointGrades(profile).map((grade) => grade.code);
  return (
    grades.length >= JOINT_LEVELS.min &&
    grades.length <= JOINT_LEVELS.max &&
    new Set(grades).size === grades.length &&
    grades.every((grade) => codes.includes(grade))
  );
}

/** A pupil's groups with their year set to `grade`, keeping their other groups. */
export function withYear(groups: readonly string[], schoolClass: SchoolClass, grade: string): string[] {
  const years = levelGroups(schoolClass);
  const chosen = years.find((group) => group.grade === grade);
  const others = groups.filter((id) => !years.some((group) => group.id === id));
  return chosen === undefined ? others : [...others, chosen.id];
}

/** How many of the class's pupils each year holds, in the years' order. */
export function yearTally(pupils: Iterable<Pupil>, schoolClass: SchoolClass) {
  const list = [...pupils].filter((pupil) => pupil.classId === schoolClass.id);
  return levelGroups(schoolClass).map((group) => ({
    grade: group.grade,
    count: list.filter((pupil) => pupil.groups.includes(group.id)).length,
  }));
}
