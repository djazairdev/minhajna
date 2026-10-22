// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The distributions of a class's own list and of a joint class (#237, answer
// 422): an item taken off the list after it was taught keeps its row by its
// own name, and each level of a joint class has its own distributions, none
// for a level on free entry. Made-up lists and classes only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  annualDistribution,
  awaitingBetween,
  confirmCourse,
  recordedItems,
  saveFreeList,
  withoutItems,
  type FreeList,
  type RecordEvent,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook, primaryEvents } from './fixtures.ts';

const list: FreeList = {
  courseId: 'c-math',
  started: d('2026-09-14'),
  items: [
    { id: 'u1', kind: 'unit', title: 'Made-up unit' },
    { id: 'l1', kind: 'lesson', title: 'Made-up lesson one', sessions: 1 },
    { id: 'l2', kind: 'lesson', title: 'Made-up lesson two', sessions: 1 },
  ],
};

describe('distributions of kept rows', () => {
  it('keeps an item taken off the list after it was taught by its own name', async () => {
    const book = await openBook(
      cemEvents().map((event) =>
        event.kind === 'course.set' && event.course.id === 'c-math'
          ? { ...event, course: { ...event.course, pack: null } }
          : event,
      ),
    );
    await book.record(d('2026-09-14'), saveFreeList(book.state.courses, list));
    const [session] = awaitingBetween(contextOf(book), d('2026-09-14'), d('2026-09-30')).filter(
      (one) => one.courseId === 'c-math',
    );
    assert.ok(session);
    const [record] = confirmCourse(contextOf(book), 'c-math', [{ sessionKey: session.key }], session.day);
    assert.ok(record);
    await book.record(session.day, { kind: 'session.recorded', record });
    assert.deepEqual(
      annualDistribution(contextOf(book), 'c-math').map((row) => [row.id, row.sessions, row.confirmed]),
      [['u1', 2, 1]],
    );
    const removed = withoutItems(list, ['l1'], recordedItems(book.state, 'c-math'));
    await book.record(session.day, saveFreeList(book.state.courses, removed));
    assert.deepEqual(
      annualDistribution(contextOf(book), 'c-math').map((row) => [row.id, row.title, row.sessions, row.confirmed]),
      [
        ['l1', 'Made-up lesson one', 1, 1],
        ['u1', 'Made-up unit', 1, 0],
      ],
    );
  });

  it('gives each level of a joint class its own, and none to a level on free entry', async () => {
    const alone = annualDistribution(contextOf(await openBook(primaryEvents())), 'c-lang');
    const joint: RecordEvent[] = [
      ...primaryEvents().map((event): RecordEvent => {
        if (event.kind === 'class.set') {
          return {
            kind: 'class.set',
            schoolClass: {
              ...event.schoolClass,
              name: '4-5AP',
              grade: '4ap',
              groups: [
                { id: 'h-all', kind: 'whole', name: '4-5AP' },
                { id: 'g-4', kind: 'level', name: '4AP', grade: '4ap' },
                { id: 'g-5', kind: 'level', name: '5AP', grade: '5ap' },
              ],
            },
          };
        }
        return event.kind === 'course.set' ? { kind: 'course.set', course: { ...event.course, grade: '5ap' } } : event;
      }),
      {
        kind: 'course.set',
        course: { id: 'c-lang-4', classId: 'k-5apb', subject: 'language', year: '2026-2027', pack: null, grade: '4ap' },
      },
    ];
    const context = contextOf(await openBook(joint));
    assert.deepEqual(annualDistribution(context, 'c-lang'), alone);
    assert.equal(alone.length, 3);
    assert.deepEqual(annualDistribution(context, 'c-lang-4'), []);
  });
});
