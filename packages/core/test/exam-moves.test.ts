// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The exams an update of the calendar moved (#602, answer 634): an exam whose
// window moved names the days it had, its figures day and signing deadline
// among them, the reason and the day an update holding that same move was first
// published, a later move of the window taking its own; an exam moved within
// its week keeps its figures day, its signing deadline moving; an unmoved
// calendar moves nothing; the mock exam and the BEM, which move with the last
// grade's term 3 window, take that window's reason, even with another window
// moved and announced later; two windows moved together for one exam move it as
// one; a moved day without school that the mock exam's week falls in moves it,
// with that day's reason; and a window no update holds moves its exam with no
// day announced. Every calendar entry is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { examMoves, worldExams, type CalendarEntry, type SchoolYear } from '../src/index.ts';
import { d } from './fixtures.ts';

const year: SchoolYear = {
  id: '2026-2027',
  from: d('2026-09-20'),
  to: d('2027-07-08'),
  terms: [
    { number: 1, from: d('2026-09-20'), to: d('2026-12-17') },
    { number: 2, from: d('2027-01-03'), to: d('2027-03-18') },
    { number: 3, from: d('2027-04-04'), to: d('2027-07-08') },
  ],
  source: 'made up',
};

const window = (id: string, term: number, from: string, to: string, grades: string[]): CalendarEntry => ({
  id,
  layer: 'national',
  from: d(from),
  to: d(to),
  effect: 'exam',
  term,
  grades,
  name: { en: id },
  source: 'made up',
  confidence: 'announced',
});
const moved = (entry: CalendarEntry, from: string, to: string, reason: string): CalendarEntry => ({
  ...entry,
  from: d(from),
  to: d(to),
  moved: { from: entry.from, to: entry.to, reason },
});

const others = ['1am', '2am', '3am'];
const t1 = window('t1', 1, '2026-12-06', '2026-12-10', [...others, '4am']);
const t3 = window('t3-4am', 3, '2027-05-09', '2027-05-11', ['4am']);
const entries = [t1, window('t3', 3, '2027-05-23', '2027-05-27', others), t3];
const update = (published: string, ...held: CalendarEntry[]) => ({ published: d(published), entries: held });

describe('the exams an update moved', () => {
  it('names the days a moved exam had, why and when it was announced', () => {
    const first = moved(t1, '2026-12-13', '2026-12-15', 'A made-up council decision');
    const now = [first, ...entries.slice(1)];
    const was = worldExams(year, entries)[0]!;
    const is = worldExams(year, now)[0]!;
    const moves = examMoves(year, now, [update('2026-11-01', first), update('2026-11-08', first)]);
    assert.deepEqual(moves, [
      {
        exam: is.id,
        before: { from: was.from, to: was.to, figuresDay: was.figuresDay, signBy: was.signBy },
        reason: 'A made-up council decision',
        announced: d('2026-11-01'),
      },
    ]);
    assert.equal(is.id, was.id);
    assert.notEqual(is.figuresDay, was.figuresDay);
  });

  it('takes the day the same move was first announced, not a later update of the entry', () => {
    const first = moved(t1, '2026-12-13', '2026-12-15', 'A made-up first reason');
    const again = moved(t1, '2026-12-14', '2026-12-16', 'A made-up second reason');
    const now = [again, ...entries.slice(1)];
    const moves = examMoves(year, now, [
      update('2026-11-01', first),
      update('2026-11-15', again),
      update('2026-11-22', again),
    ]);
    assert.deepEqual(
      moves.map((one) => [one.reason, one.announced]),
      [['A made-up second reason', d('2026-11-15')]],
    );
  });

  it('gives each exam the reason of the entry whose move changes it, with two moved', () => {
    const early = moved(t1, '2026-12-13', '2026-12-15', 'A made-up term 1 reason');
    const later = moved(t3, '2027-05-16', '2027-05-18', 'A made-up term 3 reason');
    const now = [early, entries[1]!, later];
    const moves = examMoves(year, now, [update('2026-11-01', later), update('2026-11-08', early)]);
    const above = new Set(
      worldExams(year, now)
        .filter((one) => one.setBy !== 'school')
        .map((one) => one.id),
    );
    assert.ok(moves.some((one) => above.has(one.exam)));
    for (const one of moves)
      assert.deepEqual(
        [one.reason, one.announced],
        one.exam === worldExams(year, now)[0]!.id
          ? ['A made-up term 1 reason', d('2026-11-08')]
          : ['A made-up term 3 reason', d('2026-11-01')],
      );
  });

  it('keeps windows moved together as one move, as one exam needs them both', () => {
    const others1 = window('t1-others', 1, '2026-12-06', '2026-12-10', others);
    const last1 = window('t1-4am', 1, '2026-12-06', '2026-12-10', ['4am']);
    const split = [others1, last1, ...entries.slice(1)];
    const reason = 'A made-up reason for both';
    const both = [moved(others1, '2026-12-13', '2026-12-15', reason), moved(last1, '2026-12-13', '2026-12-15', reason)];
    const moves = examMoves(year, [...both, ...entries.slice(1)], [update('2026-11-01', ...both)]);
    assert.deepEqual(
      moves.map((one) => [one.exam, one.reason, one.announced]),
      [[worldExams(year, split)[0]!.id, reason, d('2026-11-01')]],
    );
  });

  it('keeps the figures day of an exam moved within its week, its signing deadline moving', () => {
    const now = [moved(t1, '2026-12-08', '2026-12-10', 'A made-up shorter move'), ...entries.slice(1)];
    const [one] = examMoves(year, now, []);
    const is = worldExams(year, now)[0]!;
    assert.deepEqual([one?.before.figuresDay === is.figuresDay, one?.before.signBy === is.signBy], [true, false]);
  });

  it('moves nothing while no entry moved', () => {
    assert.deepEqual(examMoves(year, entries, [update('2026-11-01', t1)]), []);
  });

  it('moves the mock exam and the BEM with the last grade’s term 3 window, with its reason', () => {
    const later = moved(t3, '2027-05-16', '2027-05-18', 'A made-up later window');
    const now = [...entries.slice(0, 2), later];
    const moves = examMoves(year, now, [update('2027-03-01', later)]);
    const ids = new Set(moves.map((one) => one.exam));
    const above = worldExams(year, now).filter((one) => one.setBy !== 'school' && ids.has(one.id));
    assert.ok(above.length > 0);
    for (const one of moves) assert.deepEqual([one.reason, one.announced], ['A made-up later window', d('2027-03-01')]);
  });

  it('moves the mock exam with a moved day without school that its week falls in', () => {
    const off: CalendarEntry = {
      id: 'off',
      layer: 'national',
      from: d('2027-03-28'),
      to: d('2027-04-01'),
      effect: 'no-school',
      name: { en: 'off' },
      source: 'made up',
      confidence: 'announced',
    };
    const now = [...entries, moved(off, '2027-04-11', '2027-04-13', 'A made-up day off')];
    const moves = examMoves(year, now, [update('2027-02-01', now.at(-1)!)]);
    assert.deepEqual(
      moves.map((one) => [one.exam, one.reason, one.announced]),
      [['mock', 'A made-up day off', d('2027-02-01')]],
    );
  });

  it('gives no day announced for a window no update holds', () => {
    const now = [moved(t1, '2026-12-13', '2026-12-15', 'A made-up reason'), ...entries.slice(1)];
    assert.deepEqual(
      examMoves(year, now, []).map((one) => [one.reason, one.announced]),
      [['A made-up reason', null]],
    );
  });
});
