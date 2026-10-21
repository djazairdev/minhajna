// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A primary specialist's daily journal (#216, PS-Journal, R-3.8-11): the French
// specialist's day in French, left to right, with a band for each school and
// half-day and each school's visa; a page per class; Tamazight, French and
// English each in turn, Tamazight in the book's words until it has its own; the
// blank version; a day without sessions; and the class teacher's journal, its
// front pages and the tab leaving the specialist's subjects to this journal.
// Made-up records only.

import { parseDay } from '@minhajna/core';
import type { TestData } from '../jest/app-data';
import { withPrimary } from '../jest/primary-class';
import { course, primaryClass, thursday, withSpecialist } from '../jest/specialist-classes';
import { DOCUMENTS } from '../src/documents/catalogue';
import type { DocumentData } from '../src/documents/document-data';
import { BLANK_ROWS } from '../src/documents/primary-journal-html';
import { primaryJournalPages } from '../src/documents/primary-journal-pages';
import { primaryFrontPages } from '../src/documents/primary-front-pages';
import { specialistJournalPages } from '../src/documents/specialist-journal-pages';
import { i18n } from '../src/text/i18n';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';

const t = i18n.getFixedT('ar');
const fl = (name: string) => `⁨${name}⁩`;

const documentData = (data: TestData, day = '2026-10-15'): DocumentData => ({
  state: data.book.state,
  profile: data.profile,
  year: data.year,
  calendar: data.calendar,
  calendarRelease: data.calendarRelease,
  packs: data.packs,
  bells: data.bells,
  day: parseDay(day),
  lang: 'ar',
  dir: 'rtl',
});

const pages = (html: string) => html.match(/<section class="page"[^>]*>/g)?.length ?? 0;

test('one journal for all classes: the day in French, a band for each school and half-day, each school’s visa', async () => {
  const html = specialistJournalPages(documentData(await withSpecialist()), t, false);
  expect(pages(html)).toBe(1);
  expect(html).toContain('<html lang="fr" dir="ltr">');
  expect(html).toContain('<div lang="fr" dir="ltr" class="latin">');
  expect(html).toContain(`<div class="book">${fr.documents.primaryJournal.name}</div>`);
  expect(html).toContain(`${fr.week.days[4]} 15 octobre 2026`);
  expect(html).toContain(`<small>${fr.documents.year.replace('{{year}}', fl('2026-2027'))}</small>`);
  const heads = ['time', 'class', 'activity', 'content', 'indicator', 'domain'] as const;
  expect(html).toContain(heads.map((head) => `<th>${fr.documents.primaryJournal.heads[head]}</th>`).join(''));
  expect(html).toContain(
    `<td class="band" colspan="6">${fl('مدرسة الفتح')} · ${fr.documents.primaryJournal.morning}</td>`,
  );
  expect(html).toContain(`${fl('مدرسة الرياض')} · ${fr.documents.primaryJournal.afternoon}</td>`);
  expect(html).toContain(`<bdi>⁦08:00 – 08:45⁩</bdi></td><td>${fl('3 ابتدائي أ')}</td>`);
  expect(html).toContain(`<td>${fl('3 ابتدائي ب')}</td>`);
  expect(html).toContain(`<bdi>⁦13:00 – 13:45⁩</bdi></td><td>${fl('5 ابتدائي أ')}</td>`);
  expect(html.match(/<tr class="awaiting">/g)).toHaveLength(3);
  expect(html).toContain(fr.documents.journalLines.awaiting);
  const visa = (school: string) => `<div>${fr.documents.director}<br><small>${fl(school)}</small></div>`;
  expect(html).toContain(`${visa('مدرسة الفتح')}${visa('مدرسة الرياض')}`);
  expect(html).toContain('grid-template-columns:repeat(3,1fr)');
});

test('sessions follow the clock across two schools’ bells; a multigrade class says the level', async () => {
  const data = await withSpecialist(
    [
      {
        kind: 'school.set',
        school: {
          id: 's-2',
          name: 'مدرسة الرياض',
          levels: ['primary'],
          subjects: ['french'],
          zone: '16',
          bells: { usual: [{ half: 'morning', index: 1, from: '09:50', to: '10:35' }] },
        },
      },
      {
        kind: 'class.set',
        schoolClass: {
          id: 'k-5',
          schoolId: 's-2',
          level: 'primary',
          grade: '3ap',
          name: '3 و4 ابتدائي',
          groups: [
            { id: 'k-5-w', kind: 'whole', name: '3 و4 ابتدائي' },
            { id: 'k-5-3', kind: 'level', name: '3 ابتدائي', grade: '3ap' },
            { id: 'k-5-4', kind: 'level', name: '4 ابتدائي', grade: '4ap' },
          ],
        },
      },
      {
        kind: 'course.set',
        course: { id: 'j-1', classId: 'k-5', subject: 'french', year: '2026-2027', pack: null, grade: '4ap' },
      },
    ],
    [thursday('e-6', 'morning', 1, 'j-1', 'k-5')],
  );
  const html = specialistJournalPages(documentData(data), t, false);
  const morning = fr.documents.primaryJournal.morning;
  const bands = [...html.matchAll(/<td class="band" colspan="6">([^<]*)<\/td>/g)].map((match) => match[1]);
  expect(bands).toEqual([
    `${fl('مدرسة الفتح')} · ${morning}`,
    `${fl('مدرسة الرياض')} · ${morning}`,
    `${fl('مدرسة الرياض')} · ${fr.documents.primaryJournal.afternoon}`,
  ]);
  expect(html.indexOf('09:00 – 09:45')).toBeLessThan(html.indexOf('09:50 – 10:35'));
  expect(html).toContain(`<td>${fl('3 و4 ابتدائي')} · ${fr.joint.short.replace('{{n}}', '4')}</td>`);
});

test('a half-day with a session without bells keeps the slots’ order, even past an earlier bell', async () => {
  const late = [thursday('l-1', 'morning', 3, 'f-3', 'k-3'), thursday('m-1', 'morning', 4, 'f-1', 'k-1')];
  const data = await withSpecialist(
    [
      {
        kind: 'school.set',
        school: {
          id: 's-2',
          name: 'مدرسة الرياض',
          levels: ['primary'],
          subjects: ['french'],
          zone: '16',
          bells: { usual: [{ half: 'morning', index: 3, from: '07:30', to: '08:15' }] },
        },
      },
    ],
    late,
  );
  const html = specialistJournalPages(documentData(data), t, false);
  const rows = [...html.matchAll(/<td>(\u2068[^<]*\u2069)<\/td><td><\/td>/g)].map((match) => match[1]);
  expect(rows).toEqual([fl('3 ابتدائي أ'), fl('3 ابتدائي ب'), fl('5 ابتدائي أ'), fl('3 ابتدائي أ'), fl('5 ابتدائي أ')]);
});

test('one journal per class gives each class with a session its page and its school’s visa', async () => {
  const html = specialistJournalPages(documentData(await withSpecialist()), t, false, 'per-class');
  expect(pages(html)).toBe(3);
  expect(html).toContain(`<small>${fl('مدرسة الفتح')} · Classe : ${fl('3 ابتدائي ب')}</small>`);
  expect(html).toContain(`<small>${fl('مدرسة الرياض')} · Classe : ${fl('5 ابتدائي أ')}</small>`);
  expect(html.match(/grid-template-columns:repeat\(2,1fr\)/g)).toHaveLength(3);
});

test('English and Tamazight follow in turn, Tamazight in the book’s words and direction', async () => {
  const data = await withSpecialist(
    [
      course('n-1', 'k-1', 'english'),
      primaryClass('k-4', 's-2', '4ap', '4 ابتدائي أ'),
      course('z-1', 'k-4', 'tamazight'),
    ],
    [thursday('e-4', 'morning', 3, 'n-1', 'k-1'), thursday('e-5', 'afternoon', 2, 'z-1', 'k-4')],
  );
  const html = specialistJournalPages(documentData(data), t, false);
  expect(pages(html)).toBe(3);
  const french = html.indexOf('<div lang="fr" dir="ltr" class="latin">');
  const english = html.indexOf('<div lang="en" dir="ltr" class="latin">');
  const arabic = html.indexOf('<div lang="ar" dir="rtl">');
  expect(arabic).toBeGreaterThan(0);
  expect(french).toBeGreaterThan(arabic);
  expect(english).toBeGreaterThan(french);
  expect(html).toContain('<html lang="ar" dir="rtl">');
  expect(html.slice(arabic, french)).toContain(`<div class="book">${ar.documents.primaryJournal.name}</div>`);
  expect(html.slice(arabic, french)).toContain(`${fl('مدرسة الرياض')} · ${ar.documents.primaryJournal.afternoon}`);
  expect(html.slice(english)).toContain(`${en.week.days[4]} 15 October 2026`);
  expect(html.slice(english)).toContain(`${fl('مدرسة الفتح')} · ${en.documents.primaryJournal.morning}`);
});

test('the blank version gives empty bands for all classes or for each, with every school’s visa', async () => {
  const data = documentData(await withSpecialist());
  const one = specialistJournalPages(data, t, true);
  expect(pages(one)).toBe(1);
  expect(one.match(/<tr class="blank">/g)).toHaveLength(BLANK_ROWS.morning + BLANK_ROWS.afternoon);
  expect(one).toContain('grid-template-columns:repeat(3,1fr)');
  expect(one).not.toContain('octobre');
  const each = specialistJournalPages(data, t, true, 'per-class');
  expect(pages(each)).toBe(3);
});

test('a day without sessions says so on one page', async () => {
  const html = specialistJournalPages(documentData(await withSpecialist(), '2026-10-18'), t, false);
  expect(pages(html)).toBe(1);
  expect(html).toContain(fr.documents.empty);
  expect(html).toContain(`${fr.week.days[0]} 18 octobre 2026`);
});

test('the class teacher’s journal, its front pages and the tab leave the specialist’s subjects to this journal', async () => {
  const both = await withPrimary();
  await both.book.recordAll(parseDay('2026-10-15'), [
    course('f-9', 'p-1', 'french'),
    {
      kind: 'timetable.set',
      version: {
        ...both.book.state.timetables.at(-1)!.version,
        id: 'v-9',
        entries: [
          ...both.book.state.timetables.at(-1)!.version.entries,
          { ...thursday('e-9', 'morning', 3, 'f-9', 'p-1'), groupId: 'p-1-w' },
        ],
      },
    },
  ]);
  const data = documentData(both);
  const french = data.profile.subjects.find((one) => one.code === 'french')!.name.ar;
  expect(primaryJournalPages(data, t, false)).not.toContain(french);
  expect(primaryFrontPages(data, t, false)).not.toContain(`<td>${french}</td>`);
  const specialist = specialistJournalPages(data, t, false);
  expect(pages(specialist)).toBe(1);
  expect(specialist).toContain(fl('5 ابتدائي أ'));
  const listed = (one: TestData) =>
    DOCUMENTS.filter((kind) => kind.shown?.(documentData(one)) ?? true).map((kind) => kind.id);
  expect(listed(both)).toEqual(expect.arrayContaining(['primary-journal', 'primary-front', 'specialist-journal']));
  const only = listed(await withSpecialist());
  expect(only).toContain('specialist-journal');
  expect(only).not.toContain('primary-journal');
  expect(only).not.toContain('primary-front');
  expect(only).not.toContain('journal');
  expect(listed(await withPrimary())).not.toContain('specialist-journal');
});
