// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The texts book's subject pages (#213): a confirmed session prints as the
// book takes it, one awaiting confirmation never does; the head in Arabic
// over columns in the subject's language and direction; the year's pages
// numbered on from month to month; Ramadan's time; rows kept whole on a
// page; the blank version, and a month with nothing confirmed. Made-up
// records only.

import { confirmSessions, parseDay, todayView, type Day } from '@minhajna/core';
import type { TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { documentKind, fileName } from '../src/documents/catalogue';
import type { DocumentData } from '../src/documents/document-data';
import { directionOf, subjectLanguage, textsBookPages } from '../src/documents/texts-book-pages';
import { textsBookPage } from '../src/documents/texts-book-html';
import { PAGE_RULES, bookDate, paginate, rowRules } from '../src/documents/texts-book-rows';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';

const t = i18n.getFixedT('ar');

const documentData = (data: TestData, day = '2026-10-15'): DocumentData => ({
  state: data.book.state,
  profile: data.profile,
  year: data.year,
  calendar: data.calendar,
  packs: data.packs,
  bells: data.bells,
  day: parseDay(day),
  lang: 'ar',
  dir: 'rtl',
});

async function withFirstConfirmed() {
  const data = await withDay();
  const day = parseDay('2026-10-15');
  await data.book.record(day, {
    kind: 'course.set',
    course: { id: 'c-3', classId: 'k-1', subject: 'french', year: '2026-2027', pack: null },
  });
  const context = coreContext({ ...data, state: data.book.state });
  const [first] = todayView(context, day).sessions;
  if (first === undefined) throw new Error('No session');
  await data.book.recordAll(day, confirmSessions(context, [{ session: first.session }]));
  return data;
}

const entries = (html: string) => html.match(/<tr class="entry">/g)?.length ?? 0;

test('prints a confirmed session as the book takes it, under an Arabic head, and never one awaiting confirmation', async () => {
  const data = await withFirstConfirmed();
  const html = textsBookPages(documentData(data), t, false);
  expect(html).toContain('دفتر النصوص · الصفحة 1');
  expect(html).toContain('المادة: اللغة العربية');
  expect(html).toContain('2026/10/15');
  expect(html).toContain('08:00 – 09:00');
  expect(entries(html)).toBe(1);
  expect(html.match(/<tr class="rule">/g)).toHaveLength(PAGE_RULES - 2);
  expect(html).toContain('<th>الموضوع أو العمل المطلوب إنجازه</th>');
  expect(html).not.toContain('Émargement');
  expect(html).not.toMatch(/<script|https?:/);
});

test('the blank version gives each class and subject a page, the French one left to right', async () => {
  const data = await withFirstConfirmed();
  const html = textsBookPages(documentData(data), t, true);
  expect(html.match(/<section class="page">/g)).toHaveLength(3);
  expect(entries(html)).toBe(0);
  expect(html).toContain('دفتر النصوص · الصفحة .........');
  expect(html).toContain('المادة: اللغة الفرنسية');
  expect(html).toContain('<table class="book latin" lang="fr" dir="ltr">');
  expect(html).toContain('<th>Émargement</th>');
  expect(html).toMatch(/Cahier de textes · .*4م1.* · Langue française · octobre 2026/);
});

test("a German subject keeps the book's words and direction, its own text running left to right", async () => {
  const data = await withFirstConfirmed();
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'course.set',
    course: { id: 'c-4', classId: 'k-1', subject: 'german', year: '2026-2027', pack: null },
  });
  const blank = textsBookPages(documentData(data), t, true);
  expect(blank).toContain('المادة: اللغة الألمانية');
  expect(blank.match(/<table class="book" lang="ar" dir="rtl">/g)).toHaveLength(3);
  const page = textsBookPage({
    head: { lang: 'ar', school: 'متوسطة', year: '2026-2027', className: '4م1', subject: 'الألمانية', title: '1' },
    lang: 'ar',
    textLang: 'de',
    dir: 'rtl',
    caption: '',
    columns: ['التاريخ', 'التوقيت', 'الموضوع', 'التوقيع'],
    rows: [
      { day: '2026-10-15' as Day, date: '2026/10/15', time: '', lines: [{ label: 'الموضوع', text: 'Der Konjunktiv' }] },
    ],
    used: 1,
  });
  expect(page).toContain('<b>الموضوع:</b> <bdi dir="auto">Der Konjunktiv</bdi>');
});

test('a month with nothing confirmed says so for each class and subject', async () => {
  const data = await withFirstConfirmed();
  const html = textsBookPages(documentData(data, '2026-11-15'), t, false);
  expect(html.match(/<section class="page">/g)).toHaveLength(3);
  expect(html).toContain('لا حصة مؤكَّدة في هذا الشهر بعد.');
  expect(html).toContain('Aucune séance confirmée ce mois-ci.');
});

test('the next month numbers its pages on from the month before', async () => {
  const data = await withFirstConfirmed();
  const day = parseDay('2026-11-12');
  const context = coreContext({ ...data, state: data.book.state });
  const [first] = todayView(context, day).sessions;
  if (first === undefined) throw new Error('No session');
  await data.book.recordAll(day, confirmSessions(context, [{ session: first.session }]));
  const html = textsBookPages(documentData(data, '2026-11-15'), t, false);
  expect(html).toContain('دفتر النصوص · الصفحة 2');
  expect(html).toContain('2026/11/12');
});

test("a session in Ramadan prints Ramadan's shorter time", async () => {
  const data = await withFirstConfirmed();
  const day = parseDay('2027-02-11');
  const context = coreContext({ ...data, state: data.book.state });
  const [first] = todayView(context, day).sessions;
  if (first === undefined) throw new Error('No session');
  await data.book.recordAll(day, confirmSessions(context, [{ session: first.session }]));
  const html = textsBookPages(documentData(data, '2027-02-15'), t, false);
  expect(html).toContain('2027/02/11');
  expect(html).toContain('08:00 – 08:45');
  expect(html).toContain('دفتر النصوص · الصفحة 2');
});

test('rows fill a page of rules and are never cut', () => {
  const short = { lines: [{ text: 'درس' }] };
  const long = { lines: [{ label: 'الموضوع', text: 'ب'.repeat(100) }, { text: '- مرحلة' }] };
  expect(rowRules(short, 'rtl')).toBe(1);
  expect(rowRules(long, 'rtl')).toBe(5);
  expect(rowRules({ lines: [{ text: Array.from({ length: 7 }, () => 'abcdefghijkl').join(' ') }] }, 'ltr')).toBe(3);
  const pages = paginate([...Array.from({ length: PAGE_RULES - 2 }, () => short), long, short], 'rtl');
  expect(pages.map((page) => page.length)).toEqual([PAGE_RULES - 2, 2]);
});

test('dates as the book writes them, and each subject in its language and direction', async () => {
  const data = await withDay();
  expect(bookDate('2026-10-01' as Day, 'rtl')).toBe('2026/10/01');
  expect(bookDate('2026-10-01' as Day, 'ltr')).toBe('01/10/2026');
  expect(subjectLanguage(data.profile, 'math', 'fr')).toBe('ar');
  expect(subjectLanguage(data.profile, 'english', 'ar')).toBe('en');
  expect(subjectLanguage({ ...data.profile, subjects: [] }, 'german', 'fr')).toBe('ar');
  expect([directionOf('ar'), directionOf('fr'), directionOf('de')]).toEqual(['rtl', 'ltr', 'ltr']);
});

test('the Documents tab lists it, and a saved file is named for the month', async () => {
  const data = await withFirstConfirmed();
  const kind = documentKind('texts');
  expect(kind?.title(t)).toBe('دفتر النصوص');
  expect(kind && fileName(kind, documentData(data), t, false)).toBe('دفتر النصوص 2026-10.pdf');
  expect(kind?.pupils).toBe(false);
  expect(kind?.empty({ ...documentData(data), year: { ...data.year, id: '2027-2028' } })).toBe(true);
});
