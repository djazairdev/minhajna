// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll-call book's monthly spread from the record (#217, Roll-print,
// answers 253 and 261): a justified absence's date with «م», «ح-ك» given a
// column when a newcomer's differs, the days before counting starts dotted
// with no mark and said under the table, a weekend roll call printed white
// with its mark, and one book for each class. The
// teacher has 4م1, with 45 made-up pupils, on Thursdays from 11 October 2026,
// and today is Sunday 18 October.

import { DEFAULT_COUNTING, parseDay, type Day } from '@minhajna/core';
import type { TestData } from '../jest/app-data';
import { unitKey, withPupils } from '../jest/roll-class';
import type { DocumentData } from '../src/documents/document-data';
import { rollBooks, rollSpreadPages } from '../src/documents/roll-spread-pages';
import { i18n } from '../src/text/i18n';

const t = i18n.getFixedT('ar');
const DAY = '2026-10-15' as Day;
const ROW = 'style="height:3.68mm"';

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

const taken = (absent: { pupilId: string; justified: boolean }[]) => ({
  kind: 'roll-call.taken' as const,
  rollCall: {
    unit: unitKey(1),
    classId: 'k-1',
    groupId: 'k-1-w',
    day: DAY,
    half: 'morning' as const,
    absent,
    late: [],
  },
});

const pages = (data: TestData) =>
  rollSpreadPages(documentData(data), t, false, '2026-10', [rollBooks(documentData(data))[0]])
    .split('<section class="page"')
    .slice(1);

test('a justified absence prints in brackets, its date with «م»', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay(DAY), [taken([{ pupilId: 'p-3', justified: true }])]);
  const [first, second] = pages(data);
  expect(first).toContain(`<td ${ROW}>(-)</td>`);
  expect(second).toContain(`<td class="wrap" ${ROW}>15م</td>`);
});

test('a newcomer whose possible attendance differs gives «ح-ك» a column', async () => {
  const data = await withPupils();
  const pupil = data.book.state.pupils.get('p-45')!;
  await data.book.recordAll(parseDay(DAY), [
    taken([]),
    {
      kind: 'pupil.set',
      pupil: { ...pupil, movements: [{ day: parseDay('2026-10-16'), kind: 'in', reason: 'transfer' }] },
    },
  ]);
  const [, second] = pages(data);
  expect(second).toContain('<th>ح-ك</th><th>غ</th><th>ح-ف</th>');
  expect(second).toContain(`<td ${ROW}>1</td><td ${ROW}>0</td><td ${ROW}>1</td>`);
  expect(second).toContain('المجموع');
  expect(second).not.toContain('لكل تلميذ');
});

test('days before counting starts are dotted with no mark, and the start is said under the table', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay(DAY), [
    taken([{ pupilId: 'p-3', justified: false }]),
    { kind: 'counting.set', rules: { ...DEFAULT_COUNTING, from: parseDay('2026-10-16') } },
  ]);
  const [first, second] = pages(data);
  expect(first).toContain('<th class="none"><bdi>15</bdi></th>');
  expect(first).not.toContain(`>-</td>`);
  expect(second).toContain('يبدأ العدّ في \u206616/10\u2069');
});

test('a roll call on a weekend, as on a make-up day, prints white with its mark, not grey', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay('2026-10-17'), [
    {
      kind: 'roll-call.taken',
      rollCall: {
        unit: 'session:c-1/2026-10-17/m1/k-1-w',
        classId: 'k-1',
        groupId: 'k-1-w',
        day: parseDay('2026-10-17'),
        half: 'morning',
        absent: [{ pupilId: 'p-3', justified: false }],
        late: [],
      },
    },
  ]);
  const [first] = pages(data);
  expect(first).toContain('<th class="off"><bdi>16</bdi></th><th><bdi>17</bdi></th>');
  expect(first).toContain(`<td ${ROW}>-</td>`);
  expect(first).toContain('م بعد تاريخ: غياب مبرر');
});

test('each class is a book of its own, by name', async () => {
  const books = rollBooks(documentData(await withPupils()));
  expect(books).toEqual([
    { classId: 'k-1', groupId: 'k-1-w', subject: 'arabic' },
    { classId: 'k-2', groupId: 'k-2-w', subject: 'arabic' },
  ]);
});
