// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The texts book's page 08 (#213): sessions outside the timetable and those
// of a support day, numbered through the year for each class, with their
// subject, kind, date and time as the book writes them; the page blank when
// a class has none, and in the blank version; pages by the rules their rows
// take; and its entry in the Documents tab. Made-up records only.

import { addSessionsDay, followedEntries, parseDay, type ExtraSession } from '@minhajna/core';
import type { TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { documentKind, fileName } from '../src/documents/catalogue';
import type { DocumentData } from '../src/documents/document-data';
import { SUPERVISED_RULES, supervisedPages } from '../src/documents/supervised-pages';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';

const t = i18n.getFixedT('ar');

const documentData = (data: TestData): DocumentData => ({
  state: data.book.state,
  profile: data.profile,
  year: data.year,
  calendar: data.calendar,
  calendarRelease: data.calendarRelease,
  packs: data.packs,
  bells: data.bells,
  day: parseDay('2026-10-18'),
  lang: 'ar',
  dir: 'rtl',
});

const support: ExtraSession = {
  id: 'x-1',
  courseId: 'c-1',
  kind: 'support',
  day: parseDay('2026-10-14'),
  from: '15:00',
  to: '16:30',
};

const rows = (html: string) => html.match(/<tr><td>\d+<\/td>/g)?.length ?? 0;

async function withSupportDay() {
  const data = await withDay();
  const day = parseDay('2026-10-15');
  await data.book.record(day, { kind: 'extra.logged', extra: support });
  const context = coreContext({ ...data, state: data.book.state });
  const saturday = parseDay('2026-10-17');
  const takes = followedEntries(context, 's-1', saturday, 4).map((one) => one.take);
  await data.book.record(
    day,
    addSessionsDay(context, {
      id: 'added-1',
      schoolId: 's-1',
      day: saturday,
      adds: 'support',
      follows: 4,
      takes,
      name: { ar: 'يوم دعم' },
      source: 'إعلان مدير المؤسسة',
      confidence: 'announced',
    }),
  );
  return data;
}

test("numbers a class's sessions outside the timetable and its support-day sessions through the year", async () => {
  const data = await withSupportDay();
  const html = supervisedPages(documentData(data), t, false);
  expect(html).toContain('دفتر النصوص · الصفحة 08');
  expect(html).toContain('الدروس المحروسة أو الإضافية بالمؤسسة<sup>(1)</sup>');
  expect(html).toContain('<th>النشاط في مادة</th>');
  expect(html).toContain('<td>1</td><td class="subject">اللغة العربية</td><td>دعم</td><td>2026/10/14</td>');
  expect(html).toContain('⁧15سا – 16سا30⁩');
  expect(html).toContain('<td>2026/10/17</td>');
  expect(html).toContain('(1) تطبيقا للقرار رقم 835 المؤرخ في: 1991/09/13');
  expect(rows(html)).toBeGreaterThanOrEqual(2);
  expect(html).not.toMatch(/<script|https?:/);
});

test('a class with no such session, and the blank version, get the page with its heads and empty rules', async () => {
  const data = await withDay();
  const recorded = supervisedPages(documentData(data), t, false);
  expect(recorded.match(/<section class="page"[^>]*>/g)).toHaveLength(2);
  expect(rows(recorded)).toBe(0);
  expect(recorded.match(/<tr><td><\/td>/g)).toHaveLength(2 * SUPERVISED_RULES);
  const blank = supervisedPages(documentData(await withSupportDay()), t, true);
  expect(rows(blank)).toBe(0);
  expect(blank).toContain('القسم: ⁨4م1⁩');
});

test('a year of rows runs on to more pages, a long subject counted as the rules it wraps onto', async () => {
  const data = await withDay();
  const day = parseDay('2026-10-15');
  for (let n = 1; n <= 30; n += 1) {
    await data.book.record(day, {
      kind: 'extra.logged',
      extra: { ...support, id: `x-${n}`, day: parseDay(`2026-10-${String((n % 14) + 1).padStart(2, '0')}`) },
    });
  }
  const short = supervisedPages(documentData(data), t, false);
  expect(short.match(/<section class="page"[^>]*>/g)).toHaveLength(3);
  expect(short).toContain('<td>30</td>');
  const long = 'التربية العلمية والتكنولوجية والإعلام';
  const subjects = data.profile.subjects.map((one) =>
    one.code === 'arabic' ? { ...one, name: { ...one.name, ar: long } } : one,
  );
  const wrapped = supervisedPages({ ...documentData(data), profile: { ...data.profile, subjects } }, t, false);
  expect(wrapped.match(/<section class="page"[^>]*>/g)).toHaveLength(4);
  expect(wrapped.match(/<tr><td><\/td>/g)).toHaveLength(SUPERVISED_RULES - 12 + SUPERVISED_RULES);
});

test('the Documents tab lists it for the year, and never for a teacher with no class this year', async () => {
  const data = await withDay();
  const kind = documentKind('supervised');
  expect(kind?.title(t)).toBe('الدروس المحروسة أو الإضافية');
  expect(kind && fileName(kind, documentData(data), t, false)).toBe('الدروس المحروسة أو الإضافية 2026-2027.pdf');
  expect(kind?.empty(documentData(data))).toBe(false);
  expect(kind?.empty({ ...documentData(data), year: { ...data.year, id: '2027-2028' } })).toBe(true);
});
