// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «التصدير الفصلي» (#242, Export, answer 466): the hub's row, with how many
// marks and appreciations are missing, then ready; the screen's line and what
// is complete, nothing exported while an appreciation or a mark is missing; the
// school's route kept with the school; the workbook waiting for its templates;
// the ostad view in the grid's order with large numbers, each pupil read as one
// line, an absence as «غائب»; «إلى التصدير الفصلي» once the appreciations are
// complete; no row for a term observations replace; and every text found in
// each language. Made-up records only.

import { setAppreciation, setMark, type AppreciationList, type RecordEvent } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { DAY, mount, press, root, texts, unmount } from '../jest/components-screen';
import { marked } from '../jest/marked-book';
import { pupil } from '../jest/marks-class';
import { Marks } from '../src/marks/Marks';
import { MarksAppreciations } from '../src/marks/MarksAppreciations';
import { MarksExport } from '../src/marks/MarksExport';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

beforeEach(() => {
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});

afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
});

const list: Pick<AppreciationList, 'release'> = { release: '2026.1' };
const phrase = (pupilId: string): RecordEvent =>
  setAppreciation({ courseId: 'c-1', term: 1, pupilId }, list, {
    id: 'good-1',
    band: 'good',
    text: { ar: 'نتائج حسنة تستحق المواصلة' },
  });
/** Every pupil of 4م1 with a phrase. */
async function complete(): Promise<TestData> {
  const data = await marked();
  await data.book.recordAll(DAY, ['p-1', 'p-2', 'p-3'].map(phrase));
  return data;
}

const screen = <MarksExport courseId="c-1" term={1} onSignature={jest.fn()} onFile={jest.fn()} onCheck={jest.fn()} />;
const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;
const label = (testID: string) =>
  (root().findByProps({ testID }).props as { accessibilityLabel: string }).accessibilityLabel;
const route = (data: TestData) => [...data.book.state.schools.values()].map((school) => school.exportRoute);
const hub = (onExport = jest.fn()) => (
  <Marks
    courseId="c-1"
    onTerm={jest.fn()}
    onSetup={jest.fn()}
    onTests={jest.fn()}
    onCapture={jest.fn()}
    onComponents={jest.fn()}
    onBook={jest.fn()}
    onEntry={jest.fn()}
    onPart={jest.fn()}
    onObservations={jest.fn()}
    onAppreciations={jest.fn()}
    onExport={onExport}
    onFix={jest.fn()}
  />
);

test('the hub’s row says what is missing, then that the export is ready', async () => {
  const onExport = jest.fn();
  const data = await marked();
  await mount(data, hub(onExport));
  expect(texts()).toEqual(expect.arrayContaining(['التصدير الفصلي', 'نقاط ناقصة: 0 · تقديرات ناقصة: 3']));
  await press('marks-export');
  expect(onExport).toHaveBeenCalledWith(1);
  await unmount();
  await data.book.recordAll(DAY, ['p-1', 'p-2', 'p-3'].map(phrase));
  await mount(data, hub());
  expect(texts()).toContain('جاهز للتصدير');
});

test('nothing is exported while appreciations are missing, and the route is kept with the school', async () => {
  const data = await marked();
  await mount(data, screen);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'التصدير الفصلي · 4م1 · اللغة العربية · الفصل الأول',
      'النقاط كاملة: التقويم والفرض والاختبار',
      'المعدلات بالصيغة الرسمية، الإصدار 2026.1',
      'التقديرات: 0 من 3',
      'لا يطلب «منهاجنا» كلمة مرور ostad أو amatti، ولا يدخل إلى المنصات بدلاً مني، ولا يصدر كشوف النتائج للأولياء.',
    ]),
  );
  expect(has('export-not-ready')).toBe(true);
  expect(accessibilityProblems(root())).toEqual([]);
  await press('export-route-ostad');
  expect(route(data)).toEqual(['ostad']);
  expect(has('export-ostad')).toBe(false);
  await press('export-route-workbook');
  expect(route(data)).toEqual(['workbook']);
  expect(has('export-workbook-waits')).toBe(true);
});

test('once complete, the ostad view lists each pupil in the grid’s order with large numbers', async () => {
  const data = await complete();
  await mount(data, screen);
  expect(has('export-not-ready')).toBe(false);
  await press('export-route-ostad');
  expect(texts()).toEqual(expect.arrayContaining(['بترتيب الشبكة', '18.00', '12.00', '10.00']));
  expect(label('export-ostad-p-1')).toBe('1. \u2068تلميذة أولى\u2069، التقويم 18.00، الفرض 12.00، الاختبار 10.00');
  expect(label('export-ostad-p-3')).toMatch(/^3\. \u2068تلميذة ثالثة\u2069، /);
  expect(accessibilityProblems(root())).toEqual([]);
});

test('a missing mark is counted, and an absence is a value shown as «غائب»', async () => {
  const data = await complete();
  await data.book.recordAll(DAY, [pupil('p-4', 'تلميذة رابعة'), phrase('p-4')]);
  await mount(data, screen);
  expect(texts()).toEqual(
    expect.arrayContaining(['خانات نقاط ناقصة: 3 · التلاميذ المعنيون: 1 من 4', 'التقديرات: 4 من 4']),
  );
  expect(has('export-not-ready')).toBe(true);
  await unmount();
  const absent = await complete();
  await absent.book.record(
    DAY,
    setMark({ courseId: 'c-1', term: 1, target: { kind: 'exam' }, pupilId: 'p-3' }, 'absent', 20),
  );
  await mount(absent, screen);
  await press('export-route-ostad');
  expect(label('export-ostad-p-3')).toMatch(/الاختبار غائب$/);
});

test('«اكتملت التقديرات» leads to the export', async () => {
  const onExport = jest.fn();
  const data = await marked();
  await data.book.recordAll(DAY, ['p-1', 'p-2'].map(phrase));
  await mount(data, <MarksAppreciations courseId="c-1" term={1} onExport={onExport} />);
  await press('apprec-confirm', 'apprec-export');
  expect(onExport).toHaveBeenCalled();
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  missingKeys.length = 0;
  const data = await complete();
  await mount(data, screen);
  await press('export-route-workbook', 'export-route-ostad');
  await unmount();
  await mount(await marked(), screen);
  await unmount();
  await mount(data, hub());
  expect(missingKeys).toEqual([]);
});
