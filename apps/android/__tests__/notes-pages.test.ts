// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The printed lesson notes (#237, answers 416 and 420): one page for each of a
// day's sessions that has a lesson, a lesson over two sessions on each, with
// the note's number once kept, the class, subject, day and time, the head from
// the plan, the kept paragraphs in ink, the grey ones and blank own ones as
// titles over lines, and a blank visa box with no drawn signature; the blank
// version; a day with none; the document as the output screen lists it, and
// «طباعة الأسبوع» without it. Made-up schools and notes.

import { parseDay, type RecordEvent } from '@minhajna/core';
import { openTestData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { DOCUMENTS, documentKind, fileName } from '../src/documents/catalogue';
import type { DocumentData } from '../src/documents/document-data';
import { printedParts } from '../src/documents/print-html';
import { notesPages } from '../src/documents/notes-pages';
import { weekEntries } from '../src/documents/print-week';
import { i18n } from '../src/text/i18n';

const t = i18n.getFixedT('ar');

const documentData = (data: TestData, day = '2026-10-22', lang: 'ar' | 'en' = 'ar'): DocumentData => ({
  state: data.book.state,
  profile: data.profile,
  year: data.year,
  calendar: data.calendar,
  calendarRelease: data.calendarRelease,
  packs: data.packs,
  bells: data.bells,
  day: parseDay(day),
  lang,
  dir: lang === 'ar' ? 'rtl' : 'ltr',
});

const kept: RecordEvent = {
  kind: 'lesson-note.set',
  note: {
    id: 'n-1',
    courseId: 'c-1',
    itemId: 'u1-2',
    number: 4,
    paragraphs: [
      { key: 'objectives', text: 'يفهم <النص> المنطوق' },
      { key: 'stage-2', text: 'قراءة نموذجية\nثم قراءات فردية' },
      { title: 'الواجب', text: 'التمرين 3' },
      { title: '<ملاحظة>', text: ' ' },
    ],
  },
};

const pagesOf = (html: string) => printedParts(html).pages.map((page) => page.content);

test('prints a page for each session with a lesson, kept paragraphs in ink and grey ones over lines', async () => {
  const data = await withDay();
  await data.book.record(parseDay('2026-10-15'), kept);
  const html = notesPages(documentData(data), t, false);
  const pages = pagesOf(html);
  expect(pages).toHaveLength(2);
  const [first, second] = pages as [string, string];
  expect(first).toContain('<h1>المذكرة</h1>');
  expect(first).toContain('الوضعية المشكلة الانطلاقية 1 (مثال)');
  expect(second).toContain('<h1>المذكرة 4</h1>');
  expect(second).toContain('\u20684م1\u2069 · اللغة العربية · الخميس');
  expect(second).toContain('<td><b>المقطع: </b>المقطع 1 (مثال)</td>');
  expect(second).toContain('<td><b>المدة: </b>60 د</td>');
  expect(second).toContain('<h2>الأهداف</h2><p>يفهم &lt;النص&gt; المنطوق</p>');
  expect(second).toContain('<h2>بناء</h2><p>قراءة نموذجية\nثم قراءات فردية</p>');
  expect(second).toContain('<h2>مؤشر الكفاءة</h2><div class="pen"><i></i><i></i><i></i></div>');
  expect(second).toContain('<h2>الواجب</h2><p>التمرين 3</p>');
  expect(second.indexOf('<h2>تقويم</h2>')).toBeLessThan(second.indexOf('<h2>الواجب</h2>'));
  expect(second).toContain('<h2>&lt;ملاحظة&gt;</h2><div class="pen">');
  expect(second).toContain('<div class="visa"><b>تأشيرة المدير أو المفتش</b></div>');
  expect(html).not.toMatch(/<img|<svg/);
  expect(printedParts(html).dir).toBe('rtl');
});

test('prints a lesson over two sessions on each, and leaves «طباعة الأسبوع» without the notes', async () => {
  const data = await withDay();
  const pages = pagesOf(notesPages(documentData(data, '2026-10-15'), t, false));
  expect(pages).toHaveLength(2);
  expect(pages.every((page) => page.includes('<td><b>المورد: </b>تقويم تشخيصي (مثال)</td>'))).toBe(true);
  expect(pages[0]).toContain('08سا – 09سا');
  expect(pages[1]).toContain('09سا – 10سا');
  expect(weekEntries(documentData(data)).map((entry) => entry.kind.id)).not.toContain('notes');
});

test('prints the blank version with each head and every title over lines', async () => {
  const data = await withDay();
  await data.book.record(parseDay('2026-10-15'), kept);
  const [, second] = pagesOf(notesPages(documentData(data), t, true)) as [string, string];
  expect(second).toContain('<h1>المذكرة</h1>');
  expect(second).toContain('<td><b>المورد: </b>فهم المنطوق 1 (مثال)</td>');
  expect(second).not.toContain('قراءة نموذجية');
  expect(second).not.toContain('الواجب');
  expect(second.match(/<div class="pen">/g)).toHaveLength(7);
});

test('says when no session of the day has a lesson, and prints in English left to right', async () => {
  const data = await withDay();
  expect(pagesOf(notesPages(documentData(data, '2026-10-16'), t, false))).toEqual([
    '<p class="none">لا حصة لها درس من المخطط في هذا اليوم.</p>',
  ]);
  const en = notesPages(documentData(data, '2026-10-22', 'en'), i18n.getFixedT('en'), false);
  expect(printedParts(en).dir).toBe('ltr');
  expect(pagesOf(en)[1]).toMatch(/^<div class="latin"><h1>Lesson note<\/h1>/);
  expect(pagesOf(en)[1]).toContain('<h2>Competence indicator</h2>');
});

test('is a document of a day that the output opens, listed in the tab by its own row', async () => {
  const data = await withDay();
  const kind = documentKind('notes');
  expect(kind).toMatchObject({ byDay: true, landscape: false, pupils: false });
  expect(kind?.drawn).toBeUndefined();
  expect(kind?.shown?.(documentData(data))).toBe(false);
  expect(kind?.empty(documentData(data))).toBe(false);
  expect(DOCUMENTS.filter((one) => one.id === 'notes')).toHaveLength(1);
  expect(kind?.line(documentData(data), t)).toBe('الخميس 22 أكتوبر 2026');
  expect(kind?.signatureLine(t)).toContain('لا خانة للأستاذ في المذكرة');
  expect(fileName(kind!, documentData(data), t, false)).toBe('المذكرات 2026-10-22.pdf');
  expect(kind?.empty(documentData(await openTestData()))).toBe(true);
});
