// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تبرير التقويم المستمر» (#239, Marks-pupil, answers 443 and 454): a pupil's
// page with T, the test mean, the exam and the term average, each component
// with what was recorded and its mark; the next pupil, with components still
// empty; an exam marked absent; one pupil or the whole class printed, each
// page framed «داخلي · سري», and saved as a PDF named by the class and list
// number (answer 455); each print and save in the activity log with the
// term, never a name; primary's page for a month, with no average; the
// classes and subjects it can be made for; and every text found in each
// language. Made-up records only.

import { eventOf, parseDay, setMark, type MarkTarget, type RecordEvent } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { context, control, DAY, mount, press, root, texts, unmount } from '../jest/components-screen';
import { withTest } from '../jest/marks-class';
import { course, primaryClass } from '../jest/specialist-classes';
import { justifyCourses } from '../src/marks/justify-rules';
import { assessmentData } from '../src/marks/marks-rules';
import { MarksJustify } from '../src/marks/MarksJustify';
import pdf from '../src/native/NativeMinhajnaPdf';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const printHtml = jest.spyOn(pdf, 'printHtml');
const savePdf = jest.spyOn(pdf, 'savePdf');

afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

const mark = (target: MarkTarget, pupilId: string, value: number | 'absent', max: number, courseId = 'c-1') =>
  setMark({ courseId, term: 1, target, pupilId }, value, max);
const component = (componentId: string, month?: string): MarkTarget => ({
  kind: 'component',
  componentId,
  ...(month !== undefined && { month }),
});

/** 4م1 with every component of the first pupil marked, her test and her exam. */
async function marked(): Promise<TestData> {
  const data = await withTest();
  const given = { participation: [3.5, 4], quizzes: [2, 3], homework: [3, 3], notebook: [2.5, 3] } as const;
  await data.book.recordAll(DAY, [
    ...Object.entries(given).map(([id, [value, max]]) => mark(component(id), 'p-1', value, max)),
    mark(component('attendance'), 'p-1', 3, 3),
    mark(component('research'), 'p-1', 4, 4),
    mark({ kind: 'test', testId: 't-1' }, 'p-1', 12, 20),
    mark({ kind: 'exam' }, 'p-1', 10, 20),
  ]);
  return data;
}

const outputs = (data: TestData) =>
  data.book.entries.flatMap((entry) => {
    const event: RecordEvent | null = eventOf(entry);
    return event?.kind === 'output.recorded' ? [[event.output.document, event.output.period, event.output.how]] : [];
  });

test('a pupil’s page adds up T, the test, the exam and the average, beside what was recorded', async () => {
  await mount(await marked(), <MarksJustify courseId="c-1" />);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'تلميذة أولى',
      '4م1 · اللغة العربية · التقويم المستمر · الفصل الأول',
      '18.00',
      '/ 20',
      'الفرض 12.00 · الاختبار 10.00 · المعدل 11.67',
      'المشاركة في القسم',
      'نقرات المشاركة: 0',
      '3.50 / 4',
      text.marks.componentMarks.nothing,
      '18.00 / 20',
      text.marks.justify.noteBook,
      text.marks.justify.noteReasons,
      '1 من 3',
    ]),
  );
  expect(accessibilityProblems(root())).toEqual([]);
  await press('justify-next');
  expect(texts()).toEqual(expect.arrayContaining(['تلميذة ثانية', '—', 'عناصر بلا نقطة: 6', '— / 4', '2 من 3']));
  expect(root().findAll((node) => node.props.testID === 'justify-parts')).toEqual([]);
  expect(control('justify-next')?.props.disabled).toBe(false);
});

test('one pupil or the whole class prints framed «داخلي · سري», saves, and goes into the log', async () => {
  const data = await marked();
  await mount(data, <MarksJustify courseId="c-1" />);
  await press('justify-next', 'justify-print');
  const [one] = printHtml.mock.calls[0];
  expect(one.match(/<section class="page"/g)).toHaveLength(1);
  expect(one).toContain('تلميذة ثانية');
  expect(one).not.toContain('تلميذة أولى');
  expect(one.match(/داخلي · سري/g)).toHaveLength(2);
  await press('justify-save');
  expect(savePdf).toHaveBeenLastCalledWith(
    expect.any(String),
    `${text.marks.justify.file} 4م1 · اللغة العربية التلميذ 2 الفصل الأول.pdf`,
  );
  await ReactTestRenderer.act(async () => {
    (root().findByProps({ testID: 'justify-scope' }).props as { onSelect: (one: string) => void }).onSelect('all');
    await Promise.resolve();
  });
  expect(texts()).toContain('ورقة لكل تلميذ في القائمة · الأوراق: 3');
  await press('justify-print', 'justify-save');
  const [all] = printHtml.mock.calls[1];
  expect(all.match(/<section class="page"/g)).toHaveLength(3);
  expect(savePdf).toHaveBeenCalledWith(
    expect.any(String),
    `${text.marks.justify.file} 4م1 · اللغة العربية الفصل الأول.pdf`,
  );
  expect(outputs(data)).toEqual([
    ['marks-justify', 'term-1', 'print'],
    ['marks-justify', 'term-1', 'pdf'],
    ['marks-justify', 'term-1', 'print'],
    ['marks-justify', 'term-1', 'pdf'],
  ]);
});

test('primary’s page is the month’s, with no average', async () => {
  const data = await withTest();
  await data.book.recordAll(DAY, [
    primaryClass('k-p', 's-1', '5ap', '5 ابتدائي أ'),
    course('c-p', 'k-p', 'arabic'),
    { kind: 'pupil.set', pupil: { id: 'q-1', classId: 'k-p', name: 'تلميذ أول', sex: 'm', groups: [], movements: [] } },
    mark(component('participation', '2026-10'), 'q-1', 2.5, 3, 'c-p'),
    mark({ kind: 'exam' }, 'q-1', 8, 10, 'c-p'),
  ]);
  await mount(data, <MarksJustify courseId="c-p" />);
  const months = root().findByProps({ testID: 'justify-month' }).props as { selected: string };
  expect(months.selected).toBe('2026-10');
  expect(texts()).toEqual(
    expect.arrayContaining(['5 ابتدائي أ · اللغة العربية · التقويم المستمر · أكتوبر', '2.50 / 3']),
  );
  expect(root().findAll((node) => node.props.testID === 'justify-parts')).toEqual([]);
  expect(texts()).toContain('— / 3');
  await press('justify-save');
  expect(savePdf).toHaveBeenCalledWith(
    expect.any(String),
    `${text.marks.justify.file} 5 ابتدائي أ · اللغة العربية التلميذ 1 أكتوبر.pdf`,
  );
  expect(justifyCourses(context(data), assessmentData(data.profile)!)).toEqual(['c-1', 'c-2', 'c-p']);
});

test('an exam marked absent says so, with no average', async () => {
  const data = await marked();
  await data.book.recordAll(DAY, [mark({ kind: 'exam' }, 'p-1', 'absent', 20)]);
  await mount(data, <MarksJustify courseId="c-1" />);
  expect(texts()).toContain(`الفرض 12.00 · ${text.marks.justify.examAbsent}`);
});

test('a subject with no continuous assessment is not offered', async () => {
  const data = await withTest();
  await data.book.recordAll(parseDay('2026-10-15'), [
    primaryClass('k-p', 's-1', '5ap', '5 ابتدائي أ'),
    course('c-i', 'k-p', 'islamic'),
  ]);
  expect(justifyCourses(context(data), assessmentData(data.profile)!)).not.toContain('c-i');
  await mount(data, <MarksJustify courseId="c-i" />);
  expect(texts()).toContain('تلميذة أولى');
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  await mount(await marked(), <MarksJustify courseId="c-1" />);
  expect(texts().filter((one) => /(marks|documents)\.[a-zA-Z]/.test(one))).toEqual([]);
  await press('justify-print');
  const [html] = printHtml.mock.calls[0];
  expect(html).not.toMatch(/(marks|documents)\.[a-zA-Z]/);
  expect(accessibilityProblems(root())).toEqual([]);
});
