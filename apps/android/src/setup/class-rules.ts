// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind Setup-4-Classes and Setup-4c-Type (#27): which grades a
// school offers, how a new class is made, and how a typed list is ordered and
// checked. A class always holds exactly one whole-class group (records.ts),
// and there is no limit on its size (R-3.2-12).

import type { CountryProfile, Grade, Pupil, School, SchoolClass } from '@minhajna/core';

/** A grade with the level it belongs to. */
export interface GradeChoice {
  readonly level: string;
  readonly grade: Grade;
}

/** The grades of the school's levels, in the profile's order. */
export function gradesFor(profile: CountryProfile, school: School): GradeChoice[] {
  return profile.levels
    .filter((level) => school.levels.includes(level.code))
    .flatMap((level) => level.grades.map((grade) => ({ level: level.code, grade })));
}

/** A new class with its whole-class group, named as the school writes it. */
export function newClass(
  ids: { readonly id: string; readonly groupId: string },
  school: School,
  choice: GradeChoice,
  name: string,
): SchoolClass {
  const trimmed = name.trim();
  return {
    id: ids.id,
    schoolId: school.id,
    level: choice.level,
    grade: choice.grade.code,
    name: trimmed,
    groups: [{ id: ids.groupId, kind: 'whole', name: trimmed }],
  };
}

/** The class's pupils in alphabetical order, as the class list prints them. */
export function sortedPupils(pupils: Iterable<Pupil>, classId: string): Pupil[] {
  return [...pupils]
    .filter((pupil) => pupil.classId === classId)
    .sort((a, b) => a.name.localeCompare(b.name, 'ar') || a.id.localeCompare(b.id));
}

/** Whether another pupil of the class already has this registration number. */
export function registrationTaken(
  pupils: Iterable<Pupil>,
  classId: string,
  registration: string,
  id?: string,
): boolean {
  const wanted = registration.trim();
  if (wanted === '') return false;
  return [...pupils].some((pupil) => pupil.classId === classId && pupil.id !== id && pupil.registration === wanted);
}

/** A typed pupil, with only the fields of PRD §5.6 and no registration until there is one. */
export function typedPupil(
  fields: { readonly id: string; readonly classId: string; readonly name: string; readonly sex: 'f' | 'm' },
  registration: string,
): Pupil {
  const number = registration.trim();
  return {
    id: fields.id,
    classId: fields.classId,
    name: fields.name.trim().replace(/\s+/g, ' '),
    sex: fields.sex,
    groups: [],
    movements: [],
    ...(number !== '' && { registration: number }),
  };
}
