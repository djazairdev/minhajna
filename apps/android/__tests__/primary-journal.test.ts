// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The primary daily journal (#216, P-Journal, R-3.8-09, R-3.8-10): a
// landscape page for each primary class with a session that day, its
// sessions in the morning and afternoon bands with their duration, subject,
// activity, content and domain, one awaiting confirmation in grey; the
// teacher's and director's boxes; the blank version; and the Documents tab
// listing the journal for the levels taught. Made-up records only.

import { confirmSessions, parseDay, sessionsBetween } from '@minhajna/core';
import { journalFrontPages } from '../src/documents/journal-front-pages';
import { journalPages } from '../src/documents/journal-pages';
import type { TestData } from '../jest/app-data';
import { slot, withPrimary } from '../jest/primary-class';
import { withDay } from '../jest/today-day';
import { DOCUMENTS, documentKind } from '../src/documents/catalogue';
import type { DocumentData } from '../src/documents/document-data';
import { BLANK_ROWS } from '../src/documents/primary-journal-html';
import { primaryJournalPages } from '../src/documents/primary-journal-pages';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';

const t = i18n.getFixedT('ar');
const primary = text.documents.primaryJournal;

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

test('a class’s day prints in its two bands, with duration, subject, activity and content', async () => {
  const data = await withPrimary();
  const context = coreContext(documentData(data));
  const [first] = sessionsBetween(context, parseDay('2026-10-15'), parseDay('2026-10-15'));
  await data.book.recordAll(parseDay('2026-10-15'), confirmSessions(context, [{ session: first }]));
  const html = primaryJournalPages(documentData(data), t, false);
  expect(html).toContain('size:A4 landscape');
  expect(html.match(/<section class="page">/g)).toHaveLength(1);
  expect(html).toContain('القسم: ⁨5 ابتدائي أ⁩');
  expect(html).toContain('الخميس 15 أكتوبر 2026');
  const morning = html.indexOf(primary.morning);
  const afternoon = html.indexOf(primary.afternoon);
  expect(morning).toBeGreaterThan(0);
  expect(afternoon).toBeGreaterThan(morning);
  expect(html).toMatch(/<td class="c"><bdi>\d+ د<\/bdi><\/td><td>اللغة العربية<\/td><td>قراءة<\/td>/);
  expect(html).toContain('قراءة 1 (مثال)');
  expect(html).not.toContain(text.documents.journalLines.outcomes.done);
  expect(html.slice(afternoon)).toContain('<tr class="awaiting">');
  expect(html.slice(afternoon)).toContain(
    `${text.documents.journalLines.how}: ${text.documents.journalLines.awaiting}`,
  );
  expect(html).toContain(primary.teacher);
  expect(html).toContain(text.documents.director);
  const heads = ['minutes', 'subject', 'activity', 'content', 'indicator', 'domain'] as const;
  expect(html).toContain(heads.map((head) => `<th>${primary.heads[head]}</th>`).join(''));
});

test('a day with no session says so; the blank version gives the class its bands of empty rows', async () => {
  const data = await withPrimary();
  expect(primaryJournalPages(documentData(data, '2026-10-18'), t, false)).toContain(text.documents.empty);
  const blank = primaryJournalPages(documentData(data, '2026-10-18'), t, true);
  expect(blank.match(/<tr class="blank">/g)).toHaveLength(BLANK_ROWS.morning + BLANK_ROWS.afternoon);
  expect(blank).toContain('القسم: ⁨5 ابتدائي أ⁩');
  expect(blank).not.toContain('أكتوبر 2026');
});

test('the tab lists the primary journal to a primary teacher, and the CEM journal to a CEM teacher', async () => {
  const listed = (data: TestData) =>
    DOCUMENTS.filter((kind) => kind.shown?.(documentData(data)) ?? true).map((kind) => kind.id);
  const primaryData = await withPrimary();
  expect(listed(primaryData)).toContain('primary-journal');
  expect(listed(primaryData)).not.toContain('journal');
  const cem = await withDay();
  expect(listed(cem)).toContain('journal');
  expect(listed(cem)).not.toContain('primary-journal');
  expect(documentKind('primary-journal')!.empty(documentData(cem))).toBe(true);
});

test('a multigrade class says each row’s level; a session that is not a lesson names its type as the activity', async () => {
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
      course: { id: 'm-1', classId: 'p-1', subject: 'math', year: '2026-2027', pack: null, grade: '2ap' },
    },
    {
      kind: 'timetable.set',
      version: {
        id: 'v-2',
        from: parseDay('2026-10-11'),
        source: 'hand',
        entries: [{ ...slot('e-3', 'afternoon', 1, 'm-1'), sessionType: 'remediation' }],
        blocks: [],
      },
    },
  ]);
  const html = primaryJournalPages(documentData(data), t, false);
  expect(html).toContain(`<td>الرياضيات · ${text.joint.short.replace('{{n}}', '2')}</td><td>معالجة</td>`);
  expect(html).not.toContain(`${text.documents.journalLines.domain}:`);
  const context = coreContext(documentData(data));
  const [only] = sessionsBetween(context, parseDay('2026-10-15'), parseDay('2026-10-15'));
  await data.book.recordAll(parseDay('2026-10-15'), confirmSessions(context, [{ session: only }]));
  expect(primaryJournalPages(documentData(data), t, false)).toContain(
    `${text.documents.journalLines.how}: ${text.documents.journalLines.outcomes.done}`,
  );
});

test('a teacher of primary and CEM classes keeps the primary sessions out of the CEM journal', async () => {
  const data = await withPrimary();
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'school.set',
      school: { id: 's-2', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic'], zone: '16' },
    },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-1',
        schoolId: 's-2',
        level: 'cem',
        grade: '4am',
        name: '4م1',
        groups: [{ id: 'k-1-w', kind: 'whole', name: '4م1' }],
      },
    },
    { kind: 'course.set', course: { id: 'c-1', classId: 'k-1', subject: 'arabic', year: '2026-2027', pack: null } },
  ]);
  const html = journalPages(documentData(data), t, false, 'combined');
  expect(html).not.toContain('5 ابتدائي أ');
  expect(html).toContain(text.documents.empty);
  const listed = DOCUMENTS.filter((kind) => kind.shown?.(documentData(data)) ?? true).map((kind) => kind.id);
  expect(listed).toEqual(expect.arrayContaining(['journal', 'primary-journal']));
  const front = journalFrontPages(documentData(data), t, false);
  expect(front).toContain('\u20684م1\u2069');
  expect(front).not.toContain('5 ابتدائي أ');
  expect(front).toContain('متوسطة النجاح');
  expect(front).not.toContain('مدرسة الياسمين');
});
