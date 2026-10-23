// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «حفظ كشف النقاط في ملف» (#242, Export-file and Share-warn, answer 467): no
// file before the export is ready; the CSV file marked «داخلي · سري» with the
// class, subject, term and year, its header and each pupil with decimal
// commas, kept under a password the rule accepts; the PDF of the printed sheet;
// «مشاركة» only after Share-warn, which «إلغاء» leaves unsent; a cancelled save
// neither said nor logged; a file not made said as such; each kept or shared
// file logged as the sheet, its term and PDF or CSV, as the log says it; and
// every text found in each language. Made-up records only.

import { eventOf, setAppreciation, type RecordEvent } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { DAY, mount, press, root, texts, unmount } from '../jest/components-screen';
import { marked } from '../jest/marked-book';
import { Log } from '../src/log/Log';
import { ExportFile } from '../src/marks/ExportFile';
import files from '../src/native/NativeMinhajnaFiles';
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

const makeText = jest.spyOn(files, 'makeText');
const adoptPdf = jest.spyOn(files, 'adoptPdf');
const saveFile = jest.spyOn(files, 'saveFile');
const shareFile = jest.spyOn(files, 'shareFile');
const makePdf = jest.spyOn(pdf, 'makePdf');

afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

const phrase = (pupilId: string): RecordEvent =>
  setAppreciation(
    { courseId: 'c-1', term: 1, pupilId },
    { release: '2026.1' },
    { id: 'good-1', band: 'good', text: { ar: 'نتائج حسنة تستحق المواصلة' } },
  );
/** 4م1 with every appreciation chosen. */
async function complete(): Promise<TestData> {
  const data = await marked();
  await data.book.recordAll(DAY, ['p-1', 'p-2', 'p-3'].map(phrase));
  return data;
}
const screen = <ExportFile courseId="c-1" term={1} onSignature={jest.fn()} />;
const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;
async function type(testID: string, value: string) {
  await ReactTestRenderer.act(async () => {
    const [field] = root().findAll(
      (node) =>
        node.props.testID === testID && typeof (node.props as { onChangeText?: unknown }).onChangeText === 'function',
    );
    (field?.props as { onChangeText: (text: string) => void }).onChangeText(value);
    await Promise.resolve();
  });
}
const outputs = (data: TestData) =>
  data.book.entries.flatMap((entry) => {
    const event: RecordEvent | null = eventOf(entry);
    return event?.kind === 'output.recorded' ? [[event.output.document, event.output.period, event.output.how]] : [];
  });
const NAME = 'كشف النقاط والتقديرات 4م1 · اللغة العربية الفصل الأول 2026-2027';

test('no file before the export is ready', async () => {
  await mount(await marked(), screen);
  expect(texts()).toEqual(['لا ملف قبل أن تكتمل نقاط الفصل وتقديراته.']);
});

test('the CSV file is kept under a password the rule accepts, and logged', async () => {
  const data = await complete();
  await mount(data, screen);
  expect(texts()).toEqual(
    expect.arrayContaining(['4م1 · اللغة العربية · الفصل الأول · التلاميذ: 3', 'يُنصح بها، ففي الملف نقاط التلاميذ.']),
  );
  expect(accessibilityProblems(root())).toEqual([]);
  await press('file-format-csv');
  await type('file-password', 'abc 12');
  await press('file-save');
  expect(texts()).toContain('من 6 إلى 64 حرفاً لاتينياً أو رقماً أو رمزاً، دون مسافات.');
  expect(makeText).not.toHaveBeenCalled();
  await type('file-password', 'Tafs-2026');
  await press('file-save');
  const [text, fileName, password] = makeText.mock.calls[0] ?? [];
  expect([fileName, password]).toEqual([`${NAME}.csv`, 'Tafs-2026']);
  expect(text?.split('\r\n').slice(0, 3)).toEqual([
    '\uFEFFداخلي · سري;4م1;اللغة العربية;الفصل الأول;2026-2027',
    'الرقم;الاسم واللقب;التقويم;الفرض;الاختبار;المعدل;التقدير',
    '1;تلميذة أولى;18,00;12,00;10,00;11,67;نتائج حسنة تستحق المواصلة',
  ]);
  expect(saveFile).toHaveBeenCalledWith('0123456789abcdef');
  expect(texts()).toContain('حُفظ الملف.');
  expect(outputs(data)).toEqual([['mark-sheet', 'term-1', 'csv']]);
  await unmount();
  await mount(data, <Log />);
  const logged = root()
    .findAll((node) => typeof node.type === 'string' && String(node.props.testID).startsWith('log-item-'))
    .map((node) => String(node.props.accessibilityLabel));
  expect(logged).toContain('الملفات والطباعة. كشف النقاط والتقديرات · الفصل الأول · CSV');
});

test('without a password, the PDF of the printed sheet is kept as it is', async () => {
  const data = await complete();
  await mount(data, screen);
  await press('file-protect');
  expect(has('file-password')).toBe(false);
  expect(texts()).toContain('دون كلمة سر، يقرأ الملف كل من يصل إليه.');
  await press('file-save');
  expect(makePdf.mock.calls[0]?.[0]).toContain('كشف النقاط والتقديرات');
  expect(adoptPdf).toHaveBeenCalledWith('document-mark-sheet', `${NAME}.pdf`, '');
  expect(outputs(data)).toEqual([['mark-sheet', 'term-1', 'pdf']]);
});

test('«مشاركة» passes through Share-warn, and «إلغاء» sends nothing', async () => {
  const data = await complete();
  await mount(data, screen);
  await press('file-share');
  expect(root().findByProps({ testID: 'share-warn' }).props.visible).toBe(false);
  await type('file-password', 'Tafs-2026');
  await press('file-share');
  expect(root().findByProps({ testID: 'share-warn' }).props.visible).toBe(true);
  expect(texts()).toEqual(
    expect.arrayContaining([
      `${NAME}.pdf.zip`,
      'داخلي · سري',
      'الملف محمي بكلمة سر: بلّغها لمن يستلمه بطريق آخر، لا في الرسالة نفسها.',
      'لا روابط عامة: يُرسل الملف نفسه عبر قائمة المشاركة في الهاتف.',
    ]),
  );
  expect(accessibilityProblems(root())).toEqual([]);
  await press('share-warn-cancel');
  expect(shareFile).not.toHaveBeenCalled();
  await press('file-share', 'share-warn-share');
  expect(adoptPdf).toHaveBeenCalledWith('document-mark-sheet', `${NAME}.pdf`, 'Tafs-2026');
  expect(shareFile).toHaveBeenCalledWith('fedcba9876543210', 'مشاركة كشف النقاط');
  expect(outputs(data)).toEqual([['mark-sheet', 'term-1', 'pdf']]);
});

test('a cancelled save is neither said nor logged, and a file not made is said', async () => {
  const data = await complete();
  await mount(data, screen);
  await press('file-protect');
  saveFile.mockResolvedValueOnce(false);
  await press('file-save');
  expect(has('file-said')).toBe(false);
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  adoptPdf.mockRejectedValueOnce(new Error('No space'));
  await press('file-save');
  expect(texts()).toContain('لم تُصنع الوثيقة. حاول مرة أخرى.');
  warn.mockRestore();
  expect(outputs(data)).toEqual([]);
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  missingKeys.length = 0;
  await mount(await complete(), screen);
  await press('file-format-csv', 'file-save');
  await type('file-password', 'Tafs-2026');
  await press('file-share', 'file-protect', 'file-format-pdf');
  await unmount();
  await mount(await marked(), screen);
  expect(missingKeys).toEqual([]);
});
