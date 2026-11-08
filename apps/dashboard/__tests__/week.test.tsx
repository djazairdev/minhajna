// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The week and the pupils' import on D-Classes against a made-up directory
// (answers 807 and 809, R-3.2-09): a week's cell set, and a teacher's second
// class at the same time refused; the middle school's slots for a level with
// no bell template; a file of pupils checked and applied, matched on the
// registration number. Every school and name is made up.

import { Platform } from 'react-native';
import { FakeDirectory } from '../jest/fake-directory';
import { has, press, rendered, texts, unmount } from '../../android/jest/ministry-page';
import { bookIn, EMPTY, openSchool, pick } from '../jest/school-desk';
import { slotCounts } from '../src/week-rules';
import files from '../../android/src/native/NativeMinhajnaFiles';
import { bundledFiles, readDashboardReference } from '../src/reference';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readDashboardReference(bundledFiles);
if (read === null) throw new Error('The bundled reference does not read');
const { bells } = read;
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

it('sets the week’s cells, and refuses a teacher in two classes at once', async () => {
  const taught = { arabic: 't1' };
  await openSchool(directory, {
    ...EMPTY,
    teachers: [TEACHER],
    classes: [
      { id: 'c1', grade: '4am', name: '4م1', pupils: [], teachers: taught },
      { id: 'c2', grade: '4am', name: '4م2', pupils: [], teachers: taught },
    ],
  });
  for (const one of ['c1', 'c2']) {
    await press(`class-${one}`);
    await press('class-tab-week');
    await pick('week-0-morning-1', 'arabic');
  }
  expect(book().week).toHaveLength(1);
  expect(texts()).toContain('أستاذ هذه المادة يدرّس القسم 4م1 في هذا الوقت.');
  await pick('week-0-morning-2', 'arabic');
  expect(book().week.map((one) => one.slot)).toEqual([
    { half: 'morning', index: 1 },
    { half: 'morning', index: 2 },
  ]);
});

it('checks a file of pupils, matched on the registration number, before applying it', async () => {
  await openSchool(directory, {
    format: 1,
    teachers: [],
    classes: [
      {
        id: 'c1',
        grade: '4am',
        name: '4م1',
        pupils: [{ id: 'p1', name: 'أمين مثال', sex: 'm', registration: '11' }],
        teachers: {},
      },
      {
        id: 'c2',
        grade: '4am',
        name: '4م2',
        pupils: [{ id: 'p2', name: 'هاجر مثال', sex: 'f', registration: '12' }],
        teachers: {},
      },
    ],
    week: [],
  });
  jest
    .spyOn(files, 'openText')
    .mockResolvedValue(
      [
        'رقم التسجيل;الاسم واللقب;الجنس;القسم',
        '11;أمين مثال;ذكر;4م1',
        '12;هاجر مثال;F;4م1',
        '13;يوسف مثال;m;4م2',
        '14;نور مثال;أنثى;4م9',
        '13;مكرر;m;4م2',
      ].join('\n'),
    );
  await press('classes-import');
  await press('import-pick');
  const figure = (id: string) =>
    rendered().root.findAll(
      (one) => one.props.testID === `import-figure-${id}` && one.props.accessibilityLabel !== undefined,
    )[0].props.accessibilityLabel as string;
  expect([figure('new'), figure('same'), figure('moved'), figure('refused')].map((one) => one.split(' ')[0])).toEqual([
    '1',
    '1',
    '1',
    '2',
  ]);
  expect(texts()).toContain('القسم غير موجود: 4م9');
  expect(book().classes[0].pupils).toHaveLength(1);
  await press('import-apply');
  expect(book().classes.map((one) => one.pupils.map((pupil) => pupil.registration).sort())).toEqual([
    ['11', '12'],
    ['13'],
  ]);
  expect(has('import-applied')).toBe(true);
});

it('takes the middle school’s slots for a level with no bell template', () => {
  expect(slotCounts(bells, 'primary')).toEqual(slotCounts(bells, 'cem'));
});
