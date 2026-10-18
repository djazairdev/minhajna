// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The CEM and lycée journal's front pages (#216, Journal-front, R-3.8-12):
// the teacher's card from setup and this school year's courses; the
// teacher's own and the school's events, those still to come in grey, and
// none of another school's; the national days off with their confidence;
// and the blank version with its labels and heads only. Made-up records only.

import { parseDay, type CalendarEntry } from '@minhajna/core';
import { withDay } from '../jest/today-day';
import type { TestData } from '../jest/app-data';
import { documentKind, fileName } from '../src/documents/catalogue';
import type { DocumentData } from '../src/documents/document-data';
import { FRONT_RULES } from '../src/documents/journal-front-html';
import { journalFrontPages } from '../src/documents/journal-front-pages';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';

const t = i18n.getFixedT('ar');
const front = text.documents.journalFront;

const entry = (id: string, fields: Partial<CalendarEntry>): CalendarEntry => ({
  id,
  layer: 'teacher',
  from: parseDay('2026-10-14'),
  to: parseDay('2026-10-14'),
  effect: 'marker',
  name: { ar: 'ندوة' },
  source: 'المعلم',
  confidence: 'announced',
  ...fields,
});

async function withCard(): Promise<TestData> {
  const data = await withDay();
  await data.book.recordAll(parseDay('2026-10-15'), [
    { kind: 'teacher.set', card: { rank: 'أستاذ التعليم المتوسط' } },
    { kind: 'teacher.personal.set', personal: { name: 'بن يحيى سعاد' } },
    {
      kind: 'calendar.set',
      entry: entry('t-1', { name: { ar: 'ندوة مادة اللغة العربية' } }),
    },
    {
      kind: 'calendar.set',
      entry: entry('s-1', {
        layer: 'school',
        schoolId: 's-1',
        from: parseDay('2026-12-15'),
        to: parseDay('2026-12-15'),
        name: { ar: 'مجلس القسم 4م2' },
      }),
    },
    {
      kind: 'calendar.set',
      entry: entry('s-2', { layer: 'school', schoolId: 's-9', name: { ar: 'اجتماع مؤسسة أخرى' } }),
    },
  ]);
  return data;
}

const documentData = (data: TestData): DocumentData => ({
  state: data.book.state,
  profile: data.profile,
  year: data.year,
  calendar: data.calendar,
  packs: data.packs,
  bells: data.bells,
  day: parseDay('2026-10-15'),
  lang: 'ar',
  dir: 'rtl',
});

const rows = (html: string) => html.match(/<tr[ >]/g)?.length ?? 0;

test('the card gives the name, the rank, the subject, the school, the year and the classes', async () => {
  const html = journalFrontPages(documentData(await withCard()), t, false);
  for (const value of [
    'بن يحيى سعاد',
    'أستاذ التعليم المتوسط',
    'اللغة العربية',
    'متوسطة النجاح',
    '2026-2027',
    '\u20684م1\u2069 · \u20684م2\u2069',
  ]) {
    expect(html).toContain(value);
  }
  expect(html).toContain(front.card);
  expect(html).toContain(text.documents.director);
  expect(html.match(/<section class="page">/g)).toHaveLength(3);
});

test('the events are the teacher’s own and the school’s, in order, those still to come in grey', async () => {
  const html = journalFrontPages(documentData(await withCard()), t, false);
  const seminar = html.indexOf('ندوة مادة اللغة العربية');
  const council = html.indexOf('مجلس القسم 4م2 · متوسطة النجاح');
  expect(seminar).toBeGreaterThan(0);
  expect(council).toBeGreaterThan(seminar);
  expect(html).not.toContain('اجتماع مؤسسة أخرى');
  expect(html).toMatch(/<tr class="later"><td class="d"><bdi>15\/12\/2026<\/bdi>/);
  expect(html).toMatch(/<tr><td class="d"><bdi>14\/10\/2026<\/bdi>/);
});

test('the days off of the year print with their confidence; exam windows and Ramadan do not', async () => {
  const html = journalFrontPages(documentData(await withCard()), t, false);
  expect(html).toContain('عيد الثورة');
  expect(html).toContain('\u206718/12/2026 – 02/01/2027\u2069');
  expect(html).toContain(
    `عيد الفطر</td><td class="d"><bdi>\u206709/03/2027 – 11/03/2027\u2069</bdi></td><td>${front.confidences.expected}`,
  );
  expect(html).not.toContain('اختبارات الفصل الأول');
  expect(html).not.toContain('شهر رمضان');
  expect(html).toContain(front.holidaysNote);
  const fr = journalFrontPages(
    { ...documentData(await withCard()), lang: 'fr', dir: 'ltr' },
    i18n.getFixedT('fr'),
    false,
  );
  expect(fr).toContain('\u206618/12/2026 – 02/01/2027\u2069');
});

test('the blank version keeps the labels and the heads, and leaves the rest for the pen', async () => {
  const html = journalFrontPages(documentData(await withCard()), t, true);
  expect(html).toContain(front.teacherName);
  expect(html).not.toContain('بن يحيى سعاد');
  expect(html).not.toContain('ندوة مادة اللغة العربية');
  expect(html).not.toContain('عيد الثورة');
  expect(html).toContain('2026-2027');
  expect(rows(html)).toBe(6 + 2 * (FRONT_RULES + 1));
});

test('a teacher with no name or rank gets them blank; the document is named after the year', async () => {
  const data = await withDay();
  const html = journalFrontPages(documentData(data), t, false);
  expect(html).toContain(`<th>${front.teacherName}</th><td><bdi dir="rtl"></bdi></td>`);
  const kind = documentKind('journal-front')!;
  expect(fileName(kind, documentData(data), t, false)).toBe(`${text.documents.journal} · ${front.name} 2026-2027.pdf`);
});

test('each school’s event prints; one for a grade taught and one across the year print; long rows take more rules', async () => {
  const data = await withDay();
  const long = 'ندوة تكوينية حول المقاربة بالكفاءات في تدريس اللغة العربية للسنة الرابعة متوسط';
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'school.set',
      school: { id: 's-2', name: 'متوسطة الأمل', levels: ['cem'], subjects: ['arabic'], zone: '16' },
    },
    { kind: 'calendar.set', entry: entry('a', { layer: 'school', schoolId: 's-1', name: { ar: 'مجلس الأساتذة' } }) },
    { kind: 'calendar.set', entry: entry('b', { layer: 'school', schoolId: 's-2', name: { ar: 'مجلس الأساتذة' } }) },
    {
      kind: 'calendar.set',
      entry: entry('c', { layer: 'school', schoolId: 's-1', grades: ['4am'], name: { ar: 'مجلس أقسام الرابعة' } }),
    },
    {
      kind: 'calendar.set',
      entry: entry('d', { from: parseDay('2026-08-01'), to: parseDay('2027-08-01'), name: { ar: 'تكوين سنوي' } }),
    },
    { kind: 'calendar.set', entry: entry('e', { name: { ar: long } }) },
  ]);
  const html = journalFrontPages(documentData(data), t, false);
  expect(html).toContain('مجلس الأساتذة · متوسطة النجاح');
  expect(html).toContain('مجلس الأساتذة · متوسطة الأمل');
  expect(html).toContain('مجلس أقسام الرابعة');
  expect(html).toContain('تكوين سنوي');
  const events = html.slice(html.indexOf(front.events), html.indexOf(front.holidays));
  expect(rows(events)).toBe(1 + FRONT_RULES - 1);
  expect(html).toContain(`<bdi dir="rtl">⁨4م1⁩ · ⁨4م2⁩</bdi>`);
});

test('an event for a joint class’s second level prints', async () => {
  const data = await withDay();
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-3',
        schoolId: 's-1',
        level: 'cem',
        grade: '2am',
        name: '2م3',
        groups: [
          { id: 'k-3-w', kind: 'whole', name: '2م3' },
          { id: 'k-3-2', kind: 'level', name: '2م', grade: '2am' },
          { id: 'k-3-3', kind: 'level', name: '3م', grade: '3am' },
        ],
      },
    },
    { kind: 'course.set', course: { id: 'c-3', classId: 'k-3', subject: 'arabic', year: '2026-2027', pack: null } },
    {
      kind: 'calendar.set',
      entry: entry('g', { layer: 'school', schoolId: 's-1', grades: ['3am'], name: { ar: 'مجلس أقسام الثالثة' } }),
    },
  ]);
  expect(journalFrontPages(documentData(data), t, false)).toContain('مجلس أقسام الثالثة');
});
