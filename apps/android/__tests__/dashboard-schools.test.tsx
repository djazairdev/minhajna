// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// N-Reference's schools against a made-up directory (answers 804, 805 and
// 809): a school is added, edited and hidden, each change saved as it is made,
// and an old version brings it back; a file of schools shows its check before
// anything changes, and an Excel workbook is refused with how to save it.
// Every school is made up.

import { Platform } from 'react-native';
import { FakeDirectory } from '../jest/fake-directory';
import { has, press, rendered, texts, type, unmount } from '../jest/ministry-page';
import { openReference, pick } from '../jest/reference-desk';
import words from '../src/dashboard/text/ar.json';
import files from '../src/native/NativeMinhajnaFiles';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let directory: FakeDirectory;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  directory = new FakeDirectory();
  directory.install();
});

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

it('adds, edits and hides a school, then publishes and publishes an old version again', async () => {
  await openReference(directory);
  await press('reference-tab-schools');
  await press('schools-add');
  await pick('school-form-wilaya', '16');
  await pick('school-form-commune', '1601');
  await pick('school-form-level', 'cem');
  await type('school-form-name', 'متوسطة مثال');
  await press('school-form-save');
  expect(directory.draft?.schools.map((one) => [one.id, one.name])).toEqual([['160101', 'متوسطة مثال']]);
  await press('school-edit-160101');
  await type('school-form-name', 'متوسطة مثال الجديدة');
  await press('school-form-save');
  expect(directory.draft?.schools[0]?.name).toBe('متوسطة مثال الجديدة');
  await press('reference-go-publish');
  await press('publish-now');
  expect(directory.versions.map((one) => one.version)).toEqual(['2029.1']);
  await press('reference-tab-schools');
  await press('school-hide-160101');
  expect(directory.draft?.schools).toEqual([]);
  await press('reference-tab-publish');
  expect(texts()).toContain(words.publish.hidden);
  await press('publish-now');
  await press('publish-again-2029.1');
  expect(directory.versions.map((one) => one.schools.length)).toEqual([1, 0, 1]);
  expect(directory.draft?.schools).toHaveLength(1);
});

describe('importing schools', () => {
  const file = (text: string | Error) =>
    jest
      .spyOn(files, 'openText')
      .mockImplementation(() => (text instanceof Error ? Promise.reject(text) : Promise.resolve(text)));

  it('shows the check before anything changes, then applies it', async () => {
    await openReference(directory);
    await press('reference-tab-schools');
    file(
      [
        'رمز البلدية;الطور;اسم المؤسسة',
        '1601;التعليم المتوسط;متوسطة أولى',
        '1602;cem;متوسطة ثانية',
        '9999;cem;مجهولة',
        '1601;lycee;',
      ].join('\n'),
    );
    await press('schools-import');
    await press('import-pick');
    expect(directory.draft).toBeNull();
    const figure = (id: string) =>
      rendered().root.findAll(
        (one) => one.props.testID === `import-figure-${id}` && one.props.accessibilityLabel !== undefined,
      )[0].props.accessibilityLabel as string;
    expect(figure('new')).toMatch(/^2 /);
    expect(figure('refused')).toMatch(/^2 /);
    expect(texts()).toContain('بلدية غير معروفة: 9999');
    await press('import-apply');
    expect(directory.draft?.schools.map((one) => one.id)).toEqual(['160101', '160201']);
    expect(has('import-applied')).toBe(true);
  });

  it('says a column is missing, and how to save a workbook', async () => {
    await openReference(directory);
    await press('reference-tab-schools');
    await press('schools-import');
    file('commune;level\n1601;cem\n');
    await press('import-pick');
    expect(texts()).toContain('ينقص الملف عمود: اسم المؤسسة.');
    file(Object.assign(new Error('binary'), { code: 'E_FILE_BINARY' }));
    await press('import-pick');
    expect(texts()).toContain(words.import.file.binary);
  });
});
