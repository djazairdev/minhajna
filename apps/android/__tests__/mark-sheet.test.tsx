// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «كشف النقاط المطبوع» on «التصدير الفصلي» (#242, Marks-sheet, answer 466):
// offered only once the export is ready; «طباعة» and «حفظ PDF» make the class,
// subject and term's page, with the teacher's name, each pupil's parts, average
// and appreciation, «داخلي · سري», logged with the term; the drawn signature in
// the teacher's box of a middle-school page, and none when the teacher leaves
// it blank; and every text found in each language. Made-up records only.

import { eventOf, setAppreciation, type RecordEvent } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { DAY, mount, press, root, texts, unmount } from '../jest/components-screen';
import { marked } from '../jest/marked-book';
import { MarksExport } from '../src/marks/MarksExport';
import pdf from '../src/native/NativeMinhajnaPdf';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

beforeEach(() => {
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});

const printHtml = jest.spyOn(pdf, 'printHtml');
const savePdf = jest.spyOn(pdf, 'savePdf');

afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
  printHtml.mockClear();
  savePdf.mockClear();
});

const signature = { width: 600, height: 200, path: 'M 10 20 L 300 150' };
const phrase = (pupilId: string): RecordEvent =>
  setAppreciation(
    { courseId: 'c-1', term: 1, pupilId },
    { release: '2026.1' },
    {
      id: 'good-1',
      band: 'good',
      text: { ar: 'نتائج حسنة تستحق المواصلة' },
    },
  );
/** 4م1 with every appreciation chosen, and the teacher's name and drawn signature. */
async function complete(): Promise<TestData> {
  const data = await marked();
  await data.book.recordAll(DAY, [
    ...['p-1', 'p-2', 'p-3'].map(phrase),
    { kind: 'teacher.personal.set', personal: { name: 'بن يحيى سعاد', signature, signatureOn: true } },
  ]);
  return data;
}
const screen = <MarksExport courseId="c-1" term={1} onSignature={jest.fn()} />;
const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;

test('the printed sheet is offered once the export is ready', async () => {
  await mount(await marked(), screen);
  expect(has('export-print')).toBe(false);
  await unmount();
  await mount(await complete(), screen);
  expect(texts()).toEqual(expect.arrayContaining(['ملفات أخرى', 'كشف النقاط المطبوع']));
  expect(accessibilityProblems(root())).toEqual([]);
});

test('«طباعة» and «حفظ PDF» make the page with each pupil’s marks and appreciation, logged', async () => {
  const data = await complete();
  await mount(data, screen);
  await press('export-print-button', 'export-save');
  const html = printHtml.mock.calls[0]?.[0] ?? '';
  expect(html.match(/<section class="page"/g)).toHaveLength(1);
  for (const part of [
    'كشف النقاط والتقديرات',
    'القسم: 4م1 · المادة: اللغة العربية · الفصل الأول · الأستاذ: \u2068بن يحيى سعاد\u2069',
    'تلميذة أولى',
    '<td>18.00</td><td>12.00</td><td>10.00</td><td>11.67</td>',
    '<td class="words">نتائج حسنة تستحق المواصلة</td>',
    'داخلي · سري',
    '<svg class="drawn"',
  ]) {
    expect(html).toContain(part);
  }
  expect(savePdf).toHaveBeenCalledWith(
    expect.any(String),
    'كشف النقاط والتقديرات 4م1 · اللغة العربية الفصل الأول 2026-2027.pdf',
  );
  const outputs = data.book.entries.flatMap((entry) => {
    const event: RecordEvent | null = eventOf(entry);
    return event?.kind === 'output.recorded' ? [[event.output.document, event.output.period, event.output.how]] : [];
  });
  expect(outputs).toEqual([
    ['mark-sheet', 'term-1', 'print'],
    ['mark-sheet', 'term-1', 'pdf'],
  ]);
});

test('the teacher’s box carries the drawn signature unless left blank', async () => {
  await mount(await complete(), screen);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'من يستلم ملف PDF يمكنه نسخ التوقيع.',
      'توقيعي المرسوم في خانتي، في الطباعة وملف PDF وحدهما، ويمكن تركها فارغة للتوقيع باليد.',
    ]),
  );
  await ReactTestRenderer.act(async () => {
    const [control] = root().findAll(
      (node) =>
        node.props.testID === 'export-signature' &&
        typeof (node.props as { onSelect?: unknown }).onSelect === 'function',
    );
    (control?.props as { onSelect: (one: string) => void }).onSelect('blank');
    await Promise.resolve();
  });
  await press('export-print-button');
  expect(printHtml.mock.calls[0]?.[0]).not.toContain('<svg class="drawn"');
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  missingKeys.length = 0;
  await mount(await complete(), screen);
  await press('export-print-button');
  expect(missingKeys).toEqual([]);
});
