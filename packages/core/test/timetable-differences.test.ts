// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a school's timetable changes in a teacher's week, and a week of several
// schools (#580, answer 608): a session in both weeks at the same time is the
// same, its room changed or not, whatever the spelling of its names; a session
// of the same class, group and subject elsewhere, or in another week, moved,
// paired in the order of day and time; the rest was removed or added; each
// class's sessions are counted under its first spelling; each school's sessions
// are counted; and two schools' sessions at the same time in a week they share
// clash, while week A and week B do not, nor two sessions of one school. Every
// school and class is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classSessions, schoolsWeek, weekDifferences, type TimetableRow } from '../src/index.ts';

const row = (of: string, day: 0 | 1 | 2 | 3 | 4, start: number, change: Partial<TimetableRow> = {}): TimetableRow => ({
  class: of,
  group: '',
  subject: 'رياضيات',
  room: 'ق1',
  day,
  start,
  end: start + 60,
  week: 'both',
  ...change,
});

describe('a teacher’s week against a school’s', () => {
  it('finds what stayed, moved, changed room, came and went', () => {
    const drawn = [row('4م3', 0, 900), row('4م1', 4, 660), row('4م2', 1, 480), row('4م2', 3, 480)];
    const received = [row('4م3', 0, 840), row('4م2', 2, 540), row(' 4م2 ', 1, 480, { room: 'ق2' }), row('4م2', 3, 480)];
    assert.deepEqual(
      weekDifferences(drawn, received).map((one) => [one.kind, one.before?.day, one.before?.start, one.after?.day]),
      [
        ['moved', 0, 900, 0],
        ['room', 1, 480, 1],
        ['added', undefined, undefined, 2],
        ['removed', 4, 660, undefined],
      ],
    );
    assert.deepEqual(weekDifferences(received, received), []);
    const weekA = weekDifferences([row('4م2', 1, 480)], [row('4م2', 1, 480, { week: 'A' })]);
    assert.deepEqual(
      weekA.map((one) => [one.kind, one.before?.week, one.after?.week]),
      [['moved', 'both', 'A']],
    );
  });

  it('counts each class’s sessions under its first spelling', () => {
    assert.deepEqual(
      [...classSessions([row('4م2', 1, 480), row(' 4م2 ', 2, 480), row('4م1', 0, 480)])],
      [
        ['4م1', 1],
        ['4م2', 2],
      ],
    );
  });
});

describe('a week of several schools', () => {
  it('marks two schools at the same time in a week they share', () => {
    const feth = [row('5AP-C', 4, 540), row('3AP-A', 0, 480, { week: 'A' })];
    const riadh = [row('5AP-C', 4, 540), row('3AP-B', 0, 480, { week: 'B' }), row('4AP-A', 4, 570)];
    const week = schoolsWeek([
      { school: 'Feth', rows: feth },
      { school: 'Riadh', rows: riadh },
    ]);
    assert.equal(week.rows.length, 5);
    assert.deepEqual(
      [...week.counts],
      [
        ['Feth', 2],
        ['Riadh', 3],
      ],
    );
    assert.deepEqual(
      week.clashes.map(([a, b]) => [a.school, a.class, a.start, b.school, b.class, b.start]),
      [
        ['Feth', '5AP-C', 540, 'Riadh', '5AP-C', 540],
        ['Feth', '5AP-C', 540, 'Riadh', '4AP-A', 570],
      ],
    );
    assert.deepEqual(schoolsWeek([{ school: 'Feth', rows: [...feth, row('1', 4, 540)] }]).clashes, []);
  });
});
