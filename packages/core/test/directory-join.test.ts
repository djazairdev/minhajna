// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Joining a school from the directory (answer 808): the records a first join
// makes, a second join that records nothing, the same IDs once the school is
// listed, an update with a pupil gone, one new, one moved to another class and
// one whose leaving stands, a class no longer given, and a week changed beside
// another school's sessions and the teacher's own class. Made-up data only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { joinPlan, type RecordEvent, type TeacherDelivery } from '../src/index.ts';
import { chosen, class1, class2, delivery, pupil, typed } from './directory-kit.ts';
import { d, mathPack, openBook, year } from './fixtures.ts';

const ids = () => {
  let next = 0;
  return () => `v-${++next}`;
};
const plan = (state: Parameters<typeof joinPlan>[0]['state'], today: string, given = delivery, packs = [mathPack]) =>
  joinPlan({ state, year, today: d(today), delivery: given, school: chosen, packs, newId: ids() });
const C1 = 'dir.own-1.c.c1';

test('a first join records the school, classes, pupils, courses on the bundled pack and the week', async () => {
  const bookOf = await openBook([{ kind: 'school.set', school: typed }]);
  const first = plan(bookOf.state, '2026-10-15');
  const kinds = first.events.map((event) => event.kind);
  assert.deepEqual(kinds, [
    'school.set',
    'class.set',
    'pupil.set',
    'pupil.set',
    'course.set',
    'class.set',
    'pupil.set',
    'course.set',
    'timetable.set',
  ]);
  assert.deepEqual(first.events[0], { kind: 'school.set', school: chosen });
  const classSet = first.events[1] as Extract<RecordEvent, { kind: 'class.set' }>;
  assert.deepEqual(classSet.schoolClass.groups, [{ id: `${C1}.w`, kind: 'whole', name: '1AM1' }]);
  const pupilSet = first.events[2] as Extract<RecordEvent, { kind: 'pupil.set' }>;
  assert.deepEqual(pupilSet.pupil.movements, []);
  const course = first.events[4] as Extract<RecordEvent, { kind: 'course.set' }>;
  assert.deepEqual(course.course.pack, { id: 'dz.cem.1am.math.example', release: '2026.1' });
  const week = first.events.at(-1) as Extract<RecordEvent, { kind: 'timetable.set' }>;
  assert.equal(week.version.from, year.from);
  assert.equal(week.version.source, 'package');
  assert.deepEqual(
    first.classes.map((one) => [one.name, one.pupils, one.isNew]),
    [
      ['1AM1', 2, true],
      ['1AM2', 1, true],
    ],
  );
  assert.deepEqual([first.sessions, first.arriving, first.leaving, first.weekChanged], [2, 0, 0, true]);
  await bookOf.recordAll(d('2026-10-15'), first.events);
  assert.deepEqual(plan(bookOf.state, '2026-10-16', delivery, []).events, []);
});

test('keeps the same IDs when the school was not listed at the first join', async () => {
  const bookOf = await openBook([{ kind: 'school.set', school: chosen }]);
  await bookOf.recordAll(d('2026-10-15'), plan(bookOf.state, '2026-10-15', { ...delivery, school: null }).events);
  assert.deepEqual(plan(bookOf.state, '2026-10-16').events, []);
});

test('an update: a pupil gone leaves, one new arrives, one moved changes class, and a leaving stands', async () => {
  const bookOf = await openBook([{ kind: 'school.set', school: chosen }]);
  await bookOf.recordAll(d('2026-10-15'), plan(bookOf.state, '2026-10-15', delivery, []).events);
  await bookOf.record(d('2026-10-20'), {
    kind: 'pupil.moved',
    pupilId: `${C1}.p.p2`,
    movement: { day: d('2026-10-20'), kind: 'out', reason: 'transfer', confirmed: true },
  });
  const moved = { ...pupil('p7', 'Pupil one'), registration: '1001' };
  const changed: TeacherDelivery = {
    ...delivery,
    classes: [
      { ...class1, pupils: [pupil('p2', 'Pupil two'), pupil('p4', 'Pupil four')] },
      { ...class2, pupils: [...class2.pupils, moved] },
    ],
  };
  const later = d('2026-11-02');
  const update = plan(bookOf.state, '2026-11-02', changed);
  assert.deepEqual(update.events, [
    {
      kind: 'pupil.set',
      pupil: {
        groups: [],
        movements: [{ day: later, kind: 'in', reason: 'transfer' }],
        id: `${C1}.p.p4`,
        classId: C1,
        name: 'Pupil four',
        sex: 'f',
      },
    },
    { kind: 'pupil.moved', pupilId: `${C1}.p.p1`, movement: { day: later, kind: 'out', reason: 'class-change' } },
    {
      kind: 'pupil.set',
      pupil: {
        groups: [],
        movements: [{ day: later, kind: 'in', reason: 'class-change' }],
        id: 'dir.own-1.c.c2.p.p7',
        classId: 'dir.own-1.c.c2',
        name: 'Pupil one',
        sex: 'f',
        registration: '1001',
      },
    },
  ]);
  assert.deepEqual([update.arriving, update.leaving, update.stillListed, update.weekChanged], [2, 1, 1, false]);
  await bookOf.recordAll(later, update.events);
  assert.equal(bookOf.state.pupils.has(`${C1}.p.p1`), true);
  assert.equal(bookOf.state.courses.get(`${C1}.math.2026-2027`)?.pack, null);
  assert.deepEqual(plan(bookOf.state, '2026-11-03', changed).events, []);
});

test('a class no longer given loses its sessions and is named, and the teacher’s own class keeps its own', async () => {
  const bookOf = await openBook([
    { kind: 'school.set', school: chosen },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-own',
        schoolId: 'own-1',
        level: 'cem',
        grade: '1am',
        name: 'Own',
        groups: [{ id: 'k-own-w', kind: 'whole', name: 'Own' }],
      },
    },
    { kind: 'course.set', course: { id: 'c-own', classId: 'k-own', subject: 'math', year: year.id, pack: null } },
  ]);
  const own = {
    id: 'e-own',
    weekday: 3 as const,
    slot: { half: 'morning' as const, index: 1 },
    courseId: 'c-own',
    groupId: 'k-own-w',
    weeks: 'A' as const,
    sessionType: 'lesson',
    room: '12',
  };
  await bookOf.record(d('2026-09-20'), {
    kind: 'timetable.set',
    version: { id: 'v-0', from: year.from, source: 'hand', entries: [own], blocks: [] },
  });
  await bookOf.recordAll(d('2026-10-15'), plan(bookOf.state, '2026-10-15').events);
  const fewer = plan(bookOf.state, '2026-11-02', { ...delivery, classes: [class1], sessions: [delivery.sessions[0]!] });
  assert.deepEqual(fewer.dropped, ['1AM2']);
  const week = fewer.events.at(-1) as Extract<RecordEvent, { kind: 'timetable.set' }>;
  assert.deepEqual(
    week.version.entries.map((one) => one.id),
    ['e-own', 'dir.own-1.s.s1'],
  );
  assert.equal(week.version.from, d('2026-11-02'));
});

test('a changed week keeps another school’s sessions, the teacher’s own time, and an entry’s room', async () => {
  const other: RecordEvent[] = [
    { kind: 'school.set', school: { id: 'own-2', name: 'Other', levels: ['cem'], subjects: ['math'] } },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-9',
        schoolId: 'own-2',
        level: 'cem',
        grade: '1am',
        name: 'K9',
        groups: [{ id: 'k-9-w', kind: 'whole', name: 'K9' }],
      },
    },
    { kind: 'course.set', course: { id: 'c-9', classId: 'k-9', subject: 'math', year: year.id, pack: null } },
    {
      kind: 'timetable.set',
      version: {
        id: 'v-0',
        from: year.from,
        source: 'hand',
        entries: [
          {
            id: 'e-9',
            weekday: 2,
            slot: { half: 'afternoon', index: 1 },
            courseId: 'c-9',
            groupId: 'k-9-w',
            weeks: 'every',
            sessionType: 'lesson',
          },
        ],
        blocks: [{ weekday: 3, half: 'morning', label: 'Own' }],
      },
    },
  ];
  const bookOf = await openBook([{ kind: 'school.set', school: chosen }, ...other]);
  const first = plan(bookOf.state, '2026-10-15');
  const week = first.events.at(-1) as Extract<RecordEvent, { kind: 'timetable.set' }>;
  assert.equal(week.version.from, d('2026-10-15'));
  assert.deepEqual(
    week.version.entries.map((one) => one.id),
    ['e-9', 'dir.own-1.s.s1', 'dir.own-1.s.s2'],
  );
  assert.deepEqual(week.version.blocks, [{ weekday: 3, half: 'morning', label: 'Own' }]);
  await bookOf.recordAll(d('2026-10-15'), first.events);
  const roomed = { ...week.version, id: 'v-r', entries: week.version.entries.map((one) => ({ ...one, room: '7' })) };
  await bookOf.record(d('2026-10-16'), { kind: 'timetable.set', version: roomed });
  const moved = { ...delivery, sessions: [{ ...delivery.sessions[0]!, weekday: 4 as const }, delivery.sessions[1]!] };
  const again = plan(bookOf.state, '2026-10-20', moved).events.at(-1) as Extract<
    RecordEvent,
    { kind: 'timetable.set' }
  >;
  assert.deepEqual(
    again.version.entries.map((one) => [one.id, one.weekday, one.room]),
    [
      ['e-9', 2, '7'],
      ['dir.own-1.s.s1', 4, '7'],
      ['dir.own-1.s.s2', 1, '7'],
    ],
  );
});
