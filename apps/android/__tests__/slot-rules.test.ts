// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One slot of the week (#28, Week-slot): what it holds, A/B pairs, the
// teacher's own time for a slot or a half-day, half-groups made once, and a
// primary slot's activity type kept (#230).
// Made-up classes only.

import { parseDay, type Course, type SchoolClass, type TimetableVersion } from '@minhajna/core';
import { itemsAt, otherWeek, setItems, withActivity, withHalves, type SlotItem } from '../src/week/slot-rules';
import type { Cell } from '../src/week/week-rules';

const day = parseDay('2026-10-15');
const tue2: Cell = { weekday: 2, slot: { half: 'morning', index: 2 } };
const courses: Record<string, Course> = {
  'c-ar': { id: 'c-ar', classId: 'k-1', subject: 'arabic', year: '2026-2027', pack: null },
  'c-is': { id: 'c-is', classId: 'k-1', subject: 'islamic', year: '2026-2027', pack: null },
};
const lookup = { course: (id: string) => courses[id] };
let next = 0;
const make = {
  courseId: (classId: string, subject: string) => `c-${subject.slice(0, 2)}`,
  newId: () => `id-${++next}`,
};
const base: TimetableVersion = {
  id: 'v-1',
  from: day,
  entries: [
    {
      id: 'e-1',
      weekday: 2,
      slot: { half: 'morning', index: 2 },
      courseId: 'c-ar',
      groupId: 'g-1',
      weeks: 'A',
      sessionType: 'td',
      room: '12',
    },
    {
      id: 'e-2',
      weekday: 2,
      slot: { half: 'morning', index: 1 },
      courseId: 'c-ar',
      groupId: 'w',
      weeks: 'every',
      sessionType: 'lesson',
    },
  ],
  blocks: [{ weekday: 2, half: 'morning', index: 2, weeks: 'B', kind: 'duty', label: 'Duty' }],
  source: 'hand',
};

test('reads what a slot holds: a session with its subject, group, weeks and room, and own time with its kind', () => {
  expect(itemsAt(base, lookup, tue2)).toEqual([
    { kind: 'class', classId: 'k-1', subject: 'arabic', groupId: 'g-1', weeks: 'A', sessionType: 'td', room: '12' },
    { kind: 'own', ownKind: 'duty', halfDay: false, weeks: 'B', label: 'Duty' },
  ]);
  expect(otherWeek('A')).toBe('B');
});

test('replaces only the slot, with a half-group of each subject in alternate weeks', () => {
  const items: SlotItem[] = [
    {
      kind: 'class',
      classId: 'k-1',
      subject: 'islamic',
      groupId: 'g-1',
      weeks: 'A',
      sessionType: 'lesson',
      room: ' 7 ',
    },
    { kind: 'class', classId: 'k-1', subject: 'arabic', groupId: 'g-2', weeks: 'B', sessionType: 'lesson', room: ' ' },
  ];
  const after = setItems(base, tue2, items, make);
  expect(after.blocks).toEqual([]);
  expect(
    after.entries.map((entry) => [entry.slot.index, entry.courseId, entry.groupId, entry.weeks, entry.room]),
  ).toEqual([
    [1, 'c-ar', 'w', 'every', undefined],
    [2, 'c-is', 'g-1', 'A', '7'],
    [2, 'c-ar', 'g-2', 'B', undefined],
  ]);
  expect(itemsAt(after, lookup, tue2)).toHaveLength(2);
});

test("draws the teacher's own time over the whole half-day, and clears it from any of its slots", () => {
  const halfDay = setItems(
    base,
    tue2,
    [{ kind: 'own', ownKind: 'pedagogical', halfDay: true, weeks: 'every', label: 'Half-day' }],
    make,
  );
  expect(halfDay.blocks).toEqual([{ weekday: 2, half: 'morning', kind: 'pedagogical', label: 'Half-day' }]);
  const first: Cell = { weekday: 2, slot: { half: 'morning', index: 1 } };
  expect(itemsAt(halfDay, lookup, first).map((item) => item.kind)).toEqual(['class', 'own']);
  expect(setItems(halfDay, { weekday: 2, slot: { half: 'morning', index: 4 } }, [], make).blocks).toEqual([]);
});

test('keeps a primary slot’s activity type through reading and saving, and takes it off when asked (#230)', () => {
  const reading = {
    ...base,
    entries: [{ ...base.entries[0], weeks: 'every' as const, sessionType: 'lesson', activity: 'reading' }],
  };
  const [item] = itemsAt(reading, lookup, tue2);
  expect(item).toMatchObject({ kind: 'class', activity: 'reading' });
  expect(setItems(reading, tue2, [item], make).entries[0]?.activity).toBe('reading');
  const plain = item?.kind === 'class' ? withActivity(item, undefined) : item;
  expect(plain).not.toHaveProperty('activity');
  expect(setItems(reading, tue2, [plain], make).entries[0]).not.toHaveProperty('activity');
});

test('gives a class two half-groups once, keeping its whole group', () => {
  let id = 0;
  const schoolClass: SchoolClass = {
    id: 'k-1',
    schoolId: 's-1',
    level: 'cem',
    grade: '4am',
    name: '4م1',
    groups: [{ id: 'w', kind: 'whole', name: '4م1' }],
  };
  const split = withHalves(schoolClass, ['الفوج 1', 'الفوج 2'], () => `g-${++id}`);
  expect(split.added).toBe(true);
  expect(split.schoolClass.groups).toEqual([
    { id: 'w', kind: 'whole', name: '4م1' },
    { id: 'g-1', kind: 'half', name: 'الفوج 1' },
    { id: 'g-2', kind: 'half', name: 'الفوج 2' },
  ]);
  expect(withHalves(split.schoolClass, ['الفوج 1', 'الفوج 2'], () => 'g-x')).toEqual({
    schoolClass: split.schoolClass,
    added: false,
  });
});
