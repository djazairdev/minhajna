// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «مواعيد الفروض» (#221, Test-schedule): a class with no test yet and its
// next exams; a test added on a session day, after the form shows what it
// takes and what moves, then shown in the list and the class plan; the
// name it needs; removing a test and «تراجع» for both; a session day only;
// every control named in each language. The month grid's days share its
// width, so the static check leaves their width out. Made-up records only.

import { parseDay } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { ClassPlan } from '../src/classes/ClassPlan';
import { TestSchedule } from '../src/exams/TestSchedule';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function mount(data: TestData, element: React.ReactElement, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>{withData(data, element)}</LocaleDirContext.Provider>,
    );
    await settle();
  });
}

const texts = () =>
  tree!.root.findAllByType(Text).map((node) =>
    [(node.props as TextProps).children as unknown]
      .flat()
      .filter((part) => typeof part === 'string' || typeof part === 'number')
      .join(''),
  );

const control = (testID: string) =>
  tree!.root.findAll(
    (node) => node.props.testID === testID && typeof (node.props as PressableProps).onPress === 'function',
  )[0];

const exists = (testID: string) => tree!.root.findAll((node) => node.props.testID === testID).length > 0;

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (control(testID).props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

async function type(testID: string, value: string) {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID }).props as { onChangeText: (value: string) => void }).onChangeText(value);
    await settle();
  });
}

const problems = () =>
  accessibilityProblems(tree!.root).filter((problem) => !problem.endsWith('smaller than 48dp (0×48)'));

const schedule = () => <TestSchedule courseId="c-1" onCourse={() => undefined} />;

const tests = (data: TestData) => [...data.book.state.tests.values()];

test('a class with no test yet, and its next exams from the calendar', async () => {
  const data = await withDay();
  await mount(data, schedule());
  expect(texts()).toEqual([
    text.tests.class,
    '4م1',
    '4م2',
    text.tests.intro,
    'لا فرض بعد في 4م1.',
    'اختبارات الفصل الأول',
    text.tests.expected,
    'من الأحد 6 ديسمبر، من الرزنامة لا من الحزمة. يتوقف فيها المخطط، ولا تُعدّ حصصها ضائعة ولا تأخراً.',
    'إضافة فرض في 4م1',
  ]);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});

test('shows what a test takes and moves before saving, then lists it in the schedule and the plan', async () => {
  const data = await withDay();
  await mount(data, schedule());
  await press('tests-open-add');
  await type('tests-name', 'الفرض الأول');
  await press('extra-day-2026-10-22');
  expect(texts()).toEqual(
    expect.arrayContaining([
      'الخميس 22 أكتوبر',
      '4م1\u00a0·\u00a008:00',
      '4م1\u00a0·\u00a009:00',
      'يأخذ حصة درس: تصبح حصص الدرس المتاحة 13 بدل 14.',
      'ويتأخر «\u2068الوضعية المشكلة الانطلاقية 1 (مثال)\u2069» وما بعده حصة واحدة.',
      'وسيقع «\u2068فهم المكتوب 2 (مثال)\u2069» بعد بداية الاختبارات، الأحد 6 ديسمبر. ويبقى التنبيه في «اليوم» والمخطط حتى تختار ما تفعل.',
      text.tests.saveAndMove,
    ]),
  );
  expect(problems()).toEqual([]);
  expect(tests(data)).toEqual([]);

  await press('tests-common');
  await press('tests-save');
  const [test] = tests(data);
  expect(test.id).toMatch(/./);
  expect({ ...test, id: '' }).toEqual({
    id: '',
    courseId: 'c-1',
    day: '2026-10-22',
    slot: { half: 'morning', index: 1 },
    groupId: 'k-1-w',
    title: 'الفرض الأول',
    common: true,
  });
  expect(exists('tests-add')).toBe(false);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'الفرض الأول',
      'الخميس 22 أكتوبر · 4م1\u00a0·\u00a008:00',
      text.tests.fixed,
      text.tests.common,
      'أُضيف «\u2068الفرض الأول\u2069» صفاً ثابتاً في المخطط.',
    ]),
  );

  await mount(data, <ClassPlan courseId="c-1" onTests={() => undefined} />);
  expect(exists(`plan-test-${test.id}`)).toBe(true);
  expect(texts()).toEqual(expect.arrayContaining(['22/10', 'الفرض الأول', text.tests.fixed, text.tests.title]));
  expect(exists('plan-tests')).toBe(true);
});

test('a test needs its name, and only a session day of the class can be chosen', async () => {
  const data = await withDay();
  await mount(data, schedule());
  await press('tests-open-add');
  await press('tests-save');
  expect(texts()).toContain(text.tests.nameMissing);
  expect(tests(data)).toEqual([]);
  const day = (id: string) =>
    tree!.root.findAll((node) => node.props.testID === id && node.props.accessibilityState !== undefined)[0]?.props
      .accessibilityState as { disabled: boolean };
  expect(day('extra-day-2026-10-22').disabled).toBe(false);
  expect(day('extra-day-2026-10-21').disabled).toBe(true);
  expect(day('extra-day-2026-10-14').disabled).toBe(true);

  await press('tests-cancel');
  expect(exists('tests-add')).toBe(false);
});

test('a session taken by a test is no longer offered, and removing it gives it back, with undo', async () => {
  const data = await withDay();
  const test = {
    id: 't-1',
    courseId: 'c-1',
    day: parseDay('2026-10-22'),
    slot: { half: 'morning', index: 1 },
    groupId: 'k-1-w',
    title: 'الفرض الأول',
  } as const;
  await data.book.record(parseDay('2026-10-15'), { kind: 'test.set', test });
  await mount(data, schedule());
  await press('tests-open-add');
  await press('extra-day-2026-10-22');
  expect(texts()).not.toContain('4م1\u00a0·\u00a008:00');
  expect(texts()).toContain('4م1\u00a0·\u00a009:00');
  await press('tests-cancel');

  await press('tests-remove-t-1');
  expect(tests(data)).toEqual([]);
  expect(texts()).toContain('حُذف «\u2068الفرض الأول\u2069»، وعادت حصته إلى المخطط.');
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID: 'tests-said' }).props as { onUndo: () => void }).onUndo();
    await settle();
  });
  expect(tests(data)).toEqual([test]);
});

test('counts the sessions in the test’s own term, none after its exams, and none lost on a slot with no lesson', async () => {
  const data = await withDay();
  await mount(data, schedule());
  await press('tests-open-add');
  for (let month = 0; month < 3; month++) await press('extra-month-after');
  await press('extra-day-2027-01-07');
  const january = texts().find((line) => line.startsWith('يأخذ حصة درس'));
  const [after, before] = (january?.match(/\d+/g) ?? []).map(Number);
  expect(after).toBe((before ?? 0) - 1);
  await press('extra-month-before');
  await press('extra-day-2026-12-17');
  expect(texts().some((line) => line.startsWith('يأخذ حصة درس'))).toBe(false);

  await data.book.record(parseDay('2026-10-15'), {
    kind: 'timetable.set',
    version: {
      id: 'v-2',
      from: parseDay('2026-10-18'),
      source: 'hand',
      blocks: [],
      entries: [
        {
          id: 'e-r',
          weekday: 4,
          slot: { half: 'morning', index: 1 },
          courseId: 'c-1',
          groupId: 'k-1-w',
          weeks: 'every',
          sessionType: 'remediation',
        },
      ],
    },
  });
  await mount(data, schedule());
  await press('tests-open-add');
  await press('extra-day-2026-10-22');
  expect(texts()).toContain(text.tests.takesOther);
  expect(texts().some((line) => line.startsWith('يأخذ حصة درس'))).toBe(false);
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every control (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  const data = await withDay();
  await mount(data, schedule(), direction);
  await press('tests-open-add');
  await press('extra-day-2026-10-22');
  expect(problems()).toEqual([]);
  expect(texts()).toContain(catalogues[language].tests.intro);
});
