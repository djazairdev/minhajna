// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Setup-7-Ready (#31): what setup kept, the September check of each class
// with a pinned pack, TD counted apart, the next session with what the plan
// proposes, a class with no pack, and every control named and 48dp. Made-up
// schools, classes and timetables only.

import { parseDay, type RecordEvent, type TimetableEntry } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { Ready } from '../src/ready/Ready';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onDone = jest.fn();
const example = { id: 'dz.cem.4am.arabic.example', release: '2026.1' };

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  onDone.mockReset();
});

const schoolClass = (id: string, name: string): RecordEvent => ({
  kind: 'class.set',
  schoolClass: {
    id,
    schoolId: 's-1',
    level: 'cem',
    grade: '4am',
    name,
    groups: [{ id: `${id}-w`, kind: 'whole', name }],
  },
});

const entry = (id: string, weekday: 0 | 1 | 2, index: number, courseId: string, sessionType = 'lesson') =>
  ({
    id,
    weekday,
    slot: { half: 'morning', index },
    courseId,
    groupId: courseId === 'c-1' ? 'k-1-w' : 'k-2-w',
    weeks: 'every',
    sessionType,
  }) satisfies TimetableEntry;

async function withWeek(pinned: boolean): Promise<TestData> {
  const data = await openTestData();
  const pack = pinned ? example : null;
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'school.set',
      school: { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic'], zone: '16' },
    },
    schoolClass('k-1', '4م1'),
    schoolClass('k-2', '4م2'),
    { kind: 'course.set', course: { id: 'c-1', classId: 'k-1', subject: 'arabic', year: '2026-2027', pack } },
    { kind: 'course.set', course: { id: 'c-2', classId: 'k-2', subject: 'arabic', year: '2026-2027', pack } },
    {
      kind: 'timetable.set',
      version: {
        id: 'v-1',
        from: data.year.from,
        source: 'hand',
        entries: [
          entry('e-1', 0, 1, 'c-1'),
          entry('e-3', 1, 1, 'c-2'),
          entry('e-4', 1, 2, 'c-2'),
          entry('e-6', 1, 3, 'c-2'),
          entry('e-7', 1, 4, 'c-2'),
          entry('e-5', 2, 1, 'c-1', 'td'),
        ],
        blocks: [],
      },
    },
  ]);
  return data;
}

async function show(data: TestData, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <Ready onDone={onDone} />)}
      </LocaleDirContext.Provider>,
    );
  });
}

const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));
const label = (id: string) => root().findByProps({ testID: id }).props.accessibilityLabel as string;

const press = async (id: string) => {
  await ReactTestRenderer.act(() => {
    (
      root().find((node) => node.props.testID === id && typeof node.props.onPress === 'function')
        .props as PressableProps
    ).onPress?.({} as never);
  });
};

test('shows what setup kept, the check before the term-1 exams with TD apart, and the next session', async () => {
  await show(await withWeek(true));
  expect(shown()).toEqual(
    expect.arrayContaining([
      text.ready.title,
      text.ready.tagline,
      'قسمان · لا تلميذ',
      '6 ساعات في الأسبوع، في \u2068متوسطة النجاح\u2069',
      'اللغة العربية · السنة الرابعة متوسط: المخطط مثبّت لكل الأقسام',
      'الرزنامة الوطنية 2026-2027',
      'فحص سبتمبر، قبل اختبارات الفصل الأول (6 ديسمبر 2026، تاريخ تقديري)',
      '\u20684م1\u2069: ينقص 9 حصص عن حاجة المخطط',
      '\u20684م2\u2069: 26 حصة للاحتياط',
      text.ready.spareNote,
      text.ready.tdNote,
      text.ready.proposed,
      '\u206708:00 – 09:00\u2069',
      'الأحد 18 أكتوبر 2026',
      'فهم المنطوق 1 (مثال)',
    ]),
  );
  expect(label('ready-row-k-1')).toBe('4م1: حصص المخطط 9 متاحة و18 يحتاجها، والأعمال الموجهة 11 متاحة و0 عناصرها');
  expect(label('ready-row-k-2')).toBe('4م2: حصص المخطط 44 متاحة و18 يحتاجها، والأعمال الموجهة 0 متاحة و0 عناصرها');
  await press('ready-today');
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('has nothing to check while no class has a pack, and the next session is typed', async () => {
  await show(await withWeek(false));
  expect(shown()).toEqual(
    expect.arrayContaining([
      'اللغة العربية · السنة الرابعة متوسط: دون حزمة، تُكتب العناصر',
      text.ready.noCheck,
      text.ready.next,
      text.ready.typed,
    ]),
  );
  expect(shown()).not.toContain(text.ready.proposed);
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every control, 48 dp each (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  await show(await withWeek(true), direction);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].ready.title);
});
