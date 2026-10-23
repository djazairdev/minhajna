// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Joint primary classes (#43): one class, two or three levels, each on its
// own plan, sharing the room's slot and its roll call, each with its own
// grade's exams, sat by that level's pupils. Made-up data only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  classGrades,
  courseOf,
  examList,
  isJoint,
  jointProblems,
  makeContext,
  nextExams,
  pupilGrade,
  rollCallUnits,
  sessionsBetween,
  termCheck,
  todayView,
  type RecordEvent,
  type SchoolClass,
} from '../src/index.ts';
import { contextOf, country, d, openBook, primaryEvents, reference } from './fixtures.ts';

const primary = country.levels.find((level) => level.code === 'primary')!;

const jointClass: SchoolClass = {
  id: 'k-5apb',
  schoolId: 's-pri',
  level: 'primary',
  grade: '4ap',
  name: '4-5AP',
  groups: [
    { id: 'h-all', kind: 'whole', name: '4-5AP' },
    { id: 'g-4', kind: 'level', name: '4AP', grade: '4ap' },
    { id: 'g-5', kind: 'level', name: '5AP', grade: '5ap' },
  ],
};

/** The primary fixture as a joint class: 4AP on free entry, 5AP on the language pack. */
function jointEvents(schoolClass: SchoolClass = jointClass): RecordEvent[] {
  return [
    ...primaryEvents().map((event): RecordEvent => {
      if (event.kind === 'class.set') return { kind: 'class.set', schoolClass };
      if (event.kind === 'pupil.set') {
        const level = ['q01', 'q02'].includes(event.pupil.id) ? 'g-4' : 'g-5';
        return { kind: 'pupil.set', pupil: { ...event.pupil, groups: [level] } };
      }
      if (event.kind === 'course.set') return { kind: 'course.set', course: { ...event.course, grade: '5ap' } };
      return event;
    }),
    {
      kind: 'course.set',
      course: { id: 'c-lang-4', classId: 'k-5apb', subject: 'language', year: '2026-2027', pack: null, grade: '4ap' },
    },
  ];
}

const sunday = d('2026-09-20');

describe('Joint classes', () => {
  it('knows its levels, and each pupil’s', async () => {
    const book = await openBook(jointEvents());
    assert.equal(isJoint(jointClass), true);
    assert.deepEqual(classGrades(jointClass), ['4ap', '5ap']);
    assert.equal(pupilGrade(book.state.pupils.get('q01')!, jointClass), '4ap');
    assert.equal(pupilGrade(book.state.pupils.get('q03')!, jointClass), '5ap');
    const single = (await openBook(primaryEvents())).state.classes.get('k-5apb')!;
    assert.equal(isJoint(single), false);
    assert.deepEqual(classGrades(single), ['5ap']);
  });

  it('finds each level’s course', async () => {
    const { state } = await openBook(jointEvents());
    assert.equal(courseOf(state, 'k-5apb', 'language', '2026-2027', '4ap')?.id, 'c-lang-4');
    assert.equal(courseOf(state, 'k-5apb', 'language', '2026-2027', '5ap')?.id, 'c-lang');
    assert.equal(courseOf(state, 'k-5apb', 'language', '2026-2027', '3ap'), undefined);
  });

  it('holds one session for each level in each slot', async () => {
    const sessions = sessionsBetween(contextOf(await openBook(jointEvents())), sunday, sunday);
    assert.equal(sessions.length, 6);
    for (const id of ['c-lang', 'c-lang-4']) {
      assert.deepEqual(
        sessions.filter((session) => session.courseId === id).map((session) => session.slot),
        [
          { half: 'morning', index: 1 },
          { half: 'morning', index: 2 },
          { half: 'afternoon', index: 1 },
        ],
      );
    }
  });

  it('proposes from each level’s own plan, and nothing for a level on free entry', async () => {
    const view = todayView(contextOf(await openBook(jointEvents())), sunday);
    const first = view.sessions.filter((item) => item.session.slot.half === 'morning' && item.session.slot.index === 1);
    assert.deepEqual(first.map((item) => [item.course.id, item.proposal?.item.id ?? null]).sort(), [
      ['c-lang', 'r1'],
      ['c-lang-4', null],
    ]);
  });

  it('takes one roll call for the whole class, by half-day or by session', async () => {
    const byHalfDay = rollCallUnits(contextOf(await openBook(jointEvents())), 'k-5apb', sunday, sunday);
    assert.deepEqual(
      byHalfDay.map((unit) => [unit.half, unit.sessions.length]),
      [
        ['morning', 4],
        ['afternoon', 2],
      ],
    );
    const bySession = rollCallUnits(
      contextOf(await openBook(jointEvents({ ...jointClass, rollCallUnit: 'session' }))),
      'k-5apb',
      sunday,
      sunday,
    );
    assert.equal(bySession.length, 3);
    assert.ok(bySession.every((unit) => unit.sessions.length === 2 && unit.groupId === 'h-all'));
  });

  it('marks an exam for one grade on that level’s sessions only', async () => {
    const exam = {
      id: 'exam-5',
      layer: 'national' as const,
      from: d('2026-09-21'),
      to: d('2026-09-21'),
      effect: 'exam' as const,
      levels: ['primary'],
      grades: ['5ap'],
      name: { en: 'Made-up 5AP test' },
      source: 'made up for tests',
      confidence: 'announced' as const,
    };
    const book = await openBook(jointEvents());
    const context = makeContext({ ...reference, calendar: [...reference.calendar, exam] }, book.state);
    const monday = sessionsBetween(context, d('2026-09-21'), d('2026-09-21'));
    assert.deepEqual(monday.map((session) => [session.courseId, session.calendar]).sort(), [
      ['c-lang', 'exam'],
      ['c-lang', 'exam'],
      ['c-lang-4', null],
      ['c-lang-4', null],
    ]);
  });

  it('takes each level’s exam window from its own grade', async () => {
    const exams = {
      id: 'exams-5',
      layer: 'national' as const,
      from: d('2026-12-06'),
      to: d('2026-12-10'),
      effect: 'exam' as const,
      levels: ['primary'],
      grades: ['5ap'],
      term: 1,
      name: { en: 'Made-up 5AP exams' },
      source: 'made up for tests',
      confidence: 'announced' as const,
    };
    const book = await openBook(jointEvents());
    const context = makeContext({ ...reference, calendar: [...reference.calendar, exams] }, book.state);
    assert.equal(nextExams(context, 'c-lang', sunday)?.id, 'exams-5');
    assert.equal(nextExams(context, 'c-lang-4', sunday), null);
    assert.equal(termCheck(context, 'c-lang', sunday)?.basis, 'exam-window');
    const sitting = (courseId: string) => examList(context, courseId, exams.from);
    assert.deepEqual(sitting('c-lang-4'), ['q01', 'q02']);
    assert.ok(sitting('c-lang').length > 0 && !sitting('c-lang').some((id) => ['q01', 'q02'].includes(id)));
  });

  it('holds two or three different levels of its own, in order', () => {
    const withLevels = (grade: string, ...grades: string[]): SchoolClass => ({
      ...jointClass,
      grade,
      groups: [
        jointClass.groups[0]!,
        ...grades.map((g) => ({ id: `g-${g}`, kind: 'level' as const, name: g, grade: g })),
      ],
    });
    assert.deepEqual(jointProblems(jointClass, primary), []);
    assert.deepEqual(jointProblems(withLevels('3ap', '3ap', '4ap', '5ap'), primary), []);
    assert.deepEqual(jointProblems(withLevels('4ap', '4ap'), primary), ['level-count']);
    assert.deepEqual(jointProblems(withLevels('1ap', '1ap', '2ap', '3ap', '4ap'), primary), ['level-count']);
    assert.deepEqual(jointProblems(withLevels('4ap', '4ap', '4ap'), primary), ['repeated-level']);
    assert.deepEqual(jointProblems(withLevels('4ap', '4ap', '1am'), primary), ['outside-level']);
    assert.deepEqual(jointProblems(withLevels('5ap', '5ap', '4ap'), primary), ['level-order']);
    assert.deepEqual(jointProblems(withLevels('5ap', '4ap', '5ap'), primary), ['first-grade']);
  });
});
