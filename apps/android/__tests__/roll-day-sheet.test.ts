// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The blank roll-call sheet's rows and boxes (#217, Roll-print, answer 263):
// a joint primary class's shared roll call lists both years' pupils, from
// either year's book, and a half group's session greys the boxes of the
// pupils outside it. Made-up classes and pupils only.

import { parseDay, type Day, type TimetableEntry } from '@minhajna/core';
import { openTestData, type TestData } from '../jest/app-data';
import { withPupils } from '../jest/roll-class';
import type { DocumentData } from '../src/documents/document-data';
import { rollDayPages } from '../src/documents/roll-day-sheet';
import { rollBooks } from '../src/documents/roll-spread-pages';
import { i18n } from '../src/text/i18n';

const t = i18n.getFixedT('ar');
const DAY = '2026-10-15' as Day;

const documentData = (data: TestData): DocumentData => ({
  state: data.book.state,
  profile: data.profile,
  year: data.year,
  calendar: data.calendar,
  calendarRelease: data.calendarRelease,
  packs: data.packs,
  bells: data.bells,
  day: parseDay('2026-10-01'),
  today: parseDay('2026-10-18'),
  lang: 'ar',
  dir: 'rtl',
});

const entry = (id: string, half: 'morning' | 'afternoon', index: number, courseId: string, groupId: string) =>
  ({
    id,
    weekday: 4,
    slot: { half, index },
    courseId,
    groupId,
    weeks: 'every',
    sessionType: 'lesson',
  }) satisfies TimetableEntry;

test('a joint class’s shared roll call lists both years’ pupils, from either year’s book', async () => {
  const data = await openTestData();
  await data.book.recordAll(parseDay('2026-10-11'), [
    {
      kind: 'school.set',
      school: { id: 's-1', name: 'ابتدائية الأمل', levels: ['primary'], subjects: ['arabic'], zone: '16' },
    },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k',
        schoolId: 's-1',
        level: 'primary',
        grade: '4ap',
        name: '4-5 أ',
        groups: [
          { id: 'k-w', kind: 'whole', name: '4-5 أ' },
          { id: 'k-4', kind: 'level', name: '4AP', grade: '4ap' },
          { id: 'k-5', kind: 'level', name: '5AP', grade: '5ap' },
        ],
      },
    },
    ...['k-4', 'k-5'].map((year, at) => ({
      kind: 'pupil.set' as const,
      pupil: { id: `p-${at}`, classId: 'k', name: `تلميذ ${at}`, sex: 'f' as const, groups: [year], movements: [] },
    })),
    { kind: 'course.set', course: { id: 'c-4', classId: 'k', subject: 'arabic', year: '2026-2027', pack: null } },
    {
      kind: 'course.set',
      course: { id: 'c-5', classId: 'k', subject: 'arabic', year: '2026-2027', grade: '5ap', pack: null },
    },
    {
      kind: 'timetable.set',
      version: {
        id: 'v-1',
        from: parseDay('2026-10-11'),
        source: 'hand',
        entries: [entry('e-1', 'morning', 1, 'c-4', 'k-w'), entry('e-2', 'morning', 2, 'c-4', 'k-w')],
        blocks: [],
      },
    },
  ]);
  const d = documentData(data);
  const books = rollBooks(d);
  expect(books.map((book) => book.groupId).sort()).toEqual(['k-4', 'k-5']);
  for (const book of books) {
    const html = rollDayPages(d, t, book, DAY);
    expect(html).toContain('تلميذ 0');
    expect(html).toContain('تلميذ 1');
    expect(html).not.toContain('class="out"');
  }
});

test('a half group’s session greys the boxes of the pupils outside it', async () => {
  const data = await withPupils();
  const schoolClass = data.book.state.classes.get('k-1')!;
  const pupils = ['p-1', 'p-2'].map((id) => data.book.state.pupils.get(id)!);
  await data.book.recordAll(parseDay('2026-10-11'), [
    {
      kind: 'class.set',
      schoolClass: { ...schoolClass, groups: [...schoolClass.groups, { id: 'k-1-a', kind: 'half', name: 'الفوج 1' }] },
    },
    ...pupils.map((pupil) => ({ kind: 'pupil.set' as const, pupil: { ...pupil, groups: ['k-1-a'] } })),
    {
      kind: 'timetable.set',
      version: {
        id: 'v-2',
        from: parseDay('2026-10-11'),
        source: 'hand',
        entries: [
          entry('e-1', 'morning', 1, 'c-1', 'k-1-w'),
          entry('e-2', 'morning', 2, 'c-1', 'k-1-w'),
          entry('e-4', 'afternoon', 1, 'c-1', 'k-1-a'),
        ],
        blocks: [],
      },
    },
  ]);
  const d = documentData(data);
  const book = rollBooks(d).find((one) => one.classId === 'k-1' && one.groupId === 'k-1-w')!;
  const html = rollDayPages(d, t, book, DAY);
  expect(html.match(/<col style="width:24mm">/g)).toHaveLength(3);
  expect(html.match(/<td class="out"/g)).toHaveLength(43);
});
