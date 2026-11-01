// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Each class's standing from the school's signed weeks (#549, answer 627): a
// class is matched by its name key, one the school does not list left out; a
// week counts under the subject code its totals name, whatever the timetable
// calls the subject; a subject's weeks come from every teacher's course in it,
// two teachers' parts of one week both counted, each teacher's week once at the
// highest version read; a closure of the world's calendar in the school's zone
// is not counted among the other causes; the place in the plan names the
// class's pinned pack's item; and a class and subject with no week has no
// standing. Every school, class and week is made up.

import {
  directorSchool,
  seedNationalWorld,
  type CalendarEntry,
  type Day,
  type WeekRecord,
  type WeekSession,
} from '@minhajna/core';
import { reference } from '../jest/world-calendar';
import { courseStandings } from '../src/director/course-standings';
import type { ClassRecords, CourseRecord } from '../src/director/records-session';

const { zones = [], workingDays } = reference.profile;
const school = directorSchool(seedNationalWorld('ABCDE', zones, workingDays, reference.packs))!;
const pinnedClass = school.classes.find((one) => Object.keys(one.packs).length > 0)!;
const subject = Object.keys(pinnedClass.packs)[0];
const pinned = pinnedClass.packs[subject];
const pack = reference.packs.find((one) => one.id === pinned.id && one.release === pinned.release)!;

const session = (day: number, state: WeekSession['state']) =>
  ({ day, start: 480, end: 540, group: '', week: 'both', state }) as WeekSession;

function week(start: string, version: number, sessions: WeekSession[], item: string | null, closed = 0): WeekRecord {
  const items = item === null ? [] : [{ item, sessions: 1, outcome: 'taught' as const }];
  const totals = { subject, items, reached: 120, runsLong: false, covered: 0, closed };
  const named = { class: pinnedClass.name, subject: 'Made-up subject name' };
  return { course: 'made-up-course', week: start as Day, version, totals, ...named, sessions };
}

const closure: CalendarEntry = {
  id: 'made-up-closure',
  layer: 'zone',
  zone: school.wilaya,
  from: '2026-10-13' as Day,
  to: '2026-10-13' as Day,
  effect: 'closure',
  name: { en: 'Made-up closure' },
  source: 'Made up for this test',
  confidence: 'announced',
};
const closing = {
  ...reference,
  calendar: { ...reference.calendar, entries: [...reference.calendar.entries, closure] },
};

const course = (teacher: string, weeks: WeekRecord[], name = pinnedClass.name): CourseRecord => ({
  key: `${teacher}\nmade-up-course`,
  course: 'made-up-course',
  teacher,
  class: name,
  subject,
  weeks: weeks.map((one) => ({ week: one, earlier: [], signed: null as never, issue: null as never, visas: [] })),
});

test('a subject’s weeks come from every teacher’s course in it, each week once at its highest version', () => {
  const item = pack.items[2];
  const records: ClassRecords[] = [
    {
      class: pinnedClass.name.toLowerCase(),
      courses: [
        course('made-up-teacher-a', [week('2026-10-04', 0, [session(1, 'not-held'), session(2, 'held')], null)]),
        course('made-up-teacher-b', [
          week('2026-10-04', 0, [session(3, 'not-held')], null),
          week('2026-10-04', 1, [session(3, 'held')], null),
          week('2026-10-11', 0, [session(1, 'not-held'), session(2, 'not-held'), session(3, 'awaiting')], item.id, 1),
        ]),
      ],
    },
    { class: '9AM9', courses: [course('made-up-teacher-c', [week('2026-10-04', 0, [], null)], '9AM9')] },
  ];
  const standing = courseStandings(records, school, closing);
  expect(standing(pinnedClass.id, subject)).toEqual({
    position: { id: item.id, title: item.title },
    reached: 120,
    runsLong: false,
    notHeld: { closure: 1, other: 2 },
    awaiting: 1,
  });
  expect(courseStandings(records, school, reference)(pinnedClass.id, subject)!.notHeld).toEqual({
    closure: 1,
    other: 3,
  });
  expect(school.classes.filter((one) => standing(one.id, subject) !== null)).toEqual([pinnedClass]);
  expect(standing(pinnedClass.id, 'made-up-subject')).toBeNull();
});
