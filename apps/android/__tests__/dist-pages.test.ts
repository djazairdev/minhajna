// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The printed distributions (#237, answers 416, 421 to 423): a page for each
// class and subject with a plan, none for one without; the annual one by
// sequence with its months, sessions and confirmed ones; the monthly one by
// teaching week of the chosen day's month; the termly one by sequence within
// the chosen day's term, the next term in a holiday; a period with none; the
// teacher's, director's and inspector's boxes, the drawn signature in the
// teacher's only and never on the blank version, which keeps the heads over
// empty rows; and the document as the output lists it. Made-up records only.

import { confirmSessions, parseDay, sessionsBetween, type Signature } from '@minhajna/core';
import { openTestData, type TestData } from '../jest/app-data';
import { withPrimary } from '../jest/primary-class';
import { withDay } from '../jest/today-day';
import { documentKind, fileName } from '../src/documents/catalogue';
import { daysSpan, distPages, monthsSpan, sequenceName, termOf } from '../src/documents/dist-pages';
import type { DocumentData } from '../src/documents/document-data';
import { printedParts } from '../src/documents/print-html';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';

const t = i18n.getFixedT('ar');
const signature: Signature = { width: 600, height: 200, path: 'M 10 20 L 300 150' };

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

const pagesOf = (data: TestData, layout: string, blank = false, day?: string) =>
  printedParts(distPages(documentData(data, day), t, blank, layout)).pages.map((page) => page.content);

const row = (...cells: string[]) =>
  `<tr>${cells.map((one) => (/^\d+$/.test(one) ? `<td class="n">${one}</td>` : `<td>${one}</td>`)).join('')}</tr>`;

test('prints the annual one by sequence, for each class and subject with a plan only', async () => {
  const data = await withDay();
  const day = parseDay('2026-10-15');
  const context = coreContext({ ...data, state: data.book.state });
  await data.book.recordAll(
    day,
    confirmSessions(
      context,
      sessionsBetween(context, day, day, new Set(['c-1'])).map((session) => ({ session })),
    ),
  );
  const pages = pagesOf(data, 'year');
  expect(pages).toHaveLength(1);
  const [page] = pages as [string];
  expect(page).toContain('<span>متوسطة النجاح</span><span>السنة الدراسية \u20682026-2027\u2069</span>');
  expect(page).toContain('<h1>التوزيع السنوي</h1><p class="scope">\u20684م1\u2069 · اللغة العربية</p>');
  expect(page).toContain('<th>المقطع</th><th>الفترة</th><th>الحصص</th><th>منها المنجزة</th>');
  expect(page).toContain(row('تقويم تشخيصي (مثال)', 'أكتوبر', '2', '2'));
  expect(page).toContain(row('المقطع 1 (مثال)', 'من أكتوبر إلى نوفمبر', '8', '0'));
  expect(page).toContain(row('المقطع 2 (مثال)', 'من نوفمبر إلى جانفي', '8', '0'));
  expect(page).toContain(
    '<tfoot><tr><td>المجموع</td><td class="n"></td><td class="n">18</td><td class="n">2</td></tr>',
  );
  expect(page).toContain(
    '<div class="boxes"><div><b>توقيع الأستاذ</b></div><div><b>تأشيرة المدير</b></div><div><b>تأشيرة المفتش</b></div>',
  );
});

test('prints the chosen day’s month by teaching week, and a month with none', async () => {
  const data = await withDay();
  const [page] = pagesOf(data, 'month') as [string];
  expect(page).toContain('<h1>التوزيع الشهري</h1><p class="scope">\u20684م1\u2069 · اللغة العربية · أكتوبر 2026</p>');
  expect(page).toContain('<th>الأسبوع</th><th>الموارد</th><th>الحصص</th>');
  expect(page).toContain(row('15 أكتوبر 2026', 'تقويم تشخيصي (مثال)', '2'));
  expect(page).toContain(row('22 أكتوبر 2026', 'الوضعية المشكلة الانطلاقية 1 (مثال)<br>فهم المنطوق 1 (مثال)', '2'));
  expect(page).toContain('<td>المجموع</td><td class="n"></td><td class="n">4</td>');
  const [none] = pagesOf(data, 'month', false, '2027-05-10') as [string];
  expect(none).toContain('<td class="none" colspan="3">لا حصة من المخطط في هذه الفترة.</td>');
  expect(none).toContain('<td class="n">0</td>');
});

test('prints the chosen day’s term by sequence, and the next term in a holiday', async () => {
  const data = await withDay();
  const [page] = pagesOf(data, 'term') as [string];
  expect(page).toContain('<h1>التوزيع الفصلي</h1>');
  expect(page).toContain('· الفصل الأول: من 21 سبتمبر 2026 إلى 17 ديسمبر 2026</p>');
  expect(page).toContain(row('تقويم تشخيصي (مثال)', '15 أكتوبر 2026', '2', '0'));
  expect(page).toContain(row('المقطع 2 (مثال)', 'من 26 نوفمبر 2026 إلى 17 ديسمبر 2026', '6', '0'));
  expect(page).toContain('<td class="n">16</td>');
  expect(termOf(documentData(data), parseDay('2026-12-25'))?.number).toBe(2);
  expect(termOf(documentData(data), parseDay('2027-07-15'))?.number).toBe(3);
  const [winter] = pagesOf(data, 'term', false, '2026-12-25') as [string];
  expect(winter).toContain('· الفصل الثاني: من ');
  expect(winter).not.toContain('المقطع 1 (مثال)');
});

test('carries the drawn signature in the teacher’s box, and the blank version none, over empty rows', async () => {
  const data = await withDay();
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'teacher.personal.set',
    personal: { signature, signatureOn: true },
  });
  const [page] = pagesOf(data, 'year') as [string];
  expect(page).toContain('<div><b>توقيع الأستاذ</b><svg class="drawn"');
  expect(page.split('<svg class="drawn"')).toHaveLength(2);
  const [blank] = pagesOf(data, 'year', true) as [string];
  expect(blank).not.toContain('<svg');
  expect(blank).not.toContain('المقطع 1 (مثال)');
  expect(blank).toContain('<p class="scope">\u20684م1\u2069 · اللغة العربية</p>');
  expect(blank.match(/<tr><td><\/td><td><\/td><td><\/td><td><\/td><\/tr>/g)).toHaveLength(12);
  const [month] = pagesOf(data, 'month', true) as [string];
  expect(month.match(/<tr><td><\/td><td><\/td><td><\/td><\/tr>/g)).toHaveLength(5);
});

test('words periods and plan weeks', async () => {
  const data = documentData(await withDay());
  expect(monthsSpan(data, t, parseDay('2026-09-21'), parseDay('2026-09-30'))).toBe('سبتمبر');
  expect(monthsSpan(data, t, parseDay('2026-12-01'), parseDay('2027-02-04'))).toBe('من ديسمبر إلى فيفري');
  expect(daysSpan(data, t, parseDay('2026-10-04'), parseDay('2026-10-08'))).toBe('من 4 إلى 8 أكتوبر 2026');
  expect(daysSpan(data, t, parseDay('2026-09-28'), parseDay('2026-10-01'))).toBe('من 28 سبتمبر 2026 إلى 1 أكتوبر 2026');
  expect(sequenceName(t, { title: '', week: 3 })).toBe('الأسبوع 3');
  expect(sequenceName(t, { title: 'المقطع 1' })).toBe('المقطع 1');
});

test('is a document of a day with three layouts, the teacher’s box taking the drawn signature', async () => {
  const data = await withDay();
  const kind = documentKind('distributions');
  expect(kind).toMatchObject({ byDay: true, landscape: false, pupils: false, drawn: 'box' });
  expect(kind?.layouts?.(t).map((one) => one.label)).toEqual(['السنوي', 'الشهري', 'الفصلي']);
  expect(kind?.line(documentData(data), t)).toBe('قسم واحد · السنوي والشهري والفصلي');
  expect(kind?.empty(documentData(data))).toBe(false);
  expect(fileName(kind!, documentData(data), t, false, 'term')).toBe('التوزيعات 2026-10-22 - الفصلي.pdf');
  const none = await openTestData();
  expect(kind?.empty(documentData(none))).toBe(true);
  expect(printedParts(distPages(documentData(none), t, false)).pages.map((page) => page.content)).toEqual([
    '<p class="none">لا قسم له مخطط في هذه السنة بعد، فلا توزيع للطباعة.</p>',
  ]);
  const en = printedParts(distPages(documentData(data, '2026-10-22', 'en'), i18n.getFixedT('en'), false, 'month'));
  expect(en.dir).toBe('ltr');
  expect(en.pages[0]?.content).toMatch(/^<div class="latin">/);
  expect(en.pages[0]?.content).toContain('<h1>Monthly distribution</h1>');
});

test('counts a session that covers two sequences in each row, and once in the total', async () => {
  const data = await withDay();
  const day = parseDay('2026-10-15');
  const context = coreContext({ ...data, state: data.book.state });
  const [first] = sessionsBetween(context, day, day, new Set(['c-1']));
  await data.book.recordAll(
    day,
    confirmSessions(context, [{ session: first, choice: { outcome: 'merged', with: 'u1-1' } }]),
  );
  const [page] = pagesOf(data, 'year') as [string];
  expect(page).toContain(row('تقويم تشخيصي (مثال)', 'أكتوبر', '1', '1'));
  expect(page).toMatch(
    /<tr><td>المقطع 1 \(مثال\)<\/td><td>من أكتوبر إلى [^<]+<\/td><td class="n">(\d+)<\/td><td class="n">1<\/td>/,
  );
  const rows = [...page.matchAll(/<tbody>.*<\/tbody>/g)][0][0];
  const sum = [...rows.matchAll(/<td class="n">(\d+)<\/td><td class="n">\d+<\/td><\/tr>/g)].reduce(
    (total, one) => total + Number(one[1]),
    0,
  );
  const total = Number(/<tfoot><tr><td>المجموع<\/td><td class="n"><\/td><td class="n">(\d+)</.exec(page)![1]);
  expect(sum).toBe(total + 1);
});

test('escapes what the teacher named, and heads a plan by weeks by its weeks', async () => {
  const data = await withDay();
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'school.set',
    school: { id: 's-1', name: '<متوسطة> & النجاح', levels: ['cem'], subjects: ['arabic'], zone: '16' },
  });
  const [page] = pagesOf(data, 'year') as [string];
  expect(page).toContain('<span>&lt;متوسطة&gt; &amp; النجاح</span>');
  const primary = await withPrimary();
  const [weeks] = printedParts(distPages(documentData(primary), t, false, 'year')).pages.map((one) => one.content);
  expect(weeks).toContain('<th>الأسبوع</th><th>الفترة</th>');
  expect(weeks).toMatch(/<tr><td>الأسبوع \d+<\/td>/);
  expect(weeks).not.toContain('<th>المقطع</th>');
});

test('words the term line in English and French', async () => {
  const data = await withDay();
  const en = printedParts(distPages(documentData(data, '2026-10-22', 'en'), i18n.getFixedT('en'), false, 'term'));
  expect(en.pages[0]?.content).toContain('· Term 1: 21 September 2026 to 17 December 2026</p>');
  const fr = i18n.getFixedT('fr');
  expect(fr('distributions.termLine', { term: 'Trimestre 1', days: 'du 21 au 30 septembre 2026' })).toBe(
    'Trimestre 1 : du 21 au 30 septembre 2026',
  );
});
