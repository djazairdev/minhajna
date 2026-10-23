// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «مقارنة قبل التوقيع» (#242, Marks-check and Marks-check-diff, answer 467):
// the export's rows to the file screen and the check; no check before the
// export is ready; the CSV file the app made, in Arabic or French, or saved
// again with decimal points, matching row for row, the register shown with the
// file's decimal mark; a value changed in the file shown with both values, with
// «تصحيح في الكشف» and «إعادة تعبئة الملف»; a column the file lacks, numbers
// not on the list or on two lines; each pupil read as one line; a file that
// is not text, too large, without the header, or unreadable refused with what
// to do; a cancelled pick changing nothing; and every text found in each
// language. Made-up records only.

import { setAppreciation, type RecordEvent } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { DAY, mount, press, root, texts, unmount } from '../jest/components-screen';
import { marked } from '../jest/marked-book';
import { ExportFile } from '../src/marks/ExportFile';
import { MarksCheck } from '../src/marks/MarksCheck';
import { MarksExport } from '../src/marks/MarksExport';
import files from '../src/native/NativeMinhajnaFiles';
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
const openText = jest.spyOn(files, 'openText');

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
/** The CSV text the file screen makes for 4م1, in the interface's language. */
async function made(data: TestData): Promise<string> {
  await mount(data, <ExportFile courseId="c-1" term={1} onSignature={jest.fn()} />);
  await press('file-format-csv', 'file-protect', 'file-save');
  await unmount();
  return makeText.mock.calls.at(-1)?.[0] ?? '';
}
const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;
const label = (testID: string) =>
  (root().findByProps({ testID }).props as { accessibilityLabel: string }).accessibilityLabel;
/** The check screen with `text` as the file the teacher picks. */
async function checked(data: TestData, text: string | Error, props = { onBook: jest.fn(), onFile: jest.fn() }) {
  if (text instanceof Error) openText.mockRejectedValueOnce(text);
  else openText.mockResolvedValueOnce(text);
  await mount(data, <MarksCheck courseId="c-1" term={1} {...props} />);
  await press('check-pick');
}
const coded = (code: string) => Object.assign(new Error(code), { code });

test('the export’s rows open the file screen and the check', async () => {
  const onFile = jest.fn();
  const onCheck = jest.fn();
  await mount(
    await complete(),
    <MarksExport courseId="c-1" term={1} onSignature={jest.fn()} onFile={onFile} onCheck={onCheck} />,
  );
  await press('export-file', 'export-check');
  expect(onFile).toHaveBeenCalled();
  expect(onCheck).toHaveBeenCalled();
});

test('no check before the export is ready', async () => {
  await mount(await marked(), <MarksCheck courseId="c-1" term={1} onBook={jest.fn()} onFile={jest.fn()} />);
  expect(texts()).toEqual(['لا مقارنة قبل أن تكتمل نقاط الفصل وتقديراته.']);
});

test('the file the app made matches row for row, each pupil read as one line', async () => {
  const data = await complete();
  await checked(data, await made(data));
  expect(texts()).toEqual(
    expect.arrayContaining(['4م1 · اللغة العربية · الفصل الأول', '3 من 3 متطابقة', 'اختيار ملف آخر']),
  );
  expect(has('check-book')).toBe(false);
  expect(label('check-row-p-1')).toBe(
    '1 · \u2068تلميذة أولى\u2069، التقويم 18,00 في السجل و18,00 في الملف، الفرض 12,00 في السجل و12,00 في الملف، ' +
      'الاختبار 10,00 في السجل و10,00 في الملف، المعدل 11,67 في السجل و11,67 في الملف، متطابق',
  );
  expect(accessibilityProblems(root())).toEqual([]);
});

test('a file written in French is checked by its own words', async () => {
  const data = await complete();
  await i18n.changeLanguage('fr');
  const text = await made(data);
  await i18n.changeLanguage('ar');
  expect(text).toContain('N°;Nom et prénom');
  await checked(data, text);
  expect(texts()).toContain('3 من 3 متطابقة');
});

test('a file saved with decimal points matches, and the register is shown with points too', async () => {
  const data = await complete();
  await checked(data, (await made(data)).replace(/(\d),(\d)/g, '$1.$2'));
  expect(texts()).toContain('3 من 3 متطابقة');
  expect(label('check-row-p-1')).toMatch(/^1 · \u2068تلميذة أولى\u2069، التقويم 18\.00 في السجل و18\.00 في الملف، /);
});

test('a changed value shows both values, and leads to the sheet or the file', async () => {
  const data = await complete();
  const props = { onBook: jest.fn(), onFile: jest.fn() };
  const text = (await made(data)).replace('1;تلميذة أولى;18,00;12,00', '1;تلميذة أولى;18,00;12,25');
  await checked(data, text, props);
  expect(texts()).toEqual(
    expect.arrayContaining([
      '2 من 3 متطابقة · يختلف صف واحد',
      '1 · \u2068تلميذة أولى\u2069',
      'الفرض: 12,00 في السجل، و12,25 في الملف',
      'يختلف',
    ]),
  );
  expect(accessibilityProblems(root())).toEqual([]);
  await press('check-book', 'check-refill');
  expect(props.onBook).toHaveBeenCalled();
  expect(props.onFile).toHaveBeenCalled();
});

test('a missing column, a number not on the list and one on two lines are named', async () => {
  const data = await complete();
  const lines = (await made(data)).split('\r\n');
  const text = [
    ...lines.slice(0, 2).map((line) => line.replace(';الاختبار;', ';X;')),
    ...lines.slice(2, 5),
    lines[2],
    '9;غريب;1;1;1;1;',
  ].join('\r\n');
  await checked(data, text);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'أعمدة ليست في الملف: الاختبار',
      'أرقام في الملف ليست في قائمة القسم: 9',
      'أرقام في أكثر من سطر من الملف: 1. قورن أول سطر لكل منها.',
      'الاختبار: 10,00 في السجل، وليس في الملف',
    ]),
  );
});

test.each([
  [
    coded('E_FILE_BINARY'),
    'هذا الملف ليس ملف CSV نصياً: ملف مضغوط أو مصنّف Excel أو PDF. احفظ الجدول بصيغة CSV دون كلمة سر، ثم اختره.',
  ],
  [coded('E_FILE_SIZE'), 'الملف أكبر من 2 ميغابايت، وكشف قسم واحد أصغر من ذلك بكثير. اختر ملف هذا القسم وحده.'],
  [new Error('Unreadable'), 'تعذّرت قراءة الملف. حاول مرة أخرى، أو اختر ملفاً آخر.'],
  [
    'a;b\r\n1;2\r\n',
    'لم يُعثر في الملف على سطر العناوين: «الرقم» و«الاسم واللقب» وأعمدة النقاط. اختر ملف هذا القسم كما صُدِّر.',
  ],
])('a file that cannot be checked is refused with what to do', async (file, said) => {
  await checked(await complete(), file);
  expect(texts()).toEqual(expect.arrayContaining(['لم يُقرأ الملف', said]));
  expect(has('check-summary')).toBe(false);
});

test('a cancelled pick changes nothing', async () => {
  await checked(await complete(), '');
  openText.mockResolvedValueOnce(null);
  await press('check-pick');
  expect(texts()).toContain('لم يُقرأ الملف');
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  const data = await complete();
  const text = (await made(data)).replace(';12,00;', ';12,25;');
  await i18n.changeLanguage(language);
  missingKeys.length = 0;
  await checked(data, text);
  await unmount();
  await checked(data, coded('E_FILE_BINARY'));
  await unmount();
  await mount(await marked(), <MarksCheck courseId="c-1" term={1} onBook={jest.fn()} onFile={jest.fn()} />);
  expect(missingKeys).toEqual([]);
});
