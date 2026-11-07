// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// N-Reference against a made-up directory (answers 804, 805 and 809): the
// draft starts from the profile's options; a pair is added and an option
// hidden; a school is added, edited and hidden, each change saved as it is
// made; publishing saves a draft never saved first, and an old version is
// published again; a save after someone else's says so and the latest copy
// reads back; a file of schools shows its check before anything changes, and
// an Excel workbook is refused with how to save it. Every school is made up.

import { startingLevels } from '@minhajna/core';
import { Platform } from 'react-native';
import { choose, COMMUNE, schoolIn } from '../jest/dashboard-world';
import { FakeDirectory } from '../jest/fake-directory';
import { has, press, rendered, show, texts, type, unmount } from '../jest/ministry-page';
import { ReferencePage } from '../src/dashboard/ReferencePage';
import words from '../src/dashboard/text/ar.json';
import files from '../src/native/NativeMinhajnaFiles';
import { bundledReference, readReference } from '../src/reference';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const { profile } = read;
const CODE = 'ministry-made-up';
let directory: FakeDirectory;
const pick = (field: string, value: string) => choose(press, field, value);

async function open() {
  directory.referenceCode = CODE;
  await show(<ReferencePage profile={profile} onBack={() => undefined} />);
  await type('gate-code', CODE);
  await press('gate-open');
}

const cemOptions = () => directory.draft?.levels.find((one) => one.code === 'cem')?.options.map((one) => one.code);

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  directory = new FakeDirectory();
  directory.install();
});

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

it('starts from the profile and saves a pair and a hidden option', async () => {
  await open();
  expect(texts()).toContain(words.levels.classTeacher);
  await press('levels-level-cem');
  await press('levels-add-pair');
  await pick('option-first', 'arabic');
  await pick('option-second', 'islamic');
  await press('option-save');
  expect(cemOptions()).toContain('arabic+islamic');
  await press('levels-add-pair');
  await pick('option-first', 'islamic');
  await pick('option-second', 'arabic');
  expect(texts()).toContain(words.levels.exists);
  await press('option-cancel');
  await press('option-hide-computing');
  expect(cemOptions()).not.toContain('computing');
  expect(directory.revision).toBe(2);
});

it('adds, edits and hides a school, then publishes and publishes an old version again', async () => {
  await open();
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

it('saves a draft never saved before publishing it', async () => {
  await open();
  await press('reference-go-publish');
  await press('publish-now');
  expect(directory.revision).toBe(1);
  expect(directory.versions).toHaveLength(1);
});

it('says when someone else saved first, and reads the latest copy', async () => {
  await open();
  directory.revision = 7;
  directory.draft = { levels: startingLevels(profile), schools: [schoolIn('160155', COMMUNE, 'مدرسة من غيري')] };
  await press('levels-add');
  await pick('option-first', 'arabic');
  await press('option-save');
  expect(texts()).toContain(words.problem.stale);
  expect(has('option-form')).toBe(false);
  const puts = directory.seen.filter((one) => one.startsWith('PUT')).length;
  await press('option-hide-french');
  expect(directory.seen.filter((one) => one.startsWith('PUT'))).toHaveLength(puts);
  await press('dashboard-retry');
  await press('reference-tab-schools');
  expect(texts()).toContain('مدرسة من غيري');
});

describe('importing schools', () => {
  const file = (text: string | Error) =>
    jest
      .spyOn(files, 'openText')
      .mockImplementation(() => (text instanceof Error ? Promise.reject(text) : Promise.resolve(text)));

  it('shows the check before anything changes, then applies it', async () => {
    await open();
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
    await open();
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
