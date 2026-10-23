// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The printed «كشف النقاط» (#240, Gradebook-print, answer 461): a page for
// each class and subject with a grade book in the day's term, by class name,
// framed «داخلي · سري», with the scope, the formula, the release, each pupil's
// cells in two decimals and the class's figures; primary's months as columns;
// the blank version with names and empty cells; the drawn signature in a
// middle-school page's teacher box only, never on a primary or lycée one, a
// blank one or when the teacher chose «فارغة»; names escaped; the term just
// ended between terms (answer 462); and its line, file name and period among
// the documents. Made-up records only.

import { addDays, parseDay, setMark, type MarkTarget, type MarkValue, type Signature } from '@minhajna/core';
import type { TestData } from '../jest/app-data';
import { withTest } from '../jest/marks-class';
import { course, primaryClass } from '../jest/specialist-classes';
import { documentKind, fileName } from '../src/documents/catalogue';
import type { DocumentData } from '../src/documents/document-data';
import { bookTerm, gradeBookPages } from '../src/documents/grade-book-pages';
import { assessmentData, courseMarks } from '../src/marks/marks-rules';
import { i18n } from '../src/text/i18n';

const t = i18n.getFixedT('ar');
const DAY = parseDay('2026-10-15');
const MARK = '<svg class="drawn"';
const signature: Signature = { width: 600, height: 200, path: 'M 10 20 L 300 150' };
const count = (html: string, part: string) => html.split(part).length - 1;

const documentData = (data: TestData, drawn?: boolean): DocumentData => ({
  state: data.book.state,
  profile: data.profile,
  year: data.year,
  calendar: data.calendar,
  calendarRelease: data.calendarRelease,
  packs: data.packs,
  bells: data.bells,
  day: DAY,
  lang: 'ar',
  dir: 'rtl',
  ...(drawn !== undefined && { drawn }),
});

const mark = (courseId: string, target: MarkTarget, pupilId: string, value: MarkValue, max: number) =>
  setMark({ courseId, term: 1, target, pupilId }, value, max);
const POINTS = { participation: 4, quizzes: 3, homework: 3, notebook: 3, attendance: 3, research: 4 } as const;

/** 4م1 with the first pupil at 11.67, and a 5th-grade primary class with one pupil marked in October. */
async function marked(): Promise<TestData> {
  const data = await withTest();
  await data.book.recordAll(DAY, [
    ...Object.entries(POINTS).map(([id, points], index) =>
      mark('c-1', { kind: 'component', componentId: id }, 'p-1', [3.5, 2, 3, 2.5, 3, 4][index], points),
    ),
    mark('c-1', { kind: 'test', testId: 't-1' }, 'p-1', 12, 20),
    mark('c-1', { kind: 'exam' }, 'p-1', 10, 20),
    primaryClass('k-p', 's-1', '5ap', '5 ابتدائي أ'),
    course('c-p', 'k-p', 'arabic'),
    { kind: 'pupil.set', pupil: { id: 'q-1', classId: 'k-p', name: 'تلميذ أول', sex: 'm', groups: [], movements: [] } },
  ]);
  const lines = courseMarks(data.book.state, assessmentData(data.profile)!, 'c-p', 1)?.assessment?.lines ?? [];
  await data.book.recordAll(DAY, [
    ...lines.map((line) =>
      mark('c-p', { kind: 'component', componentId: line.id, month: '2026-10' }, 'q-1', line.points, line.points),
    ),
    mark('c-p', { kind: 'exam' }, 'q-1', 8, 10),
  ]);
  return data;
}

const sections = (html: string) => html.split('<section class="page"').slice(1);

test('a page for each class and subject, framed, with the formula, the cells and the figures', async () => {
  const data = documentData(await marked());
  const release = assessmentData(data.profile)?.release ?? '';
  const pages = sections(gradeBookPages(data, t, false));
  expect(pages.map((page) => /data-book="([^"]*)"/.exec(page)?.[1])).toEqual([
    '4م1 · اللغة العربية',
    '4م2 · اللغة العربية',
    '5 ابتدائي أ · اللغة العربية',
  ]);
  const [first, , primary] = pages;
  expect(count(first, 'داخلي · سري')).toBe(2);
  expect(first).toContain('كشف النقاط والمعدلات');
  expect(first).toContain('القسم: 4م1 · المادة: اللغة العربية · الفصل الأول');
  expect(first).toContain(`المعدل = (معدل التقويم والفرض + 2 × الاختبار) ÷ 3، على 20 · الإصدار ${release}`);
  expect(first).toContain(
    '<th>الرقم</th><th>الاسم واللقب</th><th>التقويم</th><th>الفرض</th><th>الاختبار</th><th>المعدل</th>',
  );
  expect(first).toContain(
    '<td>1</td><td class="name">تلميذة أولى</td><td>18.00</td><td>12.00</td><td>10.00</td><td>11.67</td>',
  );
  expect(first).toContain('<td>2</td><td class="name">تلميذة ثانية</td><td>—</td><td>—</td><td>—</td><td>—</td>');
  expect(first).toContain('معدل القسم 11.67 · أعلى معدل 11.67 · أدنى معدل 11.67 · 10 فما فوق: 1 من 1');
  expect(primary).toContain('<th>أكتوبر</th><th>التقويم</th><th>الاختبار</th><th>المعدل</th>');
  expect(primary).toContain('<td class="name">تلميذ أول</td><td>10.00</td><td>10.00</td><td>8.00</td><td>9.00</td>');
  expect(primary).toContain('على 10');
});

test('the blank version prints the names with empty cells and no figures', async () => {
  const html = gradeBookPages(documentData(await marked()), t, true);
  expect(html).toContain('<td>1</td><td class="name">تلميذة أولى</td><td></td><td></td><td></td><td></td>');
  expect(html).not.toContain('11.67');
  expect(html).not.toContain('معدل القسم');
  expect(count(html, 'داخلي · سري')).toBe(6);
});

test('the drawn signature goes in a middle-school page’s teacher box only', async () => {
  const data = await marked();
  await data.book.record(DAY, { kind: 'teacher.personal.set', personal: { signature, signatureOn: true } });
  const pages = sections(gradeBookPages(documentData(data), t, false));
  expect(pages.map((page) => count(page, MARK))).toEqual([1, 1, 0]);
  expect(count(gradeBookPages(documentData(data), t, true), MARK)).toBe(0);
  expect(count(gradeBookPages(documentData(data, false), t, false), MARK)).toBe(0);
});

test('a lycée page keeps a blank box, and names reach the page escaped', async () => {
  const data = await marked();
  await data.book.recordAll(DAY, [
    { kind: 'teacher.personal.set', personal: { signature, signatureOn: true } },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-l',
        schoolId: 's-1',
        level: 'lycee',
        grade: '1as',
        name: '1 ج م ع',
        groups: [{ id: 'k-l-w', kind: 'whole', name: '1 ج م ع' }],
      },
    },
    course('c-l', 'k-l', 'math'),
    {
      kind: 'pupil.set',
      pupil: { id: 'p-x', classId: 'k-1', name: '<b>A&B</b>', sex: 'f', groups: [], movements: [] },
    },
  ]);
  const pages = sections(gradeBookPages(documentData(data), t, false));
  const lycee = pages.find((page) => page.includes('data-book="1 ج م ع'));
  expect(lycee).toBeDefined();
  expect(count(lycee!, MARK)).toBe(0);
  const html = pages.join('');
  expect(html).toContain('&lt;b&gt;A&amp;B&lt;/b&gt;');
  expect(html).not.toContain('<b>A&B');
});

test('between terms, the term just ended; before the first, the first', async () => {
  const data = documentData(await marked());
  const [first, second] = [...data.year.terms].sort((a, b) => a.number - b.number);
  expect(bookTerm({ ...data, day: addDays(first.to, 1) })).toBe(1);
  expect(bookTerm({ ...data, day: second.from })).toBe(2);
  expect(bookTerm({ ...data, day: addDays(first.from, -3) })).toBe(1);
});

test('one class and subject’s page for another term, from the screen', async () => {
  const html = gradeBookPages(documentData(await marked()), t, false, { courseId: 'c-1', term: 2 });
  expect(sections(html)).toHaveLength(1);
  expect(html).toContain('القسم: 4م1 · المادة: اللغة العربية · الفصل الثاني');
  expect(html).not.toContain('11.67');
});

test('among the documents: its line, file name and period, and none without a grade book', async () => {
  const kind = documentKind('grade-book')!;
  const data = documentData(await marked());
  expect([kind.pupils, kind.landscape, kind.byDay, kind.drawn]).toEqual([true, false, true, 'box']);
  expect(kind.line(data, t)).toBe('3 أقسام · الفصل الأول');
  expect(kind.period(data)).toBe('term-1');
  expect(fileName(kind, data, t, false)).toBe('كشف النقاط الفصل الأول 2026-2027.pdf');
  expect(fileName(kind, data, t, true)).toBe('كشف النقاط الفصل الأول 2026-2027 - فارغة بعناوينها.pdf');
  const none = { ...data, state: { ...data.state, courses: new Map() } };
  expect(kind.empty(none)).toBe(true);
  expect(kind.emptyLine(t)).toBe('لا قسم ولا مادة بكشف نقاط في هذا الفصل.');
});
