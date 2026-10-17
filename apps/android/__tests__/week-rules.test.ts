// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Drawing the week (#28): which version a drawing edits, what a tap with each
// pen does, the course a class's slots go to, and the totals. Made-up
// schools and classes only.

import { parseDay, type SchoolClass, type TimetableVersion } from '@minhajna/core';
import { openTestData, type TestData } from '../jest/app-data';
import {
  classLoads,
  contentOf,
  courseFor,
  holds,
  paint,
  versionToDraw,
  type Brush,
  type Cell,
} from '../src/week/week-rules';

const day = parseDay('2026-10-15');
const classes: SchoolClass[] = ['4م1', '4م2'].map((name, at) => ({
  id: `k-${at + 1}`,
  schoolId: 's-1',
  level: 'cem',
  grade: '4am',
  name,
  groups: [{ id: `g-${at + 1}`, kind: 'whole', name }],
}));
let next = 0;
const newId = () => `id-${++next}`;

async function withClasses(): Promise<TestData> {
  const data = await openTestData();
  await data.book.record(day, {
    kind: 'school.set',
    school: { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic', 'islamic'], zone: '16' },
  });
  for (const schoolClass of classes) await data.book.record(day, { kind: 'class.set', schoolClass });
  await data.book.record(day, {
    kind: 'course.set',
    course: { id: 'c-1', classId: 'k-1', subject: 'islamic', year: '2026-2027', pack: null },
  });
  return data;
}

const empty: TimetableVersion = { id: 'v-1', from: day, entries: [], blocks: [], source: 'hand' };
const classOf = (courseId: string) => (courseId === 'c-1' ? classes[0] : courseId === 'c-2' ? classes[1] : undefined);
const mon1: Cell = { weekday: 1, slot: { half: 'morning', index: 1 } };
const courses = { 'k-1': { id: 'c-1', classId: 'k-1', subject: 'islamic', year: '2026-2027', pack: null } };
const tap = (version: TimetableVersion, brush: Brush, cell = mon1) =>
  paint(version, classOf, cell, brush, {
    schoolClass: brush.kind === 'class' ? classes.find((item) => item.id === brush.classId) : undefined,
    course:
      brush.kind === 'class' && brush.classId === 'k-1'
        ? courses['k-1']
        : { ...courses['k-1'], id: 'c-2', classId: 'k-2' },
    ownLabel: 'وقت خاص',
    newId,
  });

test('starts the first week with the school year, and a later one on the day it is drawn', async () => {
  const data = await withClasses();
  const first = versionToDraw(data.book.state, data.year, day, newId);
  expect(first).toMatchObject({ from: data.year.from, entries: [], blocks: [], source: 'hand' });
  await data.book.record(parseDay('2026-09-10'), {
    kind: 'timetable.set',
    version: { ...first, from: data.year.from, entries: tap(empty, { kind: 'class', classId: 'k-1' }).entries },
  });
  const later = versionToDraw(data.book.state, data.year, day, newId);
  expect(later.id).not.toBe(first.id);
  expect(later.from).toBe(day);
  expect(later.entries).toHaveLength(1);
});

test('keeps editing the version drawn today, from where it starts', async () => {
  const data = await withClasses();
  const first = versionToDraw(data.book.state, data.year, day, newId);
  await data.book.record(day, { kind: 'timetable.set', version: { ...first, options: { saturday: true } } });
  const again = versionToDraw(data.book.state, data.year, day, newId);
  expect(again).toMatchObject({ id: first.id, from: data.year.from, options: { saturday: true } });
});

test('puts a class in a slot, whole and every week, and clears it with a second tap of the same pen', () => {
  const drawn = tap(empty, { kind: 'class', classId: 'k-1' });
  expect(drawn.entries).toEqual([
    expect.objectContaining({ weekday: 1, courseId: 'c-1', groupId: 'g-1', weeks: 'every', sessionType: 'lesson' }),
  ]);
  expect(contentOf(drawn, classOf, mon1)).toEqual({ kind: 'class', classId: 'k-1', name: '4م1' });
  const replaced = tap(drawn, { kind: 'class', classId: 'k-2' });
  expect(replaced.entries.map((entry) => entry.courseId)).toEqual(['c-2']);
  expect(tap(replaced, { kind: 'class', classId: 'k-2' }).entries).toEqual([]);
});

test("draws the teacher's own time in one slot, and erases a slot or a whole half-day's time", () => {
  const own = tap(tap(empty, { kind: 'class', classId: 'k-1' }), { kind: 'own' });
  expect(own.entries).toEqual([]);
  expect(own.blocks).toEqual([{ weekday: 1, half: 'morning', index: 1, label: 'وقت خاص' }]);
  expect(tap(own, { kind: 'own' }).blocks).toEqual([]);
  const halfDay = { ...empty, blocks: [{ weekday: 1 as const, half: 'morning' as const, label: 'نصف يوم' }] };
  expect(contentOf(halfDay, classOf, mon1)).toEqual({ kind: 'own', label: 'نصف يوم' });
  expect(tap(halfDay, { kind: 'erase' }).blocks).toEqual([]);
});

test("finds a class's course for the year in any of the school's subjects, or makes one in the first", async () => {
  const data = await withClasses();
  expect(courseFor(data.book.state, classes[0], data.year, newId)).toEqual({ course: courses['k-1'], isNew: false });
  const made = courseFor(data.book.state, classes[1], data.year, newId);
  expect(made.isNew).toBe(true);
  expect(made.course).toMatchObject({ classId: 'k-2', subject: 'arabic', year: data.year.id, pack: null });
});

test('finds or makes the course of a class in a named subject, for a teacher of two subjects', async () => {
  const data = await withClasses();
  expect(courseFor(data.book.state, classes[0], data.year, newId, 'islamic')).toEqual({
    course: courses['k-1'],
    isNew: false,
  });
  const arabic = courseFor(data.book.state, classes[0], data.year, newId, 'arabic');
  expect(arabic).toMatchObject({ isNew: true, course: { classId: 'k-1', subject: 'arabic' } });
});

test('counts each class a week in the order of the classes, and says what sits on Saturday', () => {
  let version = empty;
  for (const weekday of [0, 1, 2] as const) {
    version = tap(version, { kind: 'class', classId: 'k-2' }, { weekday, slot: { half: 'morning', index: 1 } });
  }
  version = tap(version, { kind: 'class', classId: 'k-1' }, { weekday: 6, slot: { half: 'afternoon', index: 2 } });
  expect(classLoads(version, classOf, classes)).toEqual({
    loads: [
      { name: '4م1', count: 1 },
      { name: '4م2', count: 3 },
    ],
    total: 4,
  });
  expect(holds(version, (weekday) => weekday === 6)).toBe(true);
  expect(holds(version, (_, slot) => slot.index === 5)).toBe(false);
});
