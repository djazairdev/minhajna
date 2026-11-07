// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Classes and the teachers' page against a made-up directory (answers 807 to
// 809): a teacher added gets the server's joining code, which prints and
// renews; a class is added, a pupil typed, moved and leaving; a subject given
// a teacher; the week's cell set, and a teacher's second class at the same
// time refused; a file of pupils checked and applied, matched on the
// registration number. Every school and name is made up.

import type { SchoolBook } from '@minhajna/core';
import { Platform } from 'react-native';
import { choose, COMMUNE, schoolIn } from '../jest/dashboard-world';
import { FakeDirectory } from '../jest/fake-directory';
import { has, press, rendered, show, texts, type, unmount } from '../jest/ministry-page';
import { SchoolDesk } from '../src/dashboard/SchoolDesk';
import words from '../src/dashboard/text/ar.json';
import files from '../src/native/NativeMinhajnaFiles';
import pdf from '../src/native/NativeMinhajnaPdf';
import { bundledReference, readReference } from '../src/reference';
import { startingLevels } from '@minhajna/core';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const { profile, bells } = read;
const school = schoolIn('160101', COMMUNE, 'متوسطة مثال');
const list = {
  format: 1 as const,
  version: '2029.1',
  published: '2029-11-12' as never,
  levels: startingLevels(profile),
  schools: [school],
};
const pick = (field: string, value: string) => choose(press, field, value);
let directory: FakeDirectory;

const book = () => directory.books.get('160101')!.book;
const ids = (testID: string) =>
  rendered()
    .root.findAll(
      (one) =>
        typeof one.props.testID === 'string' && one.props.testID.startsWith(testID) && one.props.onPress !== undefined,
    )
    .map((one) => (one.props.testID as string).slice(testID.length));

async function open(start: SchoolBook = { format: 1, teachers: [], classes: [], week: [] }) {
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

async function teacher(name: string, option: string) {
  await press('dashboard-side-teachers');
  await press('teachers-add');
  await type('teacher-form-name', name);
  await pick('teacher-form-option', option);
  await press('teacher-form-save');
}

async function newClass(grade: string, name: string) {
  await press('dashboard-side-classes');
  await press('classes-add');
  await pick('class-form-grade', grade);
  await type('class-form-name', name);
  await press('class-form-save');
  return book().classes.find((one) => one.name === name)!.id;
}

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  directory = new FakeDirectory();
  directory.install();
});

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

it('gives a new teacher the server’s code, prints it and renews it', async () => {
  await open();
  await teacher('بن مثال سعاد', 'arabic');
  const [id] = book().teachers.map((one) => one.id);
  const first = book().teachers[0]?.code;
  expect(texts()).toContain('ABCD-2345-EFGH-7771');
  await press(`teacher-${id}`);
  await press('teacher-print');
  expect(jest.mocked(pdf.printHtml).mock.calls.at(-1)?.[0]).toContain('ABCD-2345-EFGH-7771');
  await press('teacher-renew');
  expect(book().teachers[0]?.code).not.toBe(first);
  expect(texts()).toContain('ABCD-2345-EFGH-7772');
});

it('adds a class and a pupil, moves the pupil, and records a leaving', async () => {
  await open();
  const first = await newClass('4am', '4م1');
  const second = await newClass('4am', '4م2');
  await press(`class-${first}`);
  await press('pupil-start');
  await type('pupil-name', 'تلميذة مثال');
  await pick('pupil-sex', 'f');
  await type('pupil-registration', '1120450087');
  await press('pupil-add');
  const [pupil] = book().classes[0]!.pupils;
  expect(pupil).toMatchObject({ name: 'تلميذة مثال', sex: 'f', registration: '1120450087' });
  await type('pupil-registration', '1120450087');
  expect(texts()).toContain(words.pupils.taken);
  await press(`pupil-${pupil!.id}`);
  await pick('pupil-move', second);
  expect(book().classes[1]!.pupils.map((one) => one.id)).toEqual([pupil!.id]);
  await press(`class-${second}`);
  await press(`pupil-${pupil!.id}`);
  await press('pupil-leave');
  expect(book().classes.flatMap((one) => one.pupils)).toEqual([]);
});

it('gives subjects their teachers, and refuses a teacher in two classes at once', async () => {
  await open();
  await teacher('بن مثال سعاد', 'arabic');
  const [teacherId] = book().teachers.map((one) => one.id);
  const first = await newClass('4am', '4م1');
  const second = await newClass('4am', '4م2');
  for (const one of [first, second]) {
    await press(`class-${one}`);
    await press('class-tab-teachers');
    await pick('assign-arabic', teacherId!);
    await press('class-tab-week');
    await pick('week-0-morning-1', 'arabic');
  }
  expect(book().classes.map((one) => one.teachers.arabic)).toEqual([teacherId, teacherId]);
  expect(book().week).toHaveLength(1);
  expect(texts()).toContain('أستاذ هذه المادة يدرّس القسم 4م1 في هذا الوقت.');
  await pick('week-0-morning-2', 'arabic');
  expect(book().week.map((one) => one.slot)).toEqual([
    { half: 'morning', index: 1 },
    { half: 'morning', index: 2 },
  ]);
});

it('checks a file of pupils, matched on the registration number, before applying it', async () => {
  await open({
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
    )[0]!.props.accessibilityLabel as string;
  expect([figure('new'), figure('same'), figure('moved'), figure('refused')].map((one) => one.split(' ')[0])).toEqual([
    '1',
    '1',
    '1',
    '2',
  ]);
  expect(texts()).toContain('القسم غير موجود: 4م9');
  expect(book().classes[0]!.pupils).toHaveLength(1);
  await press('import-apply');
  expect(book().classes.map((one) => one.pupils.map((pupil) => pupil.registration).sort())).toEqual([
    ['11', '12'],
    ['13'],
  ]);
  expect(has('import-applied')).toBe(true);
});
