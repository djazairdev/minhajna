// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Classes against a made-up directory (answers 807 and 809): a class is
// added, a pupil typed, moved and leaving; a subject given a teacher and taken
// back; the units a class is assigned by, whole options where the level has a
// class teacher and single subjects elsewhere, and who may teach a unit. Every
// school and name is made up.

import { startingLevels, type SchoolBook } from '@minhajna/core';
import { Platform } from 'react-native';
import { FakeDirectory } from '../jest/fake-directory';
import { press, texts, type, unmount } from '../../android/jest/ministry-page';
import { bookIn, EMPTY, newClass, openSchool, pick } from '../jest/school-desk';
import { candidates, unitsOf, withUnitTeacher } from '../src/school-rules';
import words from '../src/text/ar.json';
import { bundledFiles, readDashboardReference } from '../src/reference';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readDashboardReference(bundledFiles);
if (read === null) throw new Error('The bundled reference does not read');
const levels = startingLevels(read.profile);
const primary = levels.find((one) => one.code === 'primary');
const cem = levels.find((one) => one.code === 'cem');
const TEACHER = { id: 't1', name: 'بن مثال سعاد', option: 'arabic' };
let directory: FakeDirectory;
const book = () => bookIn(directory);

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  directory = new FakeDirectory();
  directory.install();
});

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

it('adds a class and a pupil, moves the pupil, and records a leaving', async () => {
  await openSchool(directory);
  const first = await newClass(directory, '4am', '4م1');
  const second = await newClass(directory, '4am', '4م2');
  await press(`class-${first}`);
  await press('pupil-start');
  await type('pupil-name', 'تلميذة مثال');
  await pick('pupil-sex', 'f');
  await type('pupil-registration', '1120450087');
  await press('pupil-add');
  const [pupil] = book().classes[0].pupils;
  expect(pupil).toMatchObject({ name: 'تلميذة مثال', sex: 'f', registration: '1120450087' });
  await type('pupil-registration', '1120450087');
  expect(texts()).toContain(words.pupils.taken);
  await press(`pupil-${pupil.id}`);
  await pick('pupil-move', second);
  expect(book().classes[1].pupils.map((one) => one.id)).toEqual([pupil.id]);
  await press(`class-${second}`);
  await press(`pupil-${pupil.id}`);
  await press('pupil-leave');
  await press('pupil-leave-sure');
  expect(book().classes.flatMap((one) => one.pupils)).toEqual([]);
});

it('gives a subject its teacher, and takes it back', async () => {
  await openSchool(directory, { ...EMPTY, teachers: [TEACHER] });
  const first = await newClass(directory, '4am', '4م1');
  await press(`class-${first}`);
  await press('class-tab-teachers');
  await pick('assign-arabic', 't1');
  expect(book().classes[0].teachers).toEqual({ arabic: 't1' });
  await pick('assign-arabic', '-');
  expect(book().classes[0].teachers).toEqual({});
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
  expect(candidates(book, primary, whole).map((one) => one.id)).toEqual(['t1']);
  const given = withUnitTeacher(book, 'c1', whole, 't1');
  expect(Object.keys(given.classes[0].teachers)).toEqual(whole.subjects);
  expect(Object.keys(withUnitTeacher(given, 'c1', whole, null).classes[0].teachers)).toEqual([]);
});
