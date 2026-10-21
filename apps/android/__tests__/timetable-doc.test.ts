// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's weekly timetable as a document (#215, Timetable-doc,
// R-3.8-37, R-4.6-04): the grid of the version in force with its bell times,
// each class's hours and the total, the day it applies from, and the three
// boxes; the version for another day, and the first one before it applies;
// a week A slot counting half; the teacher's own time; two schools; the
// blank version; and the Documents tab's line and file name. Made-up
// records only.

import { parseDay } from '@minhajna/core';
import type { TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { documentKind, fileName } from '../src/documents/catalogue';
import type { DocumentData } from '../src/documents/document-data';
import { timetablePages } from '../src/documents/timetable-pages';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';
import { span } from '../src/times/TimeTable';

const t = i18n.getFixedT('ar');
const doc = text.documents.timetable;
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

const thursday = (html: string) =>
  [...html.matchAll(/<tr><td class="t">.*?<\/tr>/g)].map((row) => {
    const cells = [...row[0].matchAll(/<td>(.*?)<\/td>/g)].map((cell) => cell[1]);
    return cells[cells.length - 1];
  });

test('the version in force: its grid with bell times, each class’s hours, the day it applies from, and the boxes', async () => {
  const html = timetablePages(documentData(await withDay()), t, false);
  expect(html).toContain(`<span>${fl('متوسطة النجاح')}</span><span>السنة الدراسية ${fl('2026-2027')}</span>`);
  expect(html).toContain(`<h1>${doc.title}</h1>`);
  expect(html).toContain(`<div class="line">${doc.teacher}: · ${doc.subject}: اللغة العربية</div>`);
  expect(html).toContain(`<div class="line">${doc.classes}: ${fl('4م1')}، ${fl('4م2')}</div>`);
  expect(html).toContain(`<th></th><th>${text.week.days[0]}</th>`);
  expect(html).toContain(`<td class="t"><bdi>${span('08:00', '09:00', 'rtl')}</bdi></td>`);
  expect(thursday(html).slice(0, 4)).toEqual([fl('4م1'), fl('4م1'), fl('4م2'), '']);
  expect(html).toContain('<tr class="gap">');
  expect(html).toContain(`${fl('4م1')}: ساعتان · ${fl('4م2')}: ساعة واحدة · المجموع 3 ساعات في الأسبوع`);
  expect(html).toContain(`<div class="from">ساري من ${text.week.days[0]} 11/10/2026</div>`);
  for (const box of [doc.teacherBox, text.documents.director, doc.inspector])
    expect(html).toContain(`<div><b>${box}</b><small>${doc.date}</small></div>`);
});

test('another day prints the version in force then, and before the first applies, the first', async () => {
  const data = await withDay();
  const first = data.book.state.timetables[0].version;
  await data.book.recordAll(parseDay('2026-10-28'), [
    {
      kind: 'timetable.set',
      version: { ...first, id: 'v-2', from: parseDay('2026-11-01'), entries: first.entries.slice(0, 1) },
    },
  ]);
  const later = timetablePages(documentData(data, '2026-11-05'), t, false);
  expect(later).toContain('ساري من الأحد 01/11/2026');
  expect(later).toContain('المجموع ساعة واحدة في الأسبوع');
  const before = timetablePages(documentData(data, '2026-09-01'), t, false);
  expect(before).toContain('ساري من الأحد 11/10/2026');
  expect(before).toContain('المجموع 3 ساعات في الأسبوع');
});

test('before any version applies, the first that ever applies; never last school year’s', async () => {
  const data = await withDay();
  const first = data.book.state.timetables[0].version;
  const old = { ...first, id: 'v-0', entries: first.entries.map((entry) => ({ ...entry, courseId: 'c-0' })) };
  await data.book.recordAll(parseDay('2026-10-15'), [
    { kind: 'course.set', course: { id: 'c-0', classId: 'k-1', subject: 'arabic', year: '2025-2026', pack: null } },
  ]);
  const state = data.book.state;
  const records = [
    { from: parseDay('2025-09-21'), recorded: parseDay('2025-09-10'), version: old },
    { from: parseDay('2026-10-01'), recorded: parseDay('2026-09-15'), version: { ...first, id: 'v-1' } },
    {
      from: parseDay('2026-09-25'),
      recorded: parseDay('2026-09-20'),
      version: { ...first, id: 'v-2', entries: first.entries.slice(0, 1) },
    },
  ];
  const at = (day: string) => ({ ...documentData(data, day), state: { ...state, timetables: records } });
  const before = timetablePages(at('2026-09-22'), t, false);
  expect(before).toContain('ساري من الجمعة 25/09/2026');
  expect(before).toContain('المجموع ساعة واحدة في الأسبوع');
  expect(before).not.toContain('2025');
});

test('a week A slot is marked and counts half; the teacher’s own time shows; two schools name theirs', async () => {
  const data = await withDay();
  const first = data.book.state.timetables[0].version;
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'school.set',
      school: { id: 's-2', name: 'متوسطة الأمل', levels: ['cem'], subjects: ['arabic'], zone: '16' },
    },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-3',
        schoolId: 's-2',
        level: 'cem',
        grade: '4am',
        name: '4م3',
        groups: [{ id: 'k-3-w', kind: 'whole', name: '4م3' }],
      },
    },
    { kind: 'course.set', course: { id: 'c-3', classId: 'k-3', subject: 'arabic', year: '2026-2027', pack: null } },
    {
      kind: 'timetable.set',
      version: {
        ...first,
        id: 'v-2',
        entries: [
          ...first.entries,
          { ...first.entries[0], id: 'e-4', weekday: 0, courseId: 'c-3', groupId: 'k-3-w', weeks: 'A' },
        ],
        blocks: [{ weekday: 4, half: 'afternoon', kind: 'duty', label: '' }],
      },
    },
  ]);
  const html = timetablePages(documentData(data), t, false);
  expect(html).toContain(`<td>${fl('4م3')} ${fl('الأمل')} ${text.week.weekShortA}</td>`);
  expect(html).toContain(`${fl('4م3')}: 0,5 ساعة`);
  expect(html).toContain('المجموع 3,5 ساعة في الأسبوع');
  expect(html).toContain(`<td>${text.week.kinds.duty}</td>`);
  expect(html).toContain(`<span>${fl('متوسطة النجاح')} · ${fl('متوسطة الأمل')}</span>`);
});

test('the blank version keeps the school, the year, the labels and the slots, and leaves the rest', async () => {
  const html = timetablePages(documentData(await withDay()), t, true);
  expect(html).toContain(`<span>${fl('متوسطة النجاح')}</span>`);
  expect(html).not.toContain(fl('4م1'));
  expect(html).toContain(`<div class="line">${doc.classes}:</div>`);
  expect(html).toContain('<div class="hours"></div><div class="from">ساري من</div>');
  expect(html).toContain(`<td class="t"><bdi>${span('08:00', '09:00', 'rtl')}</bdi></td>`);
});

test('the Documents tab names the version, and a teacher with no timetable has nothing to print', async () => {
  const kind = documentKind('timetable')!;
  const data = documentData(await withDay());
  expect(kind.line(data, t)).toBe('ساري من الأحد 11/10/2026');
  expect(fileName(kind, data, t, false)).toBe(`${doc.name} 2026-10-11.pdf`);
  const none = documentData(await withDay());
  const empty = { ...none, state: { ...none.state, timetables: [] } };
  expect(kind.empty(empty)).toBe(true);
  expect(kind.line(empty, t)).toBe(doc.none);
});
