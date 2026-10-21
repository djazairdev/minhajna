// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The session slip's words (#217, Roll-print, answers 254 and 264): the
// subject of the roll call's own session when the teacher has two courses
// with the class, the latest version of a corrected roll call with a pupil
// named after moving group, and two half groups in one slot told apart by
// their chips and working names. 4م1 has 45 made-up pupils.

import {
  parseDay,
  rollCallUnits,
  takeRollCall,
  type Day,
  type RollCallUnit,
  type TimetableEntry,
} from '@minhajna/core';
import type { TestData } from '../jest/app-data';
import { withPupils } from '../jest/roll-class';
import type { DocumentData } from '../src/documents/document-data';
import { rollOutput } from '../src/documents/roll-print-output';
import { rollSlipPages, slipLabel, slipUnits } from '../src/documents/roll-slip';
import { rollBooks } from '../src/documents/roll-spread-pages';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';

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

const entry = (id: string, index: number, courseId: string, groupId: string) =>
  ({
    id,
    weekday: 4,
    slot: { half: index > 4 ? 'afternoon' : 'morning', index: index > 4 ? index - 4 : index },
    courseId,
    groupId,
    weeks: 'every',
    sessionType: 'lesson',
  }) satisfies TimetableEntry;

/** 4م1 with half groups k-1-a (p-1, p-2) and k-1-b (p-3), and the entries given from 11 October. */
async function withGroups(entries: TimetableEntry[], courses: { id: string; subject: string }[] = []) {
  const data = await withPupils();
  const schoolClass = data.book.state.classes.get('k-1')!;
  const pupil = (id: string) => data.book.state.pupils.get(id)!;
  await data.book.recordAll(parseDay('2026-10-11'), [
    {
      kind: 'class.set',
      schoolClass: {
        ...schoolClass,
        groups: [
          ...schoolClass.groups,
          { id: 'k-1-a', kind: 'half', name: 'الفوج 1' },
          { id: 'k-1-b', kind: 'half', name: 'الفوج 2' },
        ],
      },
    },
    ...['p-1', 'p-2'].map((id) => ({ kind: 'pupil.set' as const, pupil: { ...pupil(id), groups: ['k-1-a'] } })),
    { kind: 'pupil.set', pupil: { ...pupil('p-3'), groups: ['k-1-b'] } },
    ...courses.map((course) => ({
      kind: 'course.set' as const,
      course: { ...course, classId: 'k-1', year: '2026-2027', pack: null },
    })),
    {
      kind: 'timetable.set',
      version: { id: 'v-2', from: parseDay('2026-10-11'), source: 'hand', entries, blocks: [] },
    },
  ]);
  return data;
}

const unitFor = (data: TestData, courseId: string, groupId: string) =>
  rollCallUnits(coreContext(documentData(data)), 'k-1', DAY, DAY).find(
    (unit) => unit.groupId === groupId && unit.sessions[0]?.courseId === courseId,
  )!;

async function take(data: TestData, unit: RollCallUnit, absent: string[], late: string[], reason?: string) {
  const marks = { absent: absent.map((pupilId) => ({ pupilId, justified: false })), late };
  await data.book.record(DAY, takeRollCall(coreContext(documentData(data)), unit, marks, reason));
}

const bookOf = (d: DocumentData) => rollBooks(d).find((one) => one.classId === 'k-1')!;
const subject = (data: TestData, code: string) => data.profile.subjects.find((one) => one.code === code)!.name.ar;

test('with two courses for the class, the slip names its own session’s subject', async () => {
  const data = await withGroups(
    [entry('e-1', 1, 'c-1', 'k-1-w'), entry('e-5', 5, 'c-3', 'k-1-w')],
    [{ id: 'c-3', subject: 'math' }],
  );
  await take(data, unitFor(data, 'c-3', 'k-1-w'), ['p-4'], []);
  await take(data, unitFor(data, 'c-1', 'k-1-w'), [], []);
  const d = documentData(data);
  expect(bookOf(d).subject).toBeNull();
  const math = rollSlipPages(d, t, bookOf(d), unitFor(data, 'c-3', 'k-1-w'));
  const arabic = rollSlipPages(d, t, bookOf(d), unitFor(data, 'c-1', 'k-1-w'));
  expect(math).toContain(`4م1 · ${subject(data, 'math')} · `);
  expect(arabic).toContain(`4م1 · ${subject(data, 'arabic')} · `);
});

test('a corrected roll call prints its latest version, naming a pupil who has since moved group', async () => {
  const data = await withGroups([entry('e-6', 5, 'c-1', 'k-1-a')]);
  const unit = unitFor(data, 'c-1', 'k-1-a');
  await take(data, unit, ['p-2'], []);
  await take(data, unit, ['p-2'], ['p-1'], 'تصحيح');
  const moved = data.book.state.pupils.get('p-2')!;
  await data.book.record(DAY, { kind: 'pupil.set', pupil: { ...moved, groups: ['k-1-b'] } });
  const d = documentData(data);
  const html = rollSlipPages(d, t, bookOf(d), unit);
  const rows = [...html.matchAll(/<tr><td class="n">(\d+)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)];
  expect(rows.map((row) => [row[1], row[2], row[3]])).toEqual([
    ['1', data.book.state.pupils.get('p-1')!.name, text.rollPrint.slip.late],
    ['2', moved.name, text.rollPrint.slip.absent],
  ]);
  expect(html).toContain('الفوج 1');
});

test('two half groups in one slot are told apart by their chips and working names', async () => {
  const data = await withGroups([entry('e-6', 5, 'c-1', 'k-1-a'), entry('e-7', 5, 'c-1', 'k-1-b')]);
  await take(data, unitFor(data, 'c-1', 'k-1-a'), [], []);
  await take(data, unitFor(data, 'c-1', 'k-1-b'), [], []);
  const d = documentData(data);
  const book = bookOf(d);
  const units = slipUnits(d, book, DAY);
  expect(units).toHaveLength(2);
  const labels = units.map((unit) => slipLabel(d, t, unit));
  expect(labels[0]).toContain('الفوج 1');
  expect(labels[1]).toContain('الفوج 2');
  const made = units.map(
    (unit) =>
      rollOutput(d, t, { choice: 'slip', book, name: '4م1', blank: false, month: '2026-10', day: DAY, unit }).made,
  );
  expect(new Set(made).size).toBe(2);
  for (const name of made) expect(name).toMatch(/^[a-z0-9-]{1,64}$/);
});
