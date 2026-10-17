// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The marks of a drawn week (#28): school names when the week holds two
// schools, and clashing slots, read out first. Made-up schools only.

import { parseDay, type RecordEvent, type TimetableVersion } from '@minhajna/core';
import { openTestData } from '../jest/app-data';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';
import { gridCell, schoolShort, weekMarks } from '../src/week/grid-labels';

const day = parseDay('2026-10-15');
const t = i18n.t.bind(i18n);
const setup: RecordEvent[] = [
  {
    kind: 'school.set',
    school: { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic'], zone: '16' },
  },
  {
    kind: 'school.set',
    school: { id: 's-2', name: 'متوسطة الأمل', levels: ['cem'], subjects: ['arabic'], zone: '16' },
  },
  ...(['s-1', 's-2'] as const).map((schoolId, at): RecordEvent => ({
    kind: 'class.set',
    schoolClass: {
      id: `k-${at + 1}`,
      schoolId,
      level: 'cem',
      grade: '4am',
      name: '4م1',
      groups: [{ id: `w-${at + 1}`, kind: 'whole', name: '4م1' }],
    },
  })),
  ...[1, 2].map((n): RecordEvent => ({
    kind: 'course.set',
    course: { id: `c-${n}`, classId: `k-${n}`, subject: 'arabic', year: '2026-2027', pack: null },
  })),
];
const entry = (n: number, weeks: 'every' | 'A' = 'every') => ({
  id: `e-${n}`,
  weekday: 0 as const,
  slot: { half: 'morning' as const, index: 1 },
  courseId: `c-${n}`,
  groupId: `w-${n}`,
  weeks,
  sessionType: 'lesson',
});
const version: TimetableVersion = {
  id: 'v',
  from: day,
  entries: [entry(1), entry(2, 'A')],
  blocks: [],
  source: 'hand',
};
const sun1 = { weekday: 0 as const, slot: { half: 'morning' as const, index: 1 } };

test('takes the last word of a school name as its short name', () => {
  expect(schoolShort(' متوسطة النجاح ')).toBe('النجاح');
  expect(schoolShort('École El Feth')).toBe('Feth');
});

test('names the schools and marks the clash in a week of two schools, the clash read out first', async () => {
  const data = await openTestData();
  await data.book.recordAll(day, setup);
  const { state } = data.book;
  const marks = weekMarks(version, state, [...state.classes.values()]);
  expect(marks.schools?.('s-2')).toBe('متوسطة الأمل');
  expect(marks.clashAt(sun1)).toBe(true);
  expect(marks.clashAt({ weekday: 1, slot: sun1.slot })).toBe(false);
  const lookup = { course: (id: string) => state.courses.get(id), schoolClass: (id: string) => state.classes.get(id) };
  const cell = gridCell(t, version, lookup, sun1, { schools: marks.schools, clash: true });
  expect(cell).toEqual({
    label: '\u20684م1\u2069 \u2068النجاح\u2069\n\u20684م1\u2069 \u2068الأمل\u2069 (أ)',
    spoken: `${text.week.clash}، 4م1، متوسطة النجاح، 4م1، متوسطة الأمل، ${text.week.weekA}`,
    kind: 'class',
    clash: true,
  });
});

test('leaves school names out of a week of one school', async () => {
  const data = await openTestData();
  await data.book.recordAll(day, setup.slice(0, 1));
  expect(weekMarks(version, data.book.state, []).schools).toBeUndefined();
});
