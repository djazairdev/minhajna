// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseDay } from '@minhajna/core';
import { calendarData, calendarEntry } from '../jest/calendar-data';
import { adjacentMonth, calendarWeeks, inMonth, schoolEntries } from '../src/calendar/view';

test('scopes all four layers to the selected school, wilaya, level and saved grades', async () => {
  const data = await calendarData();
  const query = { ...data, state: data.book.state };
  const ids = (school: string) => schoolEntries(query, school).map(({ entry, origin }) => `${origin}:${entry.id}`);
  expect(ids('s-1')).toEqual([
    'bundled:cem',
    'local:private',
    'bundled:same-id',
    'local:same-id',
    'local:school-1',
    'bundled:zone-16',
    'bundled:span',
  ]);
  expect(ids('s-2')).toEqual([
    'bundled:cem',
    'local:private',
    'bundled:same-id',
    'local:school-2',
    'bundled:zone-31',
    'bundled:span',
  ]);
  expect(ids('missing')).toEqual([]);
});

test('does not hide a spanning entry in either month and keeps its real dates and confidence', async () => {
  const data = await calendarData();
  const before = [...data.book.entries];
  const rows = schoolEntries({ ...data, state: data.book.state }, 's-1');
  for (const month of ['2026-10', '2026-11']) {
    expect(inMonth(rows, month).find(({ entry }) => entry.id === 'span')?.entry).toEqual(data.calendar[1]);
  }
  expect(inMonth(rows, '2026-12')).toEqual([]);
  expect(data.book.entries).toEqual(before);
});

test('keeps origins separate when IDs collide and never resurrects removed local entries', async () => {
  const data = await calendarData();
  const rows = schoolEntries({ ...data, state: data.book.state }, 's-1');
  expect(rows.filter(({ entry }) => entry.id === 'same-id').map(({ origin }) => origin)).toEqual(['bundled', 'local']);
  expect(rows.some(({ entry }) => entry.id === 'removed')).toBe(false);
});

test('includes dates for every level of a joint class, not just its first grade', async () => {
  const data = await calendarData();
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'school.set',
      school: { id: 'primary', name: 'ابتدائية تجريبية', levels: ['primary'], subjects: ['arabic'], zone: '16' },
    },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'joint',
        schoolId: 'primary',
        level: 'primary',
        grade: '3ap',
        name: 'قسم مشترك تجريبي',
        groups: [
          { id: 'g3', kind: 'level', name: '3AP', grade: '3ap' },
          { id: 'g4', kind: 'level', name: '4AP', grade: '4ap' },
          { id: 'g5', kind: 'level', name: '5AP', grade: '5ap' },
        ],
      },
    },
  ]);
  const calendar = ['2ap', '3ap', '4ap', '5ap'].map((grade) =>
    calendarEntry(grade, { levels: ['primary'], grades: [grade] }),
  );
  expect(
    schoolEntries({ ...data, calendar, state: data.book.state }, 'primary')
      .filter((row) => row.origin === 'bundled')
      .map((row) => row.entry.id),
  ).toEqual(['3ap', '4ap', '5ap']);
});

test('excludes entries outside the active school year without inventing substitute dates', async () => {
  const data = await calendarData();
  const calendar = [calendarEntry('old', { from: parseDay('2025-01-01'), to: parseDay('2025-01-02') })];
  expect(
    schoolEntries({ ...data, calendar, state: data.book.state }, 's-1').every(({ origin }) => origin === 'local'),
  ).toBe(true);
});

test.each([
  ['2026-01', -1, '2025-12'],
  ['2026-12', 1, '2027-01'],
  ['2028-02', 1, '2028-03'],
  ['2028-03', -1, '2028-02'],
] as const)('navigates civil months: %s / %s', (month, step, next) => {
  expect(adjacentMonth(month, step)).toBe(next);
});

test('lays out leap February with the country weekday, without time zones', () => {
  const sunday = calendarWeeks('2028-02', 0);
  const monday = calendarWeeks('2028-02', 1);
  expect(sunday[0][0]).toBe('2028-01-30');
  expect(monday[0][0]).toBe('2028-01-31');
  expect(sunday.every((week) => week.length === 7)).toBe(true);
  expect(sunday.flat()).toContain('2028-02-29');
  expect(sunday.at(-1)?.at(-1)).toBe('2028-03-04');
});
