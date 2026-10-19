// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Exam-week entries (#221, answer 270): the exam windows of the teacher's
// classes; an invigilation or a class exam set only on a day they cover,
// with times that end after they start, a room of a sensible length, and a
// class exam's own classes, each with exams that day; the day's entries in
// order; and the entries in the records that travel, in a set order.
// Made-up records only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dutiesOn, examCourses, examDay, examWindows, recordsForRoute, setDuty, type ExamDuty } from '../src/index.ts';
import { cemEvents, contextOf, d, openBook, primaryEvents } from './fixtures.ts';

const invigilation = (id: string, day: string, from = '10:00', to = '12:00'): ExamDuty => ({
  id,
  kind: 'invigilation',
  day: d(day),
  from,
  to,
});

describe('exam-week entries', () => {
  it('knows the exam windows of the teacher’s classes', async () => {
    const context = contextOf(await openBook(cemEvents()));
    assert.deepEqual(
      examWindows(context).map((entry) => entry.id),
      ['exams-1'],
    );
    assert.equal(examDay(context, d('2026-12-06')), true);
    assert.equal(examDay(context, d('2026-12-10')), true);
    assert.equal(examDay(context, d('2026-12-11')), false);
  });

  it('sets an invigilation or a class exam only on an exam day, as typed', async () => {
    const context = contextOf(await openBook(cemEvents()));
    assert.deepEqual(setDuty(context, { ...invigilation('i-1', '2026-12-07'), room: ' 5 ' }), {
      kind: 'duty.set',
      duty: { id: 'i-1', kind: 'invigilation', day: '2026-12-07', from: '10:00', to: '12:00', room: '5' },
    });
    assert.deepEqual(
      setDuty(context, {
        id: 'e-1',
        kind: 'exam',
        day: d('2026-12-06'),
        from: '08:00',
        to: '10:00',
        courseIds: ['c-math'],
        room: '',
      }),
      {
        kind: 'duty.set',
        duty: { id: 'e-1', kind: 'exam', day: '2026-12-06', from: '08:00', to: '10:00', courseIds: ['c-math'] },
      },
    );
    assert.throws(() => setDuty(context, invigilation('i-2', '2026-12-13')), /outside the exam windows/);
    assert.throws(() => setDuty(context, invigilation('i-3', '2026-12-07', '12:00', '10:00')), /ends after/);
    assert.throws(() => setDuty(context, invigilation('i-4', '2026-12-07', '8:00')), /HH:MM/);
    assert.throws(() => setDuty(context, { ...invigilation('i-5', '2026-12-07'), room: 'x'.repeat(41) }), /too long/);
    assert.throws(
      () => setDuty(context, { ...invigilation('i-6', '2026-12-07'), courseIds: ['c-math'] }),
      /names no class/,
    );
    const exam = { id: 'e-2', kind: 'exam' as const, day: d('2026-12-06'), from: '08:00', to: '10:00' };
    assert.throws(() => setDuty(context, exam), /names its classes/);
    assert.throws(() => setDuty(context, { ...exam, courseIds: ['c-math', 'c-math'] }), /named twice/);
    assert.throws(() => setDuty(context, { ...exam, courseIds: ['c-none'] }), /No such course/);
    const both = contextOf(await openBook([...cemEvents(), ...primaryEvents()]));
    assert.deepEqual(examCourses(both, d('2026-12-07')), ['c-math']);
    assert.throws(() => setDuty(both, { ...exam, courseIds: ['c-math', 'c-lang'] }), /no exams that day/);
  });

  it('lists a day’s entries in order, and sends them with the lesson records', async () => {
    const book = await openBook(cemEvents());
    const context = contextOf(book);
    await book.recordAll(d('2026-11-20'), [
      setDuty(context, invigilation('i-2', '2026-12-07', '13:00', '15:00')),
      setDuty(context, invigilation('i-1', '2026-12-07')),
      setDuty(context, invigilation('i-0', '2026-12-06')),
    ]);
    assert.deepEqual(
      dutiesOn(book.state, d('2026-12-07')).map((duty) => duty.id),
      ['i-1', 'i-2'],
    );
    await book.recordAll(d('2026-11-21'), [{ kind: 'duty.removed', id: 'i-2' }]);
    assert.deepEqual(
      dutiesOn(book.state, d('2026-12-07')).map((duty) => duty.id),
      ['i-1'],
    );
    assert.deepEqual(
      recordsForRoute(book.state, 'statement').flatMap((record) =>
        record.kind === 'duty.set' ? [record.duty.id] : [],
      ),
      ['i-0', 'i-1'],
    );
  });
});
