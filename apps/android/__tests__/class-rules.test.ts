// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind classes and typed lists (#27). Made-up pupils only.

import type { Pupil, School } from '@minhajna/core';
import { gradesFor, newClass, registrationTaken, sortedPupils, typedPupil } from '../src/setup/class-rules';
import { bundledReference, readReference } from '../src/reference';

const reference = readReference(bundledReference);
if (!reference.ok) throw new Error('The bundled reference data is refused');
const profile = reference.profile;
const school: School = { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic'], zone: '16' };

const pupil = (id: string, name: string, registration?: string): Pupil => ({
  id,
  classId: 'c-1',
  name,
  sex: 'm',
  groups: [],
  movements: [],
  ...(registration !== undefined && { registration }),
});

test("offers the grades of the school's levels only", () => {
  expect(gradesFor(profile, school).map((choice) => choice.grade.code)).toEqual(['1am', '2am', '3am', '4am']);
  expect(gradesFor(profile, { ...school, levels: ['primary', 'cem'] })).toHaveLength(9);
});

test('makes a class with exactly one whole-class group, named as typed', () => {
  const [fourth] = gradesFor(profile, school).filter((choice) => choice.grade.code === '4am');
  expect(newClass({ id: 'c-1', groupId: 'g-1' }, school, fourth, ' 4م3 ')).toEqual({
    id: 'c-1',
    schoolId: 's-1',
    level: 'cem',
    grade: '4am',
    name: '4م3',
    groups: [{ id: 'g-1', kind: 'whole', name: '4م3' }],
  });
});

test('sorts a class alphabetically in Arabic, hamza and shared family names included', () => {
  const pupils = [
    pupil('p-1', 'شريف مريم'),
    pupil('p-2', 'أحمد بن علي'),
    pupil('p-3', 'بوزيد ياسين'),
    pupil('p-4', 'بوزيد أمينة'),
    { ...pupil('p-5', 'حداد أنس'), classId: 'c-2' },
  ];
  expect(sortedPupils(pupils, 'c-1').map((one) => one.name)).toEqual([
    'أحمد بن علي',
    'بوزيد أمينة',
    'بوزيد ياسين',
    'شريف مريم',
  ]);
});

test('finds a registration number already used in the class, but not the pupil’s own', () => {
  const pupils = [
    pupil('p-1', 'شريف مريم', '2210450127'),
    { ...pupil('p-2', 'حداد أنس', '2210450113'), classId: 'c-2' },
  ];
  expect(registrationTaken(pupils, 'c-1', '2210450127')).toBe(true);
  expect(registrationTaken(pupils, 'c-1', '2210450127', 'p-1')).toBe(false);
  expect(registrationTaken(pupils, 'c-1', '2210450113')).toBe(false);
  expect(registrationTaken(pupils, 'c-1', ' ')).toBe(false);
});

test('keeps a typed pupil to the fields of PRD §5.6, with no registration until there is one', () => {
  expect(typedPupil({ id: 'p-1', classId: 'c-1', name: '  بوزيد   ياسين ', sex: 'm' }, ' ')).toEqual({
    id: 'p-1',
    classId: 'c-1',
    name: 'بوزيد ياسين',
    sex: 'm',
    groups: [],
    movements: [],
  });
  expect(typedPupil({ id: 'p-1', classId: 'c-1', name: 'شريف مريم', sex: 'f' }, '2210450127').registration).toBe(
    '2210450127',
  );
});
