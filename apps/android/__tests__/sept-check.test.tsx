// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The September check for an inspector (#225, Sept-check, R-4.11-06,
// answers 296 to 299): one column for each class of the subject and grade
// with a pinned pack, counted from the print day; a test taken by its title
// and day; lines that add up to the check; printed and saved as A4 portrait
// with no QR code and no pupils' data; opened from a class's plan and from
// Ready; every control named in each language and direction. 4م1 and 4م2 are
// made-up classes on the made-up example pack.

import { parseDay, termCheck } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { ClassPlan } from '../src/classes/ClassPlan';
import pdf from '../src/native/NativeMinhajnaPdf';
import { figure } from '../src/plan/sept-check';
import { SeptCheck } from '../src/plan/SeptCheck';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const printHtml = jest.spyOn(pdf, 'printHtml');
const makePdf = jest.spyOn(pdf, 'makePdf');
const savePdf = jest.spyOn(pdf, 'savePdf');
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const today = '2026-10-22';

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.clearAllMocks();
  await i18n.changeLanguage('ar');
});

/** Both classes on the example pack, with a test for 4م1 on 12 November. */
async function twoClasses(): Promise<TestData> {
  const data = await withDay();
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'course.set',
      course: {
        id: 'c-2',
        classId: 'k-2',
        subject: 'arabic',
        year: '2026-2027',
        pack: { id: 'dz.cem.4am.arabic.example', release: '2026.1' },
      },
    },
    {
      kind: 'test.set',
      test: {
        id: 't-1',
        courseId: 'c-1',
        day: parseDay('2026-11-12'),
        slot: { half: 'morning', index: 1 },
        groupId: 'k-1-w',
        title: 'الفرض الأول',
      },
    },
  ]);
  return data;
}

async function show(data: TestData, element: React.ReactElement, direction: 'rtl' | 'ltr' = 'rtl', on = today) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>{withData(data, element, on)}</LocaleDirContext.Provider>,
    );
  });
}
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) =>
      [node.props.children as unknown]
        .flat()
        .filter((part) => typeof part === 'string')
        .join(''),
    );
const byId = (id: string) =>
  root().findAll((node) => node.props.testID === id && typeof node.props.style !== 'undefined');
const press = (id: string) =>
  ReactTestRenderer.act(() =>
    (
      root().findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function')[0]?.props
        .onPress as () => void
    )(),
  );
const settle = () => ReactTestRenderer.act(() => new Promise((resolve) => setTimeout(resolve, 0)));
const ar = (name: string) => `⁨${name}⁩`;

test('shows a column for each class, the test by its title and day, and lines that add up to the check', async () => {
  const data = await twoClasses();
  await show(data, <SeptCheck courseId="c-1" />);
  expect(shown()).toEqual(
    expect.arrayContaining([
      ar('4م1'),
      ar('4م2'),
      `تُطرح: ${ar('الفرض الأول')}، الخميس ${ar('12/11/2026')}`,
      text.septCheck.left,
      text.septCheck.privacy,
    ]),
  );
  const context = coreContext({ ...data, state: data.book.state });
  const day = parseDay(today);
  const left = byId('sept-row-left')[0].props.accessibilityLabel as string;
  for (const [name, courseId] of [
    ['4م1', 'c-1'],
    ['4م2', 'c-2'],
  ] as const) {
    expect(left).toContain(`${termCheck(context, courseId, day)!.gives} لـ${ar(name)}`);
  }
  const taken = byId(`sept-row-${JSON.stringify(['taken', 'test', 't-1', null])}`)[0].props
    .accessibilityLabel as string;
  expect(taken).toContain(`1 لـ${ar('4م1')}`);
  expect(taken).toContain(`0 لـ${ar('4م2')}`);
  expect(accessibilityProblems(root())).toEqual([]);
});

test('prints and saves A4 portrait pages with the sheet, no QR code and no confidential mark', async () => {
  await show(await twoClasses(), <SeptCheck courseId="c-2" />);
  await press('sept-print');
  await settle();
  const [html, title, landscape] = printHtml.mock.calls[0];
  expect([title, landscape]).toEqual([text.septCheck.title, false]);
  expect(html).toContain('size:A4 portrait');
  expect(html).toContain(ar('4م1'));
  expect(html).toContain(text.septCheck.teacherSign);
  expect(html).not.toContain('QR');
  expect(html).not.toContain(text.documents.confidential);
  await press('sept-save');
  await settle();
  expect(makePdf).toHaveBeenCalledWith(expect.any(String), 'sept-check', false);
  expect(savePdf).toHaveBeenCalledWith('sept-check', 'فحص سبتمبر 22-10-2026.pdf');
  expect(shown()).toContain(text.documents.output.saved);
});

test("leaves out another school's class, and counts to the next term's exams once a term's have begun", async () => {
  const data = await twoClasses();
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'school.set',
      school: { id: 's-2', name: 'متوسطة الأمل', levels: ['cem'], subjects: ['arabic'], zone: '16' },
    },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-3',
        schoolId: 's-2',
        level: 'cem',
        grade: '4am',
        name: '4م3',
        groups: [{ id: 'k-3-w', kind: 'whole', name: '4م3' }],
      },
    },
    {
      kind: 'course.set',
      course: {
        id: 'c-3',
        classId: 'k-3',
        subject: 'arabic',
        year: '2026-2027',
        pack: { id: 'dz.cem.4am.arabic.example', release: '2026.1' },
      },
    },
  ]);
  await show(data, <SeptCheck courseId="c-1" />, 'rtl', '2026-12-08');
  expect(shown()).toEqual(expect.arrayContaining([ar('4م1'), ar('4م2')]));
  expect(shown()).not.toContain(ar('4م3'));
  const period = shown().find((line) => line.startsWith('الحصص من'));
  expect(period).toMatch(/^الحصص من الثلاثاء \u206808\/12\/2026\u2069 إلى .*، قبل اختبارات الفصل الثاني$/);
});

test('says there is no check when no class of the subject has a pack', async () => {
  const data = await withDay();
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'course.set',
    course: { id: 'c-1', classId: 'k-1', subject: 'arabic', year: '2026-2027', pack: null },
  });
  await show(data, <SeptCheck courseId="c-1" />);
  expect(shown()).toContain(text.septCheck.none);
  expect(root().findAll((node) => node.props.testID === 'sept-print')).toHaveLength(0);
});

test('opens from the check line of a class plan', async () => {
  const onCheck = jest.fn();
  await show(await twoClasses(), <ClassPlan courseId="c-1" onCheck={onCheck} />);
  await press('plan-sept-check');
  expect(onCheck).toHaveBeenCalledTimes(1);
});

test('keeps a minus sign left of its digits', () => {
  expect([figure(3), figure(0), figure(-2)]).toEqual(['3', '0', '⁦−2⁩']);
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every control (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  await show(await twoClasses(), <SeptCheck courseId="c-1" />, direction);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].septCheck.print);
});
