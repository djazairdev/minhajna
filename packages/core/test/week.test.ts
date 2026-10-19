// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The week the teacher draws (#28): its grid, A/B weeks, time that belongs
// to the teacher, clashes within a school and between two, the weekly load,
// versions that never move the past, and a week corrected before the year
// begins. Made-up schools and classes.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  courseOf,
  sessionsBetween,
  weekClashes,
  weekGrid,
  weeklyLoad,
  weeksOverlap,
  versionOn,
  type RecordEvent,
  type TeacherBlock,
  type TimetableEntry,
  type TimetableVersion,
} from '../src/index.ts';
import { contextOf, country, d, openBook } from './fixtures.ts';

const school = (id: string, name: string): RecordEvent => ({
  kind: 'school.set',
  school: { id, name, levels: ['cem'], subjects: ['arabic', 'islamic'] },
});
const schoolClass = (id: string, schoolId: string): RecordEvent => ({
  kind: 'class.set',
  schoolClass: {
    id,
    schoolId,
    level: 'cem',
    grade: '1am',
    name: id,
    groups: [{ id: `${id}-w`, kind: 'whole', name: id }],
  },
});
const course = (id: string, classId: string, subject = 'arabic'): RecordEvent => ({
  kind: 'course.set',
  course: { id, classId, subject, year: '2026-2027', pack: null },
});
const setup: RecordEvent[] = [
  school('s-1', 'Example Middle School'),
  school('s-2', 'Second Example School'),
  schoolClass('k-1', 's-1'),
  schoolClass('k-2', 's-1'),
  schoolClass('k-3', 's-2'),
  course('c-1', 'k-1'),
  course('c-1i', 'k-1', 'islamic'),
  course('c-2', 'k-2'),
  course('c-3', 'k-3'),
];

let next = 0;
function entry(
  courseId: string,
  weekday: TimetableEntry['weekday'],
  index: number,
  weeks: TimetableEntry['weeks'] = 'every',
) {
  return {
    id: `e-${++next}`,
    weekday,
    slot: { half: 'morning', index },
    courseId,
    groupId: `k-${courseId.slice(2, 3)}-w`,
    weeks,
    sessionType: 'lesson',
  } satisfies TimetableEntry;
}
const version = (entries: TimetableEntry[], blocks: TeacherBlock[] = [], from = '2026-09-13'): TimetableVersion => ({
  id: `v-${from}`,
  from: d(from),
  entries,
  blocks,
  source: 'hand',
});

describe('the week the teacher draws', () => {
  it('holds the working days and four slots a half-day, with Saturday and a fifth morning slot when asked', () => {
    const plain = weekGrid(country);
    assert.deepEqual(plain.days, [0, 1, 2, 3, 4]);
    assert.deepEqual(
      plain.slots.map((slot) => `${slot.half[0]}${slot.index}`),
      ['m1', 'm2', 'm3', 'm4', 'a1', 'a2', 'a3', 'a4'],
    );
    const full = weekGrid(country, { saturday: true, fifthMorning: true });
    assert.deepEqual(full.days, [0, 1, 2, 3, 4, 6]);
    assert.equal(full.slots.filter((slot) => slot.half === 'morning').length, 5);
  });

  it('meets in a shared week only: A and B weeks never clash', () => {
    assert.equal(weeksOverlap('A', 'B'), false);
    assert.equal(weeksOverlap('A', 'A'), true);
    assert.equal(weeksOverlap('every', 'B'), true);
  });

  it('finds two sessions in one slot, but not half-groups taken in alternate weeks', async () => {
    const { state } = await openBook(setup);
    const clashes = weekClashes(
      version([entry('c-1', 1, 1), entry('c-2', 1, 1), entry('c-1', 2, 1, 'A'), entry('c-2', 2, 1, 'B')]),
      state,
    );
    assert.equal(clashes.length, 1);
    assert.deepEqual(clashes[0]?.slot, { half: 'morning', index: 1 });
    assert.equal(clashes[0]?.weekday, 1);
    assert.deepEqual(clashes[0]?.schools, ['s-1']);
  });

  it('finds a session drawn over time that belongs to the teacher, for one slot or a whole half-day', async () => {
    const { state } = await openBook(setup);
    const blocks: TeacherBlock[] = [
      { weekday: 2, half: 'morning', index: 3, kind: 'other-school', label: 'Hours in another school' },
      { weekday: 3, half: 'morning', kind: 'pedagogical', label: 'Pedagogical half-day' },
    ];
    const clashes = weekClashes(version([entry('c-1', 2, 3), entry('c-2', 3, 2), entry('c-1', 4, 1)], blocks), state);
    assert.deepEqual(
      clashes.map((clash) => [clash.weekday, clash.items.map((item) => item.kind)]),
      [
        [2, ['entry', 'block']],
        [3, ['entry', 'block']],
      ],
    );
    assert.equal(weekClashes(version([], blocks), state).length, 0);
  });

  it("names both schools when the week of two schools clashes, and a bivalent teacher's two subjects", async () => {
    const { state } = await openBook(setup);
    const [two] = weekClashes(version([entry('c-1', 0, 2), entry('c-3', 0, 2)]), state);
    assert.deepEqual(two?.schools, ['s-1', 's-2']);
    const [bivalent] = weekClashes(version([entry('c-1', 0, 4), entry('c-1i', 0, 4)]), state);
    assert.equal(bivalent?.items.length, 2);
  });

  it('counts each course a week, an A-week or B-week slot as half', () => {
    const load = weeklyLoad(
      version([entry('c-1', 0, 1), entry('c-1', 1, 1), entry('c-1', 2, 1, 'A'), entry('c-2', 2, 1, 'B')]),
    );
    assert.equal(load.get('c-1'), 2.5);
    assert.equal(load.get('c-2'), 0.5);
  });

  it('finds the course of a class and subject, one for each subject of a bivalent teacher', async () => {
    const { state } = await openBook(setup);
    assert.equal(courseOf(state, 'k-1', 'islamic', '2026-2027')?.id, 'c-1i');
    assert.equal(courseOf(state, 'k-1', 'arabic', '2026-2027')?.id, 'c-1');
    assert.equal(courseOf(state, 'k-1', 'arabic', '2027-2028'), undefined);
  });

  it('replaces the version being drawn when it is saved again, keeping where it starts', async () => {
    const book = await openBook([...setup, { kind: 'timetable.set', version: version([entry('c-1', 0, 1)]) }]);
    await book.record(d('2026-09-15'), {
      kind: 'timetable.set',
      version: version([entry('c-1', 0, 1), entry('c-2', 1, 1)]),
    });
    assert.equal(book.state.timetables.length, 1);
    assert.equal(book.state.timetables[0]?.from.toString(), '2026-09-13');
    assert.equal(book.state.timetables[0]?.version.entries.length, 2);
    await book.record(d('2026-10-04'), {
      kind: 'timetable.set',
      version: version([entry('c-2', 0, 1)], [], '2026-10-04'),
    });
    await book.record(d('2026-10-05'), {
      kind: 'timetable.set',
      version: version([entry('c-2', 0, 2)], [], '2026-10-04'),
    });
    assert.deepEqual(
      book.state.timetables.map((timetable) => timetable.from.toString()),
      ['2026-09-13', '2026-10-04'],
    );
  });

  it('keeps every earlier day on the version it had when the week changes', async () => {
    const book = await openBook([...setup, { kind: 'timetable.set', version: version([entry('c-1', 0, 1)]) }]);
    await book.record(d('2026-10-04'), {
      kind: 'timetable.set',
      version: version([entry('c-2', 0, 1)], [], '2026-09-20'),
    });
    const sundays = sessionsBetween(contextOf(book), d('2026-09-20'), d('2026-10-11')).map(
      (session) => `${session.day.toString()} ${session.courseId}`,
    );
    assert.deepEqual(sundays, ['2026-09-20 c-1', '2026-09-27 c-1', '2026-10-04 c-2', '2026-10-11 c-2']);
  });

  it('lets a week corrected before the year begins replace the one drawn first, once the year starts', async () => {
    const book = await openBook(setup, d('2026-09-10'));
    await book.record(d('2026-09-10'), {
      kind: 'timetable.set',
      version: version([entry('c-1', 0, 1)], [], '2026-09-20'),
    });
    await book.record(d('2026-09-12'), {
      kind: 'timetable.set',
      version: version([entry('c-2', 0, 1)], [], '2026-09-12'),
    });
    const listed = () =>
      book.state.timetables.map(({ version, recorded, from }) => `${version.id} ${recorded} ${from}`);
    assert.deepEqual(listed(), ['v-2026-09-12 2026-09-12 2026-09-12']);
    assert.equal(versionOn(book.state.timetables, d('2026-09-25'))?.id, 'v-2026-09-12');
    const sundays = sessionsBetween(contextOf(book), d('2026-09-20'), d('2026-09-27')).map(
      (session) => `${session.day.toString()} ${session.courseId}`,
    );
    assert.deepEqual(sundays, ['2026-09-20 c-2', '2026-09-27 c-2']);
    await book.record(d('2026-09-14'), {
      kind: 'timetable.set',
      version: { ...version([entry('c-2', 0, 2)], [], '2026-09-12'), from: d('2026-09-01') },
    });
    assert.deepEqual(listed(), ['v-2026-09-12 2026-09-12 2026-09-12']);
  });

  it('lets a later version replace one that has not started, keeping those that have', async () => {
    const book = await openBook([...setup, { kind: 'timetable.set', version: version([entry('c-1', 0, 1)]) }]);
    await book.record(d('2026-10-01'), {
      kind: 'timetable.set',
      version: version([entry('c-2', 0, 1)], [], '2026-10-18'),
    });
    await book.record(d('2026-10-04'), {
      kind: 'timetable.set',
      version: version([entry('c-3', 0, 1)], [], '2026-10-04'),
    });
    assert.deepEqual(
      book.state.timetables.map(({ version, from }) => `${version.id} ${from}`),
      ['v-2026-09-13 2026-09-13', 'v-2026-10-04 2026-10-04'],
    );
    assert.equal(versionOn(book.state.timetables, d('2026-10-01'))?.id, 'v-2026-09-13');
    assert.equal(versionOn(book.state.timetables, d('2026-10-20'))?.id, 'v-2026-10-04');
  });
});
