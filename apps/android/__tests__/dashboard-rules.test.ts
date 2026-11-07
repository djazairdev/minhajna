// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dashboard's rules (answers 804 to 809): what changed since the last
// version; a new school's code; the units a class is assigned by, whole
// options where the level has a class teacher and single subjects elsewhere;
// who may teach a unit; a joining code in its groups; the week's slots when a
// level has no bell template. Every name is made up.

import { startingLevels, type SchoolBook } from '@minhajna/core';
import { COMMUNE, schoolIn } from '../jest/dashboard-world';
import { draftChanges, newSchoolId, startingDraft, withSchool } from '../src/dashboard/reference-rules';
import { candidates, codeShown, unitsOf, withUnitTeacher } from '../src/dashboard/school-rules';
import { slotCounts } from '../src/dashboard/week-rules';
import { bundledReference, readReference } from '../src/reference';

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const { profile, bells } = read;
const levels = startingLevels(profile);
const primary = levels.find((one) => one.code === 'primary');
const cem = levels.find((one) => one.code === 'cem');

it('counts what changed since the last version', () => {
  const base = withSchool(startingDraft(profile), schoolIn('160101', COMMUNE, 'متوسطة أولى'));
  const changed = withSchool(
    withSchool({ ...base, schools: [] }, schoolIn('160101', COMMUNE, 'متوسطة أولى معدلة')),
    schoolIn('160102', COMMUNE, 'متوسطة ثانية'),
  );
  expect(draftChanges(changed, base)).toEqual({ added: 1, edited: 1, hidden: 0, options: 0 });
  expect(draftChanges({ ...base, schools: [] }, base).hidden).toBe(1);
});

it('gives a new school its commune’s first free code', () => {
  expect(newSchoolId([schoolIn('160101', COMMUNE, 'x'), schoolIn('160103', COMMUNE, 'y')], '1601')).toBe('160102');
});

it('assigns the primary by option and the middle school by subject', () => {
  expect(unitsOf(primary)[0]).toMatchObject({ key: 'class', option: { classTeacher: true } });
  expect(unitsOf(cem).every((unit) => unit.subjects.length === 1)).toBe(true);
  const book: SchoolBook = {
    format: 1,
    teachers: [
      { id: 't1', name: 'أستاذة القسم', option: 'class' },
      { id: 't2', name: 'أستاذ الفرنسية', option: 'french' },
    ],
    classes: [{ id: 'c1', grade: '1ap', name: '1أ', pupils: [], teachers: {} }],
    week: [],
  };
  const [whole] = unitsOf(primary);
  expect(candidates(book, primary, whole!).map((one) => one.id)).toEqual(['t1']);
  const given = withUnitTeacher(book, 'c1', whole!, 't1');
  expect(Object.keys(given.classes[0]!.teachers)).toEqual(whole!.subjects);
  expect(Object.keys(withUnitTeacher(given, 'c1', whole!, null).classes[0]!.teachers)).toEqual([]);
});

it('writes a joining code in groups of four', () => {
  expect(codeShown('ABCD2345EFGH7771')).toBe('ABCD-2345-EFGH-7771');
  expect(codeShown('ABCD-2345-EFGH-7771')).toBe('ABCD-2345-EFGH-7771');
});

it('takes the middle school’s slots for a level with no bell template', () => {
  expect(slotCounts(bells, 'primary')).toEqual(slotCounts(bells, 'cem'));
});
