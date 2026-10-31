// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Accepting a school's timetable package into the teacher's week (#580, answer
// 608): the package's bell times split into morning and afternoon at the lunch
// break, else as the week's morning, else at noon; every session placed makes a
// new version from the day given, with that school's classes from the package
// on the slots they span, their groups, weeks and rooms, and the other school's
// sessions, the teacher's own time and the options kept, and the school takes
// the package's bell times; a session with no class, group, course or slots is
// named and nothing is accepted, as is a class's only course when the package
// names another known subject; without bell times the school's own times place
// it; and both weeks read with a lesson's sessions in a row joined, even
// between week A and B or other groups, and the course's label, so only real
// changes differ. Every school, class and teacher is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  acceptPackage,
  drawnRows,
  packageRows,
  packageSlots,
  parseDay,
  unplacedOf,
  weekDifferences,
  type PackagePlace,
  type Slot,
  type TimetableEntry,
  type TimetablePart,
  type Weekday,
} from '../src/index.ts';

const hours = (...starts: number[]): TimetablePart['bells'] => starts.map((hour) => [hour * 60, hour * 60 + 60]);
const BELLS = hours(8, 9, 10, 11, 13, 14);
const NAMES: Record<string, string[]> = {
  arabic: ['اللغة العربية', 'Arabe'],
  math: ['رياضيات', 'Mathématiques'],
  physics: ['فيزياء', 'Physique'],
};
const SLOTS: Slot[] = [1, 2, 3, 4].flatMap((index) => [
  { half: 'morning' as const, index },
  { half: 'afternoon' as const, index },
]);
const entry = (
  id: string,
  weekday: Weekday,
  slot: Slot,
  courseId: string,
  groupId: string,
  weeks: TimetableEntry['weeks'] = 'every',
): TimetableEntry => ({ id, weekday, slot, courseId, groupId, weeks, sessionType: 'lesson' });
const session = (id: string, change: Partial<TimetablePart['sessions'][number]>) => ({
  id: id.repeat(32),
  class: '4م1',
  group: '',
  subject: 'اللغة العربية',
  day: 0 as const,
  start: 480,
  end: 600,
  room: '',
  week: 'both' as const,
  ...change,
});

function place(change: Partial<PackagePlace> = {}, sessions = [session('a', {}), session('b', {})]): PackagePlace {
  const part = {
    world: 'K7QF4',
    school: 'S'.repeat(22),
    schoolName: 'متوسطة المختلقة',
    assignment: 'c'.repeat(32),
    issue: 1,
    teacher: 'مختلق',
    version: 1,
    from: parseDay('2026-12-06'),
    once: false,
    sessions,
    bells: BELLS,
  } satisfies TimetablePart;
  const whole = (id: string, name: string) => ({ id, kind: 'whole' as const, name });
  return {
    part,
    school: { id: 's-1', name: 'متوسطة المختلقة', levels: ['cem'], subjects: ['arabic', 'math'] },
    classes: [
      { id: 'k-1', schoolId: 's-1', level: 'cem', grade: '4am', name: '4م1', groups: [whole('g-1', '4م1')] },
      {
        id: 'k-2',
        schoolId: 's-1',
        level: 'cem',
        grade: '4am',
        name: '4م2',
        groups: [whole('g-2', '4م2'), { id: 'g-3', kind: 'half', name: 'G1' }],
      },
      { id: 'k-9', schoolId: 's-2', level: 'cem', grade: '4am', name: '4م1', groups: [whole('g-9', '4م1')] },
    ],
    courses: [
      { id: 'c-1', classId: 'k-1', subject: 'arabic', year: '2026-2027', pack: null },
      { id: 'c-2', classId: 'k-2', subject: 'arabic', year: '2026-2027', pack: null },
      { id: 'c-3', classId: 'k-2', subject: 'math', year: '2026-2027', pack: null },
      { id: 'c-9', classId: 'k-9', subject: 'arabic', year: '2026-2027', pack: null },
    ],
    drawn: {
      id: 'v-1',
      from: parseDay('2026-09-21'),
      source: 'hand',
      options: { saturday: true },
      blocks: [{ weekday: 3, half: 'afternoon', label: 'Made-up' }],
      entries: [
        entry('e-1', 0, SLOTS[0]!, 'c-1', 'g-1'),
        entry('e-2', 0, SLOTS[2]!, 'c-1', 'g-1'),
        entry('e-9', 2, SLOTS[0]!, 'c-9', 'g-9'),
      ],
    },
    slots: SLOTS,
    times: (slot) => {
      const start = (slot.half === 'morning' ? 480 : 780) + (slot.index - 1) * 60;
      return { from: `${String(start / 60).padStart(2, '0')}:00`, to: `${String(start / 60 + 1).padStart(2, '0')}:00` };
    },
    subjects: Object.keys(NAMES),
    subjectNames: (code) => NAMES[code] ?? [],
    subjectLabel: (code) => NAMES[code]?.[0] ?? code,
    sessionType: 'lesson',
    ...change,
  };
}

describe('a timetable package in the teacher’s week', () => {
  it('splits the bell times at the lunch break, or at noon', () => {
    assert.deepEqual(
      packageSlots(BELLS)!.map((one) => `${one.half} ${one.index} ${one.from}`),
      [
        'morning 1 08:00',
        'morning 2 09:00',
        'morning 3 10:00',
        'morning 4 11:00',
        'afternoon 1 13:00',
        'afternoon 2 14:00',
      ],
    );
    assert.deepEqual(
      packageSlots(hours(11, 12))!.map((one) => one.half),
      ['morning', 'afternoon'],
    );
    assert.equal(packageSlots([]), null);
  });

  it('splits a day with no break as the week’s morning, so the afternoon keeps its slots', () => {
    const day = hours(8, 9, 10, 11, 12, 13, 14, 15, 16);
    assert.deepEqual(
      packageSlots(day, 5)!.map((one) => `${one.half} ${one.index} ${one.from}`),
      [
        'morning 1 08:00',
        'morning 2 09:00',
        'morning 3 10:00',
        'morning 4 11:00',
        'morning 5 12:00',
        'afternoon 1 13:00',
        'afternoon 2 14:00',
        'afternoon 3 15:00',
        'afternoon 4 16:00',
      ],
    );
    const slots = [1, 2, 3, 4, 5].flatMap((index) => [
      { half: 'morning' as const, index },
      ...(index < 5 ? [{ half: 'afternoon' as const, index }] : []),
    ]);
    const sessions = [session('a', { start: 720, end: 780 }), session('b', { start: 960, end: 1020, day: 1 })];
    const one = place({ slots, part: { ...place().part, bells: day, sessions } });
    const accepted = acceptPackage(one, 'v-2', parseDay('2026-12-06'));
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    assert.deepEqual(
      accepted.version.entries.slice(1).map((entry) => `${entry.slot.half} ${entry.slot.index}`),
      ['morning 5', 'afternoon 4'],
    );
  });

  it('accepts a package whose every session is placed, keeping the rest', () => {
    const sessions = [
      session('a', {}),
      session('b', {
        class: ' 4م2 ',
        group: 'g1',
        subject: 'Mathématiques',
        day: 1,
        start: 780,
        end: 840,
        week: 'A',
        room: 'ق2',
      }),
    ];
    const from = parseDay('2026-12-06');
    const accepted = acceptPackage(place({}, sessions), 'v-2', from);
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    const { version, school } = accepted;
    assert.deepEqual(
      [version.id, version.from, version.source, version.options, version.blocks.length],
      ['v-2', from, 'package', { saturday: true }, 1],
    );
    assert.deepEqual(
      version.entries.map((one) => [
        one.id,
        one.weekday,
        one.slot.half,
        one.slot.index,
        one.courseId,
        one.groupId,
        one.weeks,
        one.room,
      ]),
      [
        ['e-9', 2, 'morning', 1, 'c-9', 'g-9', 'every', undefined],
        ['v-2-1', 0, 'morning', 1, 'c-1', 'g-1', 'every', undefined],
        ['v-2-2', 0, 'morning', 2, 'c-1', 'g-1', 'every', undefined],
        ['v-2-3', 1, 'afternoon', 1, 'c-3', 'g-3', 'A', 'ق2'],
      ],
    );
    assert.deepEqual(school.bells?.usual?.length, 6);
    assert.deepEqual(
      school.bells?.usual?.find((one) => one.half === 'afternoon' && one.index === 1),
      {
        half: 'afternoon',
        index: 1,
        from: '13:00',
        to: '14:00',
      },
    );
  });

  it('names each session it cannot place, and accepts nothing', () => {
    const sessions = [
      session('a', { class: '4م9' }),
      session('b', { class: '4م2', group: 'G7' }),
      session('c', { class: '4م2', subject: 'فيزياء' }),
      session('f', { subject: 'Physique' }),
      session('d', { start: 500, end: 560 }),
      session('e', { start: 660, end: 840 }),
    ];
    const one = place({}, sessions);
    assert.deepEqual(
      unplacedOf(one).map((unplaced) => unplaced.reason),
      ['class', 'group', 'course', 'course', 'slots', 'slots'],
    );
    assert.equal(acceptPackage(one, 'v-2', parseDay('2026-12-06')).ok, false);
    assert.deepEqual(unplacedOf(place({}, [session('a', { subject: 'Langue mixte' })])), []);
  });

  it('places by the school’s own times when the package carries none', () => {
    const one = place({ part: { ...place().part, bells: [], sessions: [session('a', { start: 1000, end: 1060 })] } });
    assert.equal(unplacedOf(one).length, 1);
    const accepted = acceptPackage(
      place({ part: { ...one.part, sessions: [session('a', { start: 780, end: 840 })] } }),
      'v-2',
      parseDay('2026-12-06'),
    );
    assert.equal(accepted.ok && accepted.version.entries.at(-1)?.slot.half, 'afternoon');
    assert.equal(accepted.ok && accepted.school.bells, undefined);
  });

  it('reads the drawn week with slots in a row joined, so only real changes differ', () => {
    const one = place({}, [session('a', { subject: 'Arabe' }), session('b', { start: 600, end: 660, day: 2 })]);
    const drawn = drawnRows(one);
    assert.deepEqual(
      drawn.map((row) => [row.day, row.start, row.end, row.subject]),
      [[0, 480, 600, 'اللغة العربية']],
    );
    assert.deepEqual(
      weekDifferences(drawn, packageRows(one)).map((change) => [
        change.kind,
        change.before?.start,
        change.after?.start,
      ]),
      [['added', undefined, 600]],
    );
  });

  it('joins a lesson’s sessions in a row even with week A and B between them', () => {
    const lesson = (id: string, slot: Slot, weeks: 'A' | 'B') => entry(id, 0, slot, 'c-1', 'g-1', weeks);
    const drawn = { ...place().drawn!, entries: [lesson('e-1', SLOTS[0]!, 'A'), lesson('e-2', SLOTS[0]!, 'B')] };
    const both = { ...drawn, entries: [...drawn.entries, lesson('e-3', SLOTS[2]!, 'A')] };
    const sessions = [
      session('a', { end: 540, week: 'A' }),
      session('b', { end: 540, week: 'B' }),
      session('c', { start: 540, end: 600, week: 'A' }),
    ];
    const one = place({ drawn: both }, sessions);
    assert.deepEqual(
      drawnRows(one).map((row) => [row.week, row.start, row.end]),
      [
        ['A', 480, 600],
        ['B', 480, 540],
      ],
    );
    assert.deepEqual(packageRows(one), drawnRows(one));
    assert.deepEqual(weekDifferences(drawnRows(one), packageRows(one)), []);
  });
});
