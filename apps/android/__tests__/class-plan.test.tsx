// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's plan (#37): where the class stands with the sessions left
// before the exams; each unit's items with the days they were taught or
// would be reached, their status, where the class is and where the plan
// places it, as a reference only; a class with no pack; and every row named
// in each language. Made-up schools, classes and timetables only.

import { confirmSessions, parseDay, todayView } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { ClassPlan } from '../src/classes/ClassPlan';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

async function withFirst(): Promise<TestData> {
  const data = await withDay();
  const day = parseDay('2026-10-15');
  const context = coreContext({ ...data, state: data.book.state });
  const [first] = todayView(context, day).sessions;
  await data.book.recordAll(day, confirmSessions(context, [{ session: first.session }]));
  return data;
}

async function show(data: TestData, courseId = 'c-1', direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <ClassPlan courseId={courseId} />, '2026-10-22')}
      </LocaleDirContext.Provider>,
    );
  });
}

const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) =>
      [node.props.children as unknown]
        .flat()
        .filter((part) => typeof part === 'string' || typeof part === 'number')
        .join(''),
    );
const spoken = (id: string) =>
  root().findAll((node) => node.props.testID === id && typeof node.props.accessibilityLabel === 'string')[0]?.props
    .accessibilityLabel as string | undefined;

test('where the class stands, with the sessions left before the exams and what the plan needs', async () => {
  await show(await withFirst());
  expect(shown().slice(0, 8)).toEqual([
    '4م1 · اللغة العربية',
    text.plan.status.example,
    'المخطط السنوي · الإصدار 2026.1',
    text.plan.anchor.sessions,
    text.plan.meaning.example,
    'لا تأخر · يحتاج المخطط 5 حصص أكثر مما بقي قبل الاختبارات',
    'حتى اختبارات الفصل الأول (06/12): 12 حصة للدرس، ويحتاج منها المخطط 17 حصة.',
    text.classPlan.reference,
  ]);
  expect(accessibilityProblems(root())).toEqual([]);
});

test('each item with its days, its status, the class here and the plan’s place as a reference', async () => {
  await show(await withFirst());
  expect(spoken('plan-d1')).toBe('تقويم تشخيصي (مثال)، دُرّس 15/10، جارٍ، الموقع، موقع المخطط');
  expect(spoken('plan-u1-1')).toBe('الوضعية المشكلة الانطلاقية 1 (مثال)، يُبلغ 22/10 إن بقي كل شيء كما هو');
  expect(shown()).toEqual(expect.arrayContaining(['المقطع 1 (مثال)', 'المقطع 2 (مثال)', text.classPlan.buffer]));
});

test('a class with no pack is not compared', async () => {
  await show(await withFirst(), 'c-2');
  expect(shown()).toEqual(['4م2 · اللغة العربية', text.classes.noPack, text.classPlan.noPack]);
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every row (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  await show(await withFirst(), 'c-1', direction);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].classPlan.reference);
});
