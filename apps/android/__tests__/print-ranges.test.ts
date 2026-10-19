// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which pages each document of the week's print set covers (#215,
// R-3.8-55): the journal's days with a session since its last print, a
// month or two dates; the roll-call book's months, a month printed part-way
// offered again; a print made ahead never hiding what is new; each journal
// counting its own sessions' days only; the year's documents until printed,
// before the year too; the timetable's version until printed; and the
// strip, not in the set. The teacher has 4م1 and 4م2 on Thursdays from 11
// October 2026. Made-up records only.

import { parseDay, type RecordEvent } from '@minhajna/core';
import type { TestData } from '../jest/app-data';
import { withSpecialist } from '../jest/specialist-classes';
import { withDay } from '../jest/today-day';
import type { DocumentData } from '../src/documents/document-data';
import { covered } from '../src/documents/print-ranges';

const d = parseDay;

const documentData = (data: TestData, day = '2026-10-23'): DocumentData => ({
  state: data.book.state,
  profile: data.profile,
  year: data.year,
  calendar: data.calendar,
  packs: data.packs,
  bells: data.bells,
  day: d(day),
  lang: 'ar',
  dir: 'rtl',
});

const printed = (data: TestData, on: string, id: string, from: string, to: string) =>
  data.book.record(d(on), {
    kind: 'print.recorded',
    print: { id: `p-${on}-${id}`, documents: [{ id, from: d(from), to: d(to) }] },
  } satisfies RecordEvent);

test('the journal: each day with a session since its last print, up to today, then nothing new', async () => {
  const data = await withDay();
  expect(covered(documentData(data), data.book.state, 'journal', { kind: 'new' })).toEqual({
    days: ['2026-10-15', '2026-10-22'],
    printed: { id: 'journal', from: '2026-09-21', to: '2026-10-23' },
  });
  await printed(data, '2026-10-16', 'journal', '2026-10-11', '2026-10-16');
  expect(covered(documentData(data), data.book.state, 'journal', { kind: 'new' })?.days).toEqual(['2026-10-22']);
  await printed(data, '2026-10-23', 'journal', '2026-10-17', '2026-10-23');
  expect(covered(documentData(data), data.book.state, 'journal', { kind: 'new' })).toBeNull();
});

test('the journal for a month, ahead of time too, or between two dates, within the school year, holidays left out', async () => {
  const data = await withDay();
  const state = data.book.state;
  expect(covered(documentData(data), state, 'journal', { kind: 'month', month: '2026-10' })).toEqual({
    days: ['2026-10-15', '2026-10-22'],
    printed: { id: 'journal', from: '2026-10-01', to: '2026-10-31' },
  });
  const days = { kind: 'days', from: d('2026-10-20'), to: d('2026-11-05') } as const;
  expect(covered(documentData(data), state, 'journal', days)?.days).toEqual(['2026-10-22', '2026-11-05']);
  expect(covered(documentData(data), state, 'journal', { kind: 'month', month: '2026-08' })).toBeNull();
  expect(
    covered(documentData(data), state, 'journal', { kind: 'days', from: d('2026-10-20'), to: d('2026-10-10') }),
  ).toBeNull();
  expect(
    covered(documentData(data), state, 'journal', { kind: 'days', from: d('2026-10-16'), to: d('2026-10-21') }),
  ).toBeNull();
});

test('the roll-call book: each month since its last print, a month printed part-way offered again', async () => {
  const data = await withDay();
  expect(covered(documentData(data), data.book.state, 'roll', { kind: 'new' })).toEqual({
    days: ['2026-09-21', '2026-10-01'],
    printed: { id: 'roll', from: '2026-09-21', to: '2026-10-23' },
  });
  await printed(data, '2026-10-16', 'roll', '2026-09-21', '2026-10-16');
  expect(covered(documentData(data), data.book.state, 'roll', { kind: 'new' })).toEqual({
    days: ['2026-10-01'],
    printed: { id: 'roll', from: '2026-10-01', to: '2026-10-23' },
  });
  await printed(data, '2026-10-23', 'roll', '2026-10-01', '2026-10-23');
  expect(covered(documentData(data), data.book.state, 'roll', { kind: 'new' })).toBeNull();
  expect(covered(documentData(data), data.book.state, 'roll', { kind: 'month', month: '2026-11' })).toEqual({
    days: ['2026-11-01'],
    printed: { id: 'roll', from: '2026-11-01', to: '2026-11-30' },
  });
});

test('a print made ahead never hides what is new once its days come', async () => {
  const data = await withDay();
  await printed(data, '2026-10-16', 'journal', '2026-10-11', '2026-11-30');
  expect(covered(documentData(data, '2026-11-06'), data.book.state, 'journal', { kind: 'new' })).toEqual({
    days: ['2026-10-22', '2026-11-05'],
    printed: { id: 'journal', from: '2026-10-17', to: '2026-11-06' },
  });
});

test('each journal counts only the days of its own sessions', async () => {
  const data = await withSpecialist();
  expect(covered(documentData(data), data.book.state, 'specialist-journal', { kind: 'new' })?.days).toEqual([
    '2026-10-15',
    '2026-10-22',
  ]);
  expect(covered(documentData(data), data.book.state, 'journal', { kind: 'new' })).toBeNull();
  expect(covered(documentData(data), data.book.state, 'primary-journal', { kind: 'new' })).toBeNull();
});

test('a document of the year is new until printed this school year; the timetable, until its version is', async () => {
  const data = await withDay();
  expect(covered(documentData(data), data.book.state, 'supervised', { kind: 'new' })).toEqual({
    days: ['2026-10-23'],
    printed: { id: 'supervised', from: '2026-09-21', to: '2026-10-23' },
  });
  expect(covered(documentData(data, '2026-09-10'), data.book.state, 'supervised', { kind: 'new' })?.printed).toEqual({
    id: 'supervised',
    from: '2026-09-21',
    to: '2026-09-21',
  });
  await printed(data, '2026-09-10', 'supervised', '2026-09-21', '2026-09-21');
  expect(covered(documentData(data, '2026-09-25'), data.book.state, 'supervised', { kind: 'new' })).toBeNull();
  expect(covered(documentData(data), data.book.state, 'supervised', { kind: 'new' })).toBeNull();
  expect(
    covered(documentData(data), data.book.state, 'supervised', { kind: 'month', month: '2026-10' }),
  ).not.toBeNull();
  expect(covered(documentData(data), data.book.state, 'timetable', { kind: 'new' })).toEqual({
    days: ['2026-10-23'],
    printed: { id: 'timetable', from: '2026-10-11', to: '2026-10-11' },
  });
  await printed(data, '2026-10-01', 'timetable', '2026-10-11', '2026-10-11');
  expect(covered(documentData(data), data.book.state, 'timetable', { kind: 'new' })).toBeNull();
  const version = data.book.state.timetables[0].version;
  await data.book.record(d('2026-10-24'), {
    kind: 'timetable.set',
    version: { ...version, id: 'v-2', from: d('2026-10-25') },
  });
  expect(covered(documentData(data, '2026-10-26'), data.book.state, 'timetable', { kind: 'new' })?.printed).toEqual({
    id: 'timetable',
    from: '2026-10-25',
    to: '2026-10-25',
  });
  await printed(data, '2026-10-26', 'timetable', '2026-10-25', '2026-10-25');
  await printed(data, '2026-10-26', 'timetable', '2026-11-02', '2026-11-02');
  await data.book.record(d('2026-10-27'), {
    kind: 'timetable.set',
    version: { ...version, id: 'v-3', from: d('2026-10-27') },
  });
  expect(covered(documentData(data, '2026-10-27'), data.book.state, 'timetable', { kind: 'new' })?.printed.from).toBe(
    '2026-10-27',
  );
});

test('the cut-out strip is not in the set', async () => {
  const data = await withDay();
  expect(covered(documentData(data), data.book.state, 'strip', { kind: 'new' })).toBeNull();
});
