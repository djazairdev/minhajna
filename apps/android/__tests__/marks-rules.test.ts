// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the Marks screens say (#238): the bundled presets read once and a
// refused file leaving nothing; each course's line for the Class page and
// its formula in words, for middle school, primary languages, a primary
// subject with the exam alone and one with neither; a saved setup said as
// the teacher's own; each line's caption and name; the total's hint in
// Arabic's plural forms; saved points brought back into their range; and
// French's term in lower case inside a sentence. Made-up records only.

import { parseDay, setupOf, type SetupLine } from '@minhajna/core';
import bundled from '@minhajna/data/dz/assessment.json';
import { course, primaryClass } from '../jest/specialist-classes';
import { withDay } from '../jest/today-day';
import {
  assessmentData,
  captionOf,
  courseMarks,
  formulaText,
  inRange,
  lineName,
  marksLine,
  totalHint,
} from '../src/marks/marks-rules';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';

const t = i18n.getFixedT('ar');

async function withSubjects() {
  const data = await withDay();
  await data.book.recordAll(parseDay('2026-10-15'), [
    primaryClass('p-1', 's-1', '5ap', '5 ابتدائي أ'),
    course('p-arabic', 'p-1', 'arabic'),
    course('p-islamic', 'p-1', 'islamic'),
    course('p-music', 'p-1', 'music'),
  ]);
  return data;
}

test('the bundled presets are read once, and a refused file leaves nothing', async () => {
  const { profile } = await withDay();
  const data = assessmentData(profile);
  expect(data?.release).toBe('2026.1');
  expect(assessmentData(profile)).toBe(data);
  expect(assessmentData(profile, { ...bundled, format: 2 })).toBeNull();
});

test('each course’s line and formula, by its level and subject', async () => {
  const { book, profile } = await withSubjects();
  const data = assessmentData(profile)!;
  const said = (courseId: string, term: number) => [
    marksLine(t, book.state, profile, courseId, term),
    formulaText(t, courseMarks(book.state, data, courseId, term)?.formula),
  ];
  expect(said('c-1', 1)).toEqual(['الفصل الأول · 6 عناصر على 20 · الإعداد الرسمي', text.marks.formula.cem]);
  expect(said('p-arabic', 2)).toEqual([
    'الفصل الثاني · 4 عناصر على 10 · الإعداد الرسمي',
    text.marks.formula.primaryExamined,
  ]);
  expect(said('p-islamic', 1)).toEqual([`الفصل الأول · ${text.marks.noAssessment}`, text.marks.formula.examOnly]);
  expect(said('p-music', 3)).toEqual(['الفصل الثالث · 3 عناصر على 10 · الإعداد الرسمي', text.marks.formula.none]);
  expect(courseMarks(book.state, data, 'nobody', 1)).toBeNull();
});

test('a saved setup is the teacher’s own from its term on', async () => {
  const { book, profile } = await withDay();
  const data = assessmentData(profile)!;
  const lines = courseMarks(book.state, data, 'c-1', 1)!.assessment!.lines;
  await book.record(parseDay('2026-10-15'), {
    kind: 'assessment.set',
    setup: setupOf('c-1', 1, data.release, lines, false),
  });
  expect(marksLine(t, book.state, profile, 'c-1', 2)).toBe('الفصل الثاني · 6 عناصر على 20 · إعدادك منذ الفصل الأول');
});

test('each line says how its marks are gathered, and its name', async () => {
  const { book, profile } = await withDay();
  const lines = courseMarks(book.state, assessmentData(profile)!, 'c-1', 1)!.assessment!.lines;
  const column: SetupLine = { kind: 'column', id: 'col-1', name: 'عروض شفهية', points: 2, min: 1, max: 10 };
  expect([...lines, column].map((line) => [lineName(line), captionOf(t, line, true)])).toEqual([
    ['المشاركة في القسم', text.marks.capture.session],
    ['الاستجوابات الشفهية والكتابية', text.marks.capture.session],
    ['الواجبات المنزلية', text.marks.capture.homework],
    ['الكراس', text.marks.capture.periodic],
    ['الانضباط والمواظبة', text.marks.capture.rollCall],
    ['البحوث والمشاريع', text.marks.capture.manual],
    ['عروض شفهية', text.marks.capture.column],
  ]);
  expect(captionOf(t, lines[4], false)).toBe(text.marks.capture.manual);
});

test('the total’s hint counts the points left or over, and saved points come back into range', () => {
  expect([19, 18, 17, 9, 21, 22].map((total) => totalHint(t, 20, total))).toEqual([
    'يُحفظ الإعداد حين يبلغ المجموع 20: تبقى نقطة واحدة للتوزيع.',
    'يُحفظ الإعداد حين يبلغ المجموع 20: تبقى نقطتان للتوزيع.',
    'يُحفظ الإعداد حين يبلغ المجموع 20: تبقى 3 نقاط للتوزيع.',
    'يُحفظ الإعداد حين يبلغ المجموع 20: تبقى 11 نقطة للتوزيع.',
    'يُحفظ الإعداد حين يبلغ المجموع 20: تُنقَص نقطة واحدة.',
    'يُحفظ الإعداد حين يبلغ المجموع 20: تُنقَص نقطتان.',
  ]);
  expect(totalHint(t, 10, 10)).toBeNull();
  const line = (points: number): SetupLine => ({ kind: 'column', id: 'c', name: 'م', points, min: 2, max: 6 });
  expect(inRange([line(1), line(4), line(9)]).map((one) => one.points)).toEqual([2, 4, 6]);
});

test('French says the term in lower case inside a sentence', async () => {
  const { book, profile } = await withDay();
  const data = assessmentData(profile)!;
  const lines = courseMarks(book.state, data, 'c-1', 1)!.assessment!.lines;
  await book.record(parseDay('2026-10-15'), {
    kind: 'assessment.set',
    setup: setupOf('c-1', 2, data.release, lines, false),
  });
  const fr = i18n.getFixedT('fr');
  expect(marksLine(fr, book.state, profile, 'c-1', 3)).toBe(
    'Trimestre 3 · 6 éléments sur 20 · Votre réglage depuis le trimestre 2',
  );
});
