// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Classes opened for its tests: a made-up middle school in a published list
// of the profile's options, its desk opened with a made-up code on a book the
// made-up directory keeps, that book as the directory holds it, and a class
// added through the page.

import { startingLevels, type SchoolBook } from '@minhajna/core';
import { SchoolDesk } from '../src/SchoolDesk';
import { bundledFiles, readDashboardReference } from '../src/reference';
import { choose, COMMUNE, schoolIn } from './dashboard-world';
import type { FakeDirectory } from './fake-directory';
import { press, show, type } from '../../android/jest/ministry-page';

const read = readDashboardReference(bundledFiles);
if (read === null) throw new Error('The bundled reference does not read');
const { profile, bells } = read;
const school = schoolIn('160101', COMMUNE, 'متوسطة مثال');
const list = {
  format: 1 as const,
  version: '2029.1',
  published: '2029-11-12' as never,
  levels: startingLevels(profile),
  schools: [school],
};

/** An empty book. */
export const EMPTY: SchoolBook = { format: 1, teachers: [], classes: [], week: [] };

/** Chooses a value in one of the desk's selects. */
export const pick = (field: string, value: string) => choose(press, field, value);

/** The school's book as the directory holds it. */
export const bookIn = (directory: FakeDirectory) => directory.books.get('160101')!.book;

/** Opens the school's desk on a book the directory keeps. */
export async function openSchool(directory: FakeDirectory, start: SchoolBook = EMPTY) {
  directory.versions.push(list);
  directory.schoolCodes.set('160101', 'school-made-up');
  directory.books.set('160101', { revision: 0, book: start });
  await show(
    <SchoolDesk
      profile={profile}
      bells={bells}
      list={list}
      school={school}
      code="school-made-up"
      start={{ revision: 0, book: start }}
      onLock={() => undefined}
      onBack={() => undefined}
    />,
  );
}

/** Adds a class of a grade through the page, and gives its id. */
export async function newClass(directory: FakeDirectory, grade: string, name: string) {
  await press('dashboard-side-classes');
  await press('classes-add');
  await pick('class-form-grade', grade);
  await type('class-form-name', name);
  await press('class-form-save');
  return bookIn(directory).classes.find((one) => one.name === name)!.id;
}
