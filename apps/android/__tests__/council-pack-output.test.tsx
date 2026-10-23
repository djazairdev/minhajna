// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Printing and saving «ملف مجلس القسم» (#244, Council, answer 470): the
// printed pack framed «داخلي · سري» with the school and year, every section of
// the screen, and each name escaped; «طباعة الملف» logged with its term; the
// PDF kept under a password the rule accepts, or as it is once protection is
// off, named by the class, subject, term and year; a cancelled save neither
// said nor logged; nothing to print in a term without averages; and every text
// found in each language. Made-up records only.

import { councilPack, eventOf, type CouncilPack, type RecordEvent } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { context, DAY, mount, press, root, texts, unmount } from '../jest/components-screen';
import { marked } from '../jest/marked-book';
import { councilHtml } from '../src/documents/council-html';
import { Log } from '../src/log/Log';
import { CouncilOutput } from '../src/marks/CouncilOutput';
import { MarksCouncil } from '../src/marks/MarksCouncil';
import { assessmentData } from '../src/marks/marks-rules';
import files from '../src/native/NativeMinhajnaFiles';
import pdf from '../src/native/NativeMinhajnaPdf';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const printHtml = jest.spyOn(pdf, 'printHtml');
const makePdf = jest.spyOn(pdf, 'makePdf');
const adoptPdf = jest.spyOn(files, 'adoptPdf');
const saveFile = jest.spyOn(files, 'saveFile');

afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

const screen = (term = 1) => <MarksCouncil courseId="c-1" term={term} onTerm={jest.fn()} />;
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
const NAME = 'ملف مجلس القسم 4م1 · اللغة العربية الفصل الأول 2026-2027.pdf';

test('the printed pack carries every section, framed confidential, and is logged with its term', async () => {
  const data = await marked();
  await mount(data, screen());
  expect(accessibilityProblems(root())).toEqual([]);
  await press('council-print');
  const [html, title, landscape] = printHtml.mock.calls[0] ?? [];
  expect([title, landscape]).toEqual(['ملف مجلس القسم', false]);
  for (const part of [
    'داخلي · سري',
    '4م1 · اللغة العربية · الفصل الأول',
    '<h2>الأرقام</h2>',
    '<td>معدل القسم</td><td>12.55</td>',
    '<h2>التوزيع حسب الفئات</h2>',
    '<h2>حسب الجنس</h2>',
    'لا مقارنة: هذا الفصل الأول.',
    '<td>1</td><td>تلميذة ثالثة</td><td>16.00</td>',
    'العتبتان باختياري، إذ لا عتبات رسمية.',
    'لا مناداة مسجّلة لهذا القسم في هذا الفصل بعد.',
  ]) {
    expect(html).toContain(part);
  }
  expect(outputs(data)).toEqual([['council', 'term-1', 'print']]);
  await unmount();
  await mount(data, <Log />);
  const logged = root()
    .findAll((node) => typeof node.type === 'string' && String(node.props.testID).startsWith('log-item-'))
    .map((node) => String(node.props.accessibilityLabel));
  expect(logged.some((line) => line.includes('ملف مجلس القسم · الفصل الأول'))).toBe(true);
});

/** Term 1's pack as term 2 would give it, with `previous` ranks and the previous term's figures. */
async function later(previous: Record<string, number | null>, before: CouncilPack['previous']) {
  const data = await marked();
  const pack = councilPack(context(data), assessmentData(data.profile)!, 'c-1', 1, DAY)!;
  const ranks = pack.ranks.map((row) => ({ ...row, previous: previous[row.pupilId] ?? null }));
  return { data, pack: { ...pack, previous: before, ranks } };
}
async function printed(data: TestData, pack: CouncilPack): Promise<string> {
  await mount(data, <CouncilOutput pack={pack} courseId="c-1" term={2} label="4م1 · اللغة العربية" />);
  await press('council-print');
  return printHtml.mock.calls.at(-1)?.[0] ?? '';
}

test('from term 2, the printed comparison has its arrows, and each rank its previous rank and change', async () => {
  const { data, pack } = await later({ 'p-3': 2, 'p-1': 1 }, { mean: 11, reached: 1, counted: 3 });
  const html = await printed(data, pack);
  for (const part of [
    '<h2>المقارنة مع الفصل الأول</h2>',
    'معدل القسم: من 11.00 إلى 12.55 ↑',
    '10 فما فوق: من 1 من 3 (33.3%) إلى 2 من 3 (66.7%) ↑',
    '<th>الرتبة</th><th>التلميذ</th><th>المعدل</th><th>سابقاً</th><th>التغيّر</th>',
    '<td>1</td><td>تلميذة ثالثة</td><td>16.00</td><td>2</td><td>↑ 1</td>',
    '<td>2</td><td>تلميذة أولى</td><td>11.67</td><td>1</td><td>↓ 1</td>',
    '<td>3</td><td>تلميذة ثانية</td><td>10.00</td><td>—</td><td>—</td>',
    '↑ و↓: عدد المراتب بين الفصلين.',
  ]) {
    expect(html).toContain(part);
  }
});

test('with no average the term before, it says so; the same rank and the teacher’s thresholds print', async () => {
  const { data, pack } = await later({ 'p-3': 1, 'p-1': 2, 'p-2': 3 }, null);
  const html = await printed(data, { ...pack, thresholds: { remedial: 10.5, distinction: 12 } });
  expect(html).toContain('لا مقارنة: لا معدل في الفصل الأول.');
  expect(html).toContain('<td>2</td><td>تلميذة أولى</td><td>11.67</td><td>2</td><td>=</td>');
  expect(html).toContain('<h2>مقترحون للمعالجة · أقل من 10.5</h2>');
  expect(html).toContain('<h2>مرشّحون للتنويه · 12 فأكثر</h2>');
});

test('each text on the printed page is escaped', () => {
  const html = councilHtml(
    { lang: 'ar', dir: 'rtl', title: 'ملف', school: '<b>', year: '2026-2027', confidential: 'داخلي · سري' },
    { book: 'ب', scope: 'م', sections: [{ title: 'ع', heads: ['ا'], rows: [['<i>&']], lines: ['"x"'] }] },
  );
  expect(html).toContain('&lt;b&gt;');
  expect(html).toContain('<td>&lt;i&gt;&amp;</td>');
  expect(html).not.toContain('<i>');
});

test('the PDF is kept under a password the rule accepts, named by class, subject, term and year', async () => {
  const data = await marked();
  await mount(data, screen());
  expect(texts()).toContain('يُنصح بها، ففي الملف نقاط التلاميذ.');
  await type('council-password', 'abc 12');
  await press('council-save');
  expect(texts()).toContain('من 6 إلى 64 حرفاً لاتينياً أو رقماً أو رمزاً، دون مسافات.');
  expect(makePdf).not.toHaveBeenCalled();
  await type('council-password', 'Majlis-2026');
  await press('council-save');
  expect(makePdf.mock.calls[0]?.[0]).toContain('<h2>الأرقام</h2>');
  expect(adoptPdf).toHaveBeenCalledWith('document-council', NAME, 'Majlis-2026');
  expect(saveFile).toHaveBeenCalledWith('fedcba9876543210');
  expect(texts()).toContain('حُفظ الملف.');
  expect(outputs(data)).toEqual([['council', 'term-1', 'pdf']]);
});

test('without a password the PDF is kept as it is; a cancelled save is neither said nor logged', async () => {
  const data = await marked();
  await mount(data, screen());
  await press('council-protect');
  expect(has('council-password')).toBe(false);
  expect(texts()).toContain('دون كلمة سر، يقرأ الملف كل من يصل إليه.');
  saveFile.mockResolvedValueOnce(false);
  await press('council-save');
  expect(adoptPdf).toHaveBeenCalledWith('document-council', NAME, '');
  expect(has('council-said')).toBe(false);
  expect(outputs(data)).toEqual([]);
  await press('council-save');
  expect(outputs(data)).toEqual([['council', 'term-1', 'pdf']]);
});

test('a term without averages has nothing to print', async () => {
  await mount(await marked(), screen(2));
  expect(has('council-print')).toBe(false);
  expect(has('council-save')).toBe(false);
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  missingKeys.length = 0;
  await mount(await marked(), screen());
  await press('council-print', 'council-save', 'council-protect', 'council-save');
  expect(missingKeys).toEqual([]);
});
