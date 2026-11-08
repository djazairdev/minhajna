// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teachers' page against a made-up directory (answers 808 and 809, as
// D-Issue draws it): a teacher added gets the server's joining code, written
// in groups of four, which prints and renews. Every school and name is made up.

import { Platform } from 'react-native';
import { FakeDirectory } from '../jest/fake-directory';
import { press, texts, type, unmount } from '../../android/jest/ministry-page';
import { bookIn, openSchool, pick } from '../jest/school-desk';
import { codeShown } from '../src/school-rules';
import pdf from '../../android/src/native/NativeMinhajnaPdf';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

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

async function teacher(name: string, option: string) {
  await press('dashboard-side-teachers');
  await press('teachers-add');
  await type('teacher-form-name', name);
  await pick('teacher-form-option', option);
  await press('teacher-form-save');
}

it('gives a new teacher the server’s code, prints it and renews it', async () => {
  await openSchool(directory);
  await teacher('بن مثال سعاد', 'arabic');
  const [id] = book().teachers.map((one) => one.id);
  const first = book().teachers[0]?.code;
  expect(texts()).toContain('ABCD-2345-EFGH-7771');
  await press(`teacher-${id}`);
  const printHtml = jest.spyOn(pdf, 'printHtml');
  await press('teacher-print');
  expect(printHtml.mock.calls.at(-1)?.[0]).toContain('ABCD-2345-EFGH-7771');
  await press('teacher-renew');
  expect(book().teachers[0]?.code).toBe(first);
  await press('teacher-sure');
  expect(book().teachers[0]?.code).not.toBe(first);
  expect(texts()).toContain('ABCD-2345-EFGH-7772');
});

it('writes a joining code in groups of four', () => {
  expect(codeShown('ABCD2345EFGH7771')).toBe('ABCD-2345-EFGH-7771');
  expect(codeShown('ABCD-2345-EFGH-7771')).toBe('ABCD-2345-EFGH-7771');
});
