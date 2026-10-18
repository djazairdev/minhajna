// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The primary journal's front pages (#216, P-Journal-front, R-3.8-08): for
// each primary class, the cover, the card with the pupils' number, the
// holidays and seminars, the pupil list with names and registration numbers
// only, and the weekly timetable with its approval boxes, all marked
// «داخلي · سري»; the blank version; and the Documents tab listing it to a
// primary teacher. Made-up pupils only.

import { parseDay } from '@minhajna/core';
import type { TestData } from '../jest/app-data';
import { slot, withPrimary } from '../jest/primary-class';
import { withDay } from '../jest/today-day';
import { DOCUMENTS, documentKind } from '../src/documents/catalogue';
import type { DocumentData } from '../src/documents/document-data';
import { primaryFrontPages } from '../src/documents/primary-front-pages';
import { i18n } from '../src/text/i18n';
import { span } from '../src/times/TimeTable';
import text from '../src/text/ar.json';

const t = i18n.getFixedT('ar');
const front = text.documents.primaryFront;

async function withPupils(): Promise<TestData> {
  const data = await withPrimary();
  await data.book.recordAll(parseDay('2026-10-15'), [
    { kind: 'teacher.set', card: { rank: 'أستاذ المدرسة الابتدائية' } },
    { kind: 'teacher.personal.set', personal: { name: 'مقراني نادية' } },
    {
      kind: 'pupil.set',
      pupil: {
        id: 'q-0',
        classId: 'p-1',
        name: 'مختلق غادر',
        sex: 'm',
        groups: [],
        movements: [{ day: parseDay('2026-10-01'), kind: 'out', reason: 'Transfer', confirmed: true }],
      },
    },
    ...['مختلق أمين', 'مختلق سارة', 'مختلق يونس'].map((name, at) => ({
      kind: 'pupil.set' as const,
      pupil: {
        id: `q-${at + 1}`,
        classId: 'p-1',
        name,
        sex: at === 1 ? ('f' as const) : ('m' as const),
        groups: [],
        movements: [],
        ...(at !== 2 && { registration: `1500${at + 1}` }),
      },
    })),
  ]);
  return data;
}

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

test('a class gets its cover, card, holidays, seminars, pupil list and timetable, marked confidential', async () => {
  const html = primaryFrontPages(documentData(await withPupils()), t, false);
  expect(html.match(/<section class="page">/g)).toHaveLength(6);
  expect(html).toContain('<div class="cover">');
  expect(html).toContain('الاسم واللقب: مقراني نادية');
  expect(html).toContain('أستاذ المدرسة الابتدائية');
  expect(html).toContain('⁨5 ابتدائي أ⁩ · 3 تلاميذ');
  expect(html).toContain(text.documents.journalFront.holidays);
  expect(html).toContain('عيد الثورة');
  expect(html).toContain(text.documents.journalFront.events);
  expect(html).toContain(front.pupils);
  expect(html).toContain('<td class="d"><bdi>1</bdi></td><td>مختلق أمين</td><td>15001</td>');
  expect(html).toContain('<td class="d"><bdi>3</bdi></td><td>مختلق يونس</td><td></td>');
  expect(html).not.toContain('مختلق غادر');
  expect(html).toContain(front.pupilsNote);
  expect(html.match(/داخلي · سري/g)!.length).toBeGreaterThanOrEqual(12);
});

test('the timetable gives the class’s sessions by day and slot, with the approval boxes', async () => {
  const html = primaryFrontPages(documentData(await withPupils()), t, false);
  const week = html.slice(html.indexOf(`${front.week} · ⁨5 ابتدائي أ⁩`));
  expect(week).toContain(`<th>${front.time}</th><th>${text.week.days[0]}</th>`);
  expect(week).toContain(text.documents.primaryJournal.morning);
  expect(week).toContain(text.documents.primaryJournal.afternoon);
  expect(week.match(/<td>اللغة العربية<\/td>/g)).toHaveLength(2);
  expect(week.match(/<td>الرياضيات<\/td>/g)).toHaveLength(1);
  expect(week).toContain(front.approved);
  expect(week).toContain(front.seal);
});

test('a multigrade class names the levels of a session not for all of them, and week A or B', async () => {
  const data = await withPrimary();
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'class.set',
      schoolClass: {
        id: 'p-1',
        schoolId: 's-1',
        level: 'primary',
        grade: '1ap',
        name: '1 و2 ابتدائي',
        groups: [
          { id: 'p-1-w', kind: 'whole', name: '1 و2 ابتدائي' },
          { id: 'p-1-1', kind: 'level', name: '1 ابتدائي', grade: '1ap' },
          { id: 'p-1-2', kind: 'level', name: '2 ابتدائي', grade: '2ap' },
        ],
      },
    },
    {
      kind: 'course.set',
      course: { id: 'm-1', classId: 'p-1', subject: 'math', year: '2026-2027', pack: null, grade: '1ap' },
    },
    {
      kind: 'course.set',
      course: { id: 'm-2', classId: 'p-1', subject: 'math', year: '2026-2027', pack: null, grade: '2ap' },
    },
    {
      kind: 'timetable.set',
      version: {
        id: 'v-2',
        from: parseDay('2026-10-11'),
        source: 'hand',
        entries: [
          slot('e-1', 'morning', 1, 'a-1'),
          slot('e-2', 'morning', 2, 'm-1'),
          { ...slot('e-3', 'afternoon', 1, 'm-1'), weeks: 'A' },
          { ...slot('e-4', 'afternoon', 1, 'a-1'), weeks: 'B' },
        ],
        blocks: [],
      },
    },
  ]);
  const html = primaryFrontPages(documentData(data), t, false);
  const level = text.joint.short.replace('{{n}}', '1');
  expect(html).toContain(`<td>اللغة العربية · ${level}</td>`);
  expect(html).toContain('<td>الرياضيات</td>');
  expect(html).toContain(
    `<td>الرياضيات ${text.week.weekShortA} / اللغة العربية · ${level} ${text.week.weekShortB}</td>`,
  );
});

test('the timetable keeps the usual times in Ramadan, and before the year or its first timetable shows them', async () => {
  const data = await withPrimary();
  const time = (to: string) => [{ half: 'morning' as const, index: 1, from: '08:00', to }];
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'school.set',
      school: {
        id: 's-1',
        name: 'مدرسة الياسمين',
        levels: ['primary'],
        subjects: ['arabic', 'math'],
        zone: '16',
        bells: { usual: time('09:00'), ramadan: time('08:40') },
      },
    },
  ]);
  const usual = span('08:00', '09:00', 'rtl');
  for (const day of ['2027-02-11', '2026-09-01', '2026-10-01']) {
    const html = primaryFrontPages(documentData(data, day), t, false);
    expect(html).toContain(`<bdi>${usual}</bdi>`);
    expect(html).not.toContain('08:40');
    expect(html.match(/<td>اللغة العربية<\/td>/g)).toHaveLength(2);
  }
});

test('the blank version keeps the labels, an empty list and an empty timetable', async () => {
  const html = primaryFrontPages(documentData(await withPupils()), t, true);
  expect(html).not.toContain('مقراني نادية');
  expect(html).not.toContain('مختلق أمين');
  expect(html).not.toContain('<td>اللغة العربية</td>');
  expect(html.match(/⁨5 ابتدائي أ⁩/g)).toHaveLength(3);
  expect(html).toContain(`<th>${front.className}</th><td><bdi dir="rtl">⁨5 ابتدائي أ⁩</bdi></td>`);
  const list = html.slice(html.indexOf(`<h2>${front.pupils}</h2>`), html.indexOf(`<h2>${front.week}`));
  expect(list.match(/<tr><td><\/td><td><\/td><td><\/td><\/tr>/g)).toHaveLength(23);
  expect(html).toContain(front.pupils);
});

test('the tab lists the primary front pages to a primary teacher only, as a document with pupils', async () => {
  const listed = (data: TestData) =>
    DOCUMENTS.filter((kind) => kind.shown?.(documentData(data)) ?? true).map((kind) => kind.id);
  expect(listed(await withPrimary())).toContain('primary-front');
  expect(listed(await withPrimary())).not.toContain('journal-front');
  expect(listed(await withDay())).not.toContain('primary-front');
  expect(documentKind('primary-front')!.pupils).toBe(true);
});
