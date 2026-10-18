// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The texts book's homework record (#214, PRD §3.8): each piece of homework
// in the order it was set, with the pupils its group has on the class list
// on the day it comes back; its two counts entered once it has come back,
// never more than the list, corrected or taken back with the history kept;
// each count as a rounded percentage of the list; homework a correction no
// longer sets leaving the record; and the counts travelling with the lesson
// record, never with names. Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  confirmSessions,
  countHomework,
  current,
  homeworkDue,
  homeworkPercent,
  homeworkRecord,
  layerOf,
  recordsForRoute,
  sessionsBetween,
  uncountHomework,
  type RecordBook,
  type RecordEvent,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

/** Homework set on Sunday 20 September for Wednesday, and in Tuesday's TD of group 1 for Sunday 27. */
async function withHomework(): Promise<RecordBook> {
  const book = await openBook(cemEvents());
  const week = sessionsBetween(contextOf(book), d('2026-09-20'), d('2026-09-22'), new Set(['c-math']));
  const sunday = week.find((session) => session.day === '2026-09-20');
  const tuesday = week.find((session) => session.day === '2026-09-22');
  assert.ok(sunday && tuesday);
  await book.recordAll(
    d('2026-09-22'),
    confirmSessions(contextOf(book), [
      { session: sunday, details: { homework: { text: 'Made-up: exercise 5 p. 22', due: d('2026-09-23') } } },
      { session: tuesday, details: { homework: { text: 'Made-up: exercise 2 p. 30', due: d('2026-09-27') } } },
    ]),
  );
  return book;
}

test("lists a course's homework in the order it was set, with its group's pupils on the list", async () => {
  const book = await withHomework();
  const record = homeworkRecord(contextOf(book), 'c-math');
  assert.deepEqual(
    record.map((item) => [item.set, item.due, item.text, item.session.groupId, item.listed, item.count]),
    [
      ['2026-09-20', '2026-09-23', 'Made-up: exercise 5 p. 22', 'g-all', 10, null],
      ['2026-09-22', '2026-09-27', 'Made-up: exercise 2 p. 30', 'g-1', 5, null],
    ],
  );
  assert.deepEqual(
    homeworkDue(contextOf(book), 'c-math', 'g-all', d('2026-09-23')).map((item) => item.text),
    ['Made-up: exercise 5 p. 22'],
  );
  assert.deepEqual(homeworkDue(contextOf(book), 'c-math', 'g-1', d('2026-09-23')), []);
  assert.deepEqual(homeworkRecord(contextOf(book), 'c-none'), []);
});

test('counts once it has come back, never more than the list, and corrects or takes the counts back', async () => {
  const book = await withHomework();
  const [item] = homeworkRecord(contextOf(book), 'c-math');
  assert.ok(item);
  assert.throws(() => countHomework(contextOf(book), item, 1, 1, d('2026-09-22')), /come back/);
  assert.throws(() => countHomework(contextOf(book), item, -1, 0, d('2026-09-23')), /whole number/);
  assert.throws(() => countHomework(contextOf(book), item, 1.5, 0, d('2026-09-23')), /whole number/);
  assert.throws(() => countHomework(contextOf(book), item, 6, 5, d('2026-09-23')), /more than the pupils/);
  await book.record(d('2026-09-23'), countHomework(contextOf(book), item, 3, 2, d('2026-09-23')));
  await book.record(d('2026-09-24'), countHomework(contextOf(book), item, 3, 1, d('2026-09-24')));
  const [counted] = homeworkRecord(contextOf(book), 'c-math');
  assert.deepEqual(counted?.count, { sessionKey: item.session.key, due: '2026-09-23', notDone: 3, reliedOn: 1 });
  await book.record(d('2026-09-24'), uncountHomework(item.session.key));
  assert.equal(homeworkRecord(contextOf(book), 'c-math')[0]?.count, null);
  assert.deepEqual(
    book.state.homeworkCounts.get(item.session.key)?.map((version) => version.value?.reliedOn ?? null),
    [2, 1, null],
  );
});

test('rounds each count to a whole percentage of the list, and has none without a list', () => {
  assert.deepEqual(
    [1, 2, 3, 4].map((count) => homeworkPercent(count, 36)),
    [3, 6, 8, 11],
  );
  assert.equal(homeworkPercent(0, 0), null);
  assert.equal(homeworkPercent(3, 2), null);
});

test('drops homework a correction no longer sets, and lists only the pupils still on the list when it comes back', async () => {
  const book = await withHomework();
  await book.record(d('2026-09-21'), {
    kind: 'pupil.moved',
    pupilId: 'p10',
    movement: { day: d('2026-09-21'), kind: 'out', reason: 'Transfer', confirmed: true },
  });
  assert.equal(homeworkRecord(contextOf(book), 'c-math')[0]?.listed, 9);
  const [first] = homeworkRecord(contextOf(book), 'c-math');
  const recorded = first && current(book.state.sessions.get(first.session.key));
  assert.ok(recorded);
  const { session, outcome, sessionType, coverage } = recorded;
  await book.record(d('2026-09-23'), {
    kind: 'session.recorded',
    record: { session, outcome, sessionType, coverage },
    correction: 'other',
  });
  assert.deepEqual(
    homeworkRecord(contextOf(book), 'c-math').map((item) => item.due),
    ['2026-09-27'],
  );
});

test('the counts are part of the lesson record and carry no name', async () => {
  const book = await withHomework();
  const [item] = homeworkRecord(contextOf(book), 'c-math');
  assert.ok(item);
  const event = countHomework(contextOf(book), item, 2, 0, d('2026-09-23'));
  assert.equal(layerOf(event), 'lesson-record');
  assert.equal(layerOf(uncountHomework(item.session.key)), 'lesson-record');
  await book.record(d('2026-09-23'), event);
  assert.ok(recordsForRoute(book.state, 'documents').some((record) => record.kind === 'homework.counted'));
  assert.doesNotMatch(JSON.stringify(event), /p\d\d|بن علي|Benali/);
});

test('leaves counts behind when a correction moves the homework to another day, here and on every route', async () => {
  const book = await withHomework();
  const [item] = homeworkRecord(contextOf(book), 'c-math');
  assert.ok(item);
  await book.record(d('2026-09-23'), countHomework(contextOf(book), item, 2, 1, d('2026-09-23')));
  const recorded = current(book.state.sessions.get(item.session.key));
  assert.ok(recorded?.homework);
  await book.record(d('2026-09-24'), {
    kind: 'session.recorded',
    record: { ...recorded, homework: { ...recorded.homework, due: d('2026-09-30') } },
    correction: 'other',
  });
  const [moved] = homeworkRecord(contextOf(book), 'c-math');
  assert.equal(moved?.due, '2026-09-30');
  assert.equal(moved?.count, null);
  assert.ok(!recordsForRoute(book.state, 'documents').some((record) => record.kind === 'homework.counted'));
  assert.throws(() => countHomework(contextOf(book), item, 1, 0, d('2026-09-30')), /changed/);
});

test("counts a joint class's homework against its level's list only", async () => {
  const events = cemEvents().map((event): RecordEvent => {
    if (event.kind === 'class.set') {
      return {
        kind: 'class.set',
        schoolClass: {
          ...event.schoolClass,
          groups: [
            { id: 'g-all', kind: 'whole', name: '1-2AM' },
            { id: 'g-l1', kind: 'level', name: '1AM', grade: '1am' },
            { id: 'g-l2', kind: 'level', name: '2AM', grade: '2am' },
          ],
        },
      };
    }
    if (event.kind === 'pupil.set') {
      const level = ['p01', 'p02', 'p03', 'p04'].includes(event.pupil.id) ? 'g-l1' : 'g-l2';
      return { kind: 'pupil.set', pupil: { ...event.pupil, groups: [level] } };
    }
    if (event.kind === 'course.set') return { kind: 'course.set', course: { ...event.course, grade: '1am' } };
    if (event.kind === 'timetable.set') {
      const entries = event.version.entries.filter((entry) => entry.groupId === 'g-all');
      return { kind: 'timetable.set', version: { ...event.version, entries } };
    }
    return event;
  });
  const book = await openBook(events);
  const [sunday] = sessionsBetween(contextOf(book), d('2026-09-20'), d('2026-09-20'), new Set(['c-math']));
  assert.ok(sunday);
  await book.recordAll(
    d('2026-09-20'),
    confirmSessions(contextOf(book), [
      { session: sunday, details: { homework: { text: 'Made-up: exercise 1', due: d('2026-09-23') } } },
    ]),
  );
  assert.equal(homeworkRecord(contextOf(book), 'c-math')[0]?.listed, 4);
});
