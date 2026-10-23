// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «كشف النقاط» (#240, Marks-book, Marks-book-value, P-Marks, answers 457 to
// 459): the hub's row with how many pupils have an average; the sheet's line,
// formula and rows, each read by TalkBack as one line; the rows by the
// average; the class's figures and the pupil shown at 10.00 whose full value
// is 9.995; a pupil's value sheet with the formula in full, the verdict and
// the rank, opening their justification; an exam missed; primary's months
// under the name; with large text, the parts under the name; focus going back
// to the row the sheet was opened from; «طباعة» and «حفظ PDF» making this
// class and subject's page, logged with the term, with «خانة التوقيع» on a
// middle-school page while the drawn signature is in use and none in primary
// (answer 462); and every text found in each language. Made-up records only.

import { eventOf, setMark, type MarkTarget, type MarkValue, type RecordEvent } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { DAY, mount, press, root, texts, unmount } from '../jest/components-screen';
import { BottomSheet } from '../src/components/BottomSheet';
import { withTest } from '../jest/marks-class';
import { course, primaryClass } from '../jest/specialist-classes';
import { assessmentData, courseMarks } from '../src/marks/marks-rules';
import { Marks } from '../src/marks/Marks';
import { MarksBook } from '../src/marks/MarksBook';
import pdf from '../src/native/NativeMinhajnaPdf';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';

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

const mark = (target: MarkTarget, pupilId: string, value: MarkValue, max: number, courseId = 'c-1') =>
  setMark({ courseId, term: 1, target, pupilId }, value, max);
const component = (componentId: string, month?: string): MarkTarget => ({
  kind: 'component',
  componentId,
  ...(month !== undefined && { month }),
});
const POINTS = { participation: 4, quizzes: 3, homework: 3, notebook: 3, attendance: 3, research: 4 } as const;

/** 4م1: the first pupil at 11.67, the second at 9.995, the third at 16.00. */
async function marked(): Promise<TestData> {
  const data = await withTest();
  const given = {
    'p-1': [3.5, 2, 3, 2.5, 3, 4],
    'p-2': [3, 2, 2, 2, 1.72, 2],
    'p-3': [4, 3, 3, 3, 3, 4],
  } as const;
  const tests = { 'p-1': [12, 10], 'p-2': [10.25, 9.25], 'p-3': [16, 15] } as const;
  await data.book.recordAll(DAY, [
    ...Object.entries(given).flatMap(([pupilId, values]) =>
      Object.entries(POINTS).map(([id, points], index) => mark(component(id), pupilId, values[index], points)),
    ),
    ...Object.entries(tests).flatMap(([pupilId, [test, exam]]) => [
      mark({ kind: 'test', testId: 't-1' }, pupilId, test, 20),
      mark({ kind: 'exam' }, pupilId, exam, 20),
    ]),
  ]);
  return data;
}

const label = (pupilId: string) =>
  (root().findByProps({ testID: `book-row-${pupilId}` }).props as { accessibilityLabel: string }).accessibilityLabel;
const order = () =>
  root()
    .findAll((node) => typeof node.props.testID === 'string' && /^book-row-/.test(node.props.testID))
    .filter((node) => typeof (node.props as { onPress?: unknown }).onPress === 'function')
    .map((node) => (node.props.testID as string).slice(9));

test('the hub’s row says how many pupils have an average, and opens the book', async () => {
  const onBook = jest.fn();
  const hub = {
    onTerm: jest.fn(),
    onSetup: jest.fn(),
    onTests: jest.fn(),
    onCapture: jest.fn(),
    onEntry: jest.fn(),
    onPart: jest.fn(),
    onObservations: jest.fn(),
  };
  await mount(await marked(), <Marks courseId="c-1" onComponents={jest.fn()} onBook={onBook} {...hub} />);
  expect(texts()).toContain('المعدلات: 3 من 3');
  await press('marks-book');
  expect(onBook).toHaveBeenCalledWith(1);
});

test('the book shows each pupil’s parts and average, the figures, and the pupil shown at 10.00', async () => {
  await mount(await marked(), <MarksBook courseId="c-1" term={1} onJustify={jest.fn()} onSignature={jest.fn()} />);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'كشف النقاط · 4م1 · اللغة العربية · الفصل الأول',
      'المعدل = (معدل التقويم والفرض + 2 × الاختبار) ÷ 3',
      'النقاط على 20',
      '1. \u2068تلميذة أولى\u2069',
      '18.00',
      '11.67',
      'معدل القسم 12.55 · أعلى معدل 16.00 · أدنى معدل 10.00 · 10 فما فوق: 2 من 3',
      '\u2068تلميذة ثانية\u2069: 10.00 في الكشف، والقيمة الكاملة 9.995، فلا يُحسب في «10 فما فوق».',
    ]),
  );
  expect(label('p-1')).toBe('1. \u2068تلميذة أولى\u2069، التقويم 18.00، الفرض 12.00، الاختبار 10.00، المعدل 11.67');
  expect(label('p-2')).toBe('2. \u2068تلميذة ثانية\u2069، التقويم 12.72، الفرض 10.25، الاختبار 9.25، المعدل 10.00');
  expect(order()).toEqual(['p-1', 'p-2', 'p-3']);
  expect(accessibilityProblems(root())).toEqual([]);
});

test('with large text, the parts go under the name', async () => {
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 2 });
  await mount(await marked(), <MarksBook courseId="c-1" term={1} onJustify={jest.fn()} onSignature={jest.fn()} />);
  expect(texts()).toContain('التقويم 18.00 · الفرض 12.00 · الاختبار 10.00 · المعدل 11.67');
  expect(root().findAll((node) => node.props.testID === 'book-head')).toEqual([]);
  expect(accessibilityProblems(root())).toEqual([]);
});

test('by the average, highest first; the value sheet shows the formula in full, then the justification', async () => {
  const onJustify = jest.fn();
  await mount(await marked(), <MarksBook courseId="c-1" term={1} onJustify={onJustify} onSignature={jest.fn()} />);
  await pressSegment('book-order', 'average');
  expect(order()).toEqual(['p-3', 'p-1', 'p-2']);
  expect(label('p-3')).toMatch(/^3\. \u2068تلميذة ثالثة\u2069/);
  await press('book-row-p-2');
  expect(texts()).toEqual(
    expect.arrayContaining([
      'رقم 2 في القائمة · المعدل الفصلي',
      '10.00',
      '9.995',
      '((12.72 + 10.25) ÷ 2 + 2 × 9.25) ÷ 3 = 9.995',
      'المعدل دون 10، فلا يُحسب في «10 فما فوق». الترتيب 3 من 3.',
    ]),
  );
  expect(accessibilityProblems(root())).toEqual([]);
  await press('book-value-justify');
  expect(onJustify).toHaveBeenCalledWith('p-2');
});

test('an exam missed shows «غ», with no average', async () => {
  const data = await marked();
  await data.book.record(DAY, mark({ kind: 'exam' }, 'p-1', 'absent', 20));
  await mount(data, <MarksBook courseId="c-1" term={1} onJustify={jest.fn()} onSignature={jest.fn()} />);
  expect(label('p-1')).toBe('1. \u2068تلميذة أولى\u2069، التقويم 18.00، الفرض 12.00، الاختبار غ، المعدل —');
  await press('book-row-p-1');
  expect(texts()).toContain('لا معدل حتى تكتمل أجزاؤه.');
});

test('primary’s book shows each pupil’s months under the name, out of 10', async () => {
  const data = await withTest();
  await data.book.recordAll(DAY, [
    primaryClass('k-p', 's-1', '5ap', '5 ابتدائي أ'),
    course('c-p', 'k-p', 'arabic'),
    { kind: 'pupil.set', pupil: { id: 'q-1', classId: 'k-p', name: 'تلميذ أول', sex: 'm', groups: [], movements: [] } },
  ]);
  const lines = courseMarks(data.book.state, assessmentData(data.profile)!, 'c-p', 1)?.assessment?.lines ?? [];
  await data.book.recordAll(DAY, [
    ...lines.map((line) => mark(component(line.id, '2026-10'), 'q-1', line.points, line.points, 'c-p')),
    mark({ kind: 'exam' }, 'q-1', 8, 10, 'c-p'),
  ]);
  await mount(data, <MarksBook courseId="c-p" term={1} onJustify={jest.fn()} onSignature={jest.fn()} />);
  expect(texts()).toEqual(expect.arrayContaining(['أكتوبر 10.00', '10.00', '8.00', '9.00']));
  expect(texts().some((one) => one.startsWith('النقاط على 10'))).toBe(true);
  expect(label('q-1')).toBe('1. \u2068تلميذ أول\u2069، أكتوبر 10.00، التقويم 10.00، الاختبار 8.00، المعدل 9.00');
});

test('the value sheet hands focus back to the row it was opened from', async () => {
  await mount(await marked(), <MarksBook courseId="c-1" term={1} onJustify={jest.fn()} onSignature={jest.fn()} />);
  await press('book-row-p-2');
  const sheet = root().findByType(BottomSheet).props as {
    returnFocusRef: { current: { props: { testID?: string } } | null };
  };
  expect(sheet.returnFocusRef.current?.props.testID).toBe('book-row-p-2');
});

test('«طباعة» and «حفظ PDF» make this class and subject’s page, and go into the log', async () => {
  const data = await marked();
  await mount(data, <MarksBook courseId="c-1" term={1} onJustify={jest.fn()} onSignature={jest.fn()} />);
  await press('book-print', 'book-save');
  expect(printHtml.mock.calls[0]?.[0].match(/<section class="page"/g)).toHaveLength(1);
  expect(savePdf).toHaveBeenCalledWith(expect.any(String), 'كشف النقاط 4م1 · اللغة العربية الفصل الأول 2026-2027.pdf');
  const outputs = data.book.entries.flatMap((entry) => {
    const event: RecordEvent | null = eventOf(entry);
    return event?.kind === 'output.recorded' ? [[event.output.document, event.output.period, event.output.how]] : [];
  });
  expect(outputs).toEqual([
    ['grade-book', 'term-1', 'print'],
    ['grade-book', 'term-1', 'pdf'],
  ]);
});

test('a middle-school page offers «خانة التوقيع» while the drawn signature is in use', async () => {
  const data = await marked();
  const signature = { width: 600, height: 200, path: 'M 10 20 L 300 150' };
  await data.book.record(DAY, { kind: 'teacher.personal.set', personal: { signature, signatureOn: true } });
  await mount(data, <MarksBook courseId="c-1" term={1} onJustify={jest.fn()} onSignature={jest.fn()} />);
  expect(texts()).toContain('من يستلم ملف PDF يمكنه نسخ التوقيع.');
  expect(root().findAll((node) => node.props.testID === 'book-signature-settings').length).toBeGreaterThan(0);
  await press('book-print');
  expect(printHtml.mock.calls[0]?.[0]).toContain('<svg class="drawn"');
  await pressSegment('book-signature', 'blank');
  await press('book-print');
  expect(printHtml.mock.calls[1]?.[0]).not.toContain('<svg class="drawn"');
  expect(texts()).not.toContain('من يستلم ملف PDF يمكنه نسخ التوقيع.');
  await unmount();
  const primary = await withTest();
  await primary.book.recordAll(DAY, [
    { kind: 'teacher.personal.set', personal: { signature, signatureOn: true } },
    primaryClass('k-p', 's-1', '5ap', '5 ابتدائي أ'),
    course('c-p', 'k-p', 'arabic'),
  ]);
  await mount(primary, <MarksBook courseId="c-p" term={1} onJustify={jest.fn()} onSignature={jest.fn()} />);
  expect(root().findAll((node) => node.props.testID === 'book-signature')).toEqual([]);
  expect(texts()).toContain(text.documents.output.signatureGradeBook);
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  await mount(await marked(), <MarksBook courseId="c-1" term={1} onJustify={jest.fn()} onSignature={jest.fn()} />);
  await press('book-row-p-2');
  expect(texts().filter((one) => /marks\.[a-zA-Z]/.test(one))).toEqual([]);
  expect(accessibilityProblems(root())).toEqual([]);
});

/** Picks a choice of a segmented control. */
async function pressSegment(testID: string, value: string) {
  await ReactTestRenderer.act(async () => {
    const [control] = root().findAll(
      (node) => node.props.testID === testID && typeof (node.props as { onSelect?: unknown }).onSelect === 'function',
    );
    (control?.props as { onSelect: (one: string) => void }).onSelect(value);
    await Promise.resolve();
  });
}
