// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A timetable read from a file as each class's week (#576, answer 593): the
// classes come under their first spelling in reading order, 1AM2 before 1AM10;
// a class's grid has a row for each time, earliest first, and a column for each
// working day, then any other day a session takes; a cell holds the whole class
// first, then its groups, week A before week B; and the alternating weeks
// balance for each group of pupils and each teacher, as when two groups swap
// two labs from week to week, a group's week holding the whole class's
// sessions, its own and those of each group it is within, the smallest groups
// being checked, and a group with a single group within it too, two spellings
// of a group being one, while a session taught to several classes together
// counts once for its teacher, and a timetable with no week A or B says it does
// not alternate. Every class and teacher is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { alternates, classGrid, timetableClasses, weekBalance, type ImportedSession } from '../src/index.ts';

let row = 1;
/** A session of an hour from the given hour, every week, for the whole class, unless told otherwise. */
const session = (fields: Partial<ImportedSession> & Pick<ImportedSession, 'class' | 'teacher'>): ImportedSession => ({
  row: (row += 1),
  group: '',
  subject: 'math',
  room: '',
  day: 0,
  start: 480,
  end: 540,
  week: 'both',
  ...fields,
});

describe('the classes of a timetable', () => {
  it('lists each class once, under its first spelling, in reading order', () => {
    const sessions = [
      session({ class: '1AM10', teacher: 'Teacher A' }),
      session({ class: '1AM2', teacher: 'Teacher A', start: 540, end: 600 }),
      session({ class: '1am2', teacher: 'Teacher B', day: 1 }),
    ];
    assert.deepEqual(timetableClasses(sessions), ['1AM2', '1AM10']);
  });
});

describe("a class's grid", () => {
  it('has a row for each time and a column for each working day, then any other day', () => {
    const sessions = [
      session({ class: '4AM2', teacher: 'Teacher A', day: 1, start: 540, end: 600 }),
      session({ class: '4AM2', teacher: 'Teacher B', day: 0 }),
      session({ class: '4AM2', teacher: 'Teacher C', day: 5 }),
      session({ class: '4AM3', teacher: 'Teacher D', day: 2, start: 420, end: 480 }),
    ];
    const grid = classGrid(sessions, '4am2', [0, 1, 2]);
    assert.deepEqual(grid.days, [0, 1, 2, 5]);
    assert.deepEqual(
      grid.slots.map((slot) => [slot.start, slot.end]),
      [
        [480, 540],
        [540, 600],
      ],
    );
    assert.deepEqual(
      grid.slots.map((slot) => slot.cells.map((cell) => cell.map((one) => one.teacher))),
      [
        [['Teacher B'], [], [], ['Teacher C']],
        [[], ['Teacher A'], [], []],
      ],
    );
  });

  it('holds the whole class first, then its groups, week A before week B', () => {
    const sessions = [
      session({ class: '4AM2', teacher: 'Teacher A', group: 'G2', week: 'B' }),
      session({ class: '4AM2', teacher: 'Teacher B', group: 'G10', week: 'A' }),
      session({ class: '4AM2', teacher: 'Teacher C', group: 'G2', week: 'A' }),
      session({ class: '4AM2', teacher: 'Teacher D', day: 1, week: 'A' }),
      session({ class: '4AM2', teacher: 'Teacher E', day: 1, group: 'G1', week: 'B' }),
    ];
    const grid = classGrid(sessions, '4AM2', [0, 1]);
    assert.deepEqual(
      grid.slots[0]?.cells.map((cell) => cell.map((one) => `${one.group}${one.week}`)),
      [
        ['G2A', 'G2B', 'G10A'],
        ['A', 'G1B'],
      ],
    );
  });

  it('is empty for a class the timetable does not give', () => {
    assert.deepEqual(classGrid([], '4AM2', [0, 1]), { days: [0, 1], slots: [] });
  });
});

describe('the balance of weeks A and B', () => {
  it('says a timetable with no week A or B does not alternate, and finds nothing to balance', () => {
    const sessions = [session({ class: '4AM2', teacher: 'Teacher A' })];
    assert.equal(alternates(sessions), false);
    assert.deepEqual(weekBalance(sessions), []);
  });

  it('balances groups that swap two labs from week to week, with the whole class in both weeks', () => {
    const lab = { start: 540, end: 660 };
    const sessions = [
      session({ class: '4AM2', teacher: 'Teacher A' }),
      session({ class: '4AM2', teacher: 'Teacher B', subject: 'physics', group: 'G1', week: 'A', ...lab }),
      session({ class: '4AM2', teacher: 'Teacher C', subject: 'technology', group: 'G2', week: 'A', ...lab }),
      session({ class: '4AM2', teacher: 'Teacher B', subject: 'physics', group: 'G2', week: 'B', ...lab }),
      session({ class: '4AM2', teacher: 'Teacher C', subject: 'technology', group: 'G1', week: 'B', ...lab }),
    ];
    assert.equal(alternates(sessions), true);
    assert.deepEqual(weekBalance(sessions), []);
  });

  it('finds each group and teacher whose week A is not as long as week B', () => {
    const sessions = [
      session({ class: '4AM2', teacher: 'Teacher A' }),
      session({ class: '4AM2', teacher: 'Teacher B', group: 'G1', week: 'A', start: 540, end: 660 }),
      session({ class: '4AM2', teacher: 'Teacher B', group: 'G2', week: 'A', start: 660, end: 720 }),
      session({ class: '4AM3', teacher: 'Teacher C', week: 'B' }),
    ];
    assert.deepEqual(weekBalance(sessions), [
      { kind: 'class', name: '4AM2', group: 'G1', a: 180, b: 60 },
      { kind: 'class', name: '4AM2', group: 'G2', a: 120, b: 60 },
      { kind: 'class', name: '4AM3', group: '', a: 0, b: 60 },
      { kind: 'teacher', name: 'Teacher B', group: '', a: 180, b: 0 },
      { kind: 'teacher', name: 'Teacher C', group: '', a: 0, b: 60 },
    ]);
  });

  it('counts a session taught to several classes together once for its teacher', () => {
    const sessions = [
      session({ class: '4AM2', teacher: 'Teacher A', week: 'A' }),
      session({ class: '4AM3', teacher: 'teacher a', week: 'A' }),
      session({ class: '4AM2', teacher: 'Teacher A', week: 'B', day: 1 }),
    ];
    assert.deepEqual(
      weekBalance(sessions).filter((one) => one.kind === 'teacher'),
      [],
    );
  });

  it('takes two spellings of a group as one, and checks the smallest groups, and a group split once', () => {
    const spelt = [
      session({ class: '4AM2', teacher: 'Teacher A', group: 'G1', week: 'A' }),
      session({ class: '4AM2', teacher: 'Teacher A', group: 'g1', week: 'B', day: 1 }),
    ];
    assert.deepEqual(weekBalance(spelt), []);
    const nested = [
      session({ class: '4AM2', teacher: 'Teacher A', group: 'G1', week: 'A' }),
      session({ class: '4AM2', teacher: 'Teacher B', group: 'G1 1/2', week: 'B', day: 1 }),
      session({ class: '4AM2', teacher: 'Teacher C', group: 'G1 2/2', week: 'B', day: 1 }),
      session({ class: '4AM2', teacher: 'Teacher D', group: 'G2', week: 'B', day: 2 }),
    ];
    assert.deepEqual(
      weekBalance(nested).filter((one) => one.kind === 'class'),
      [{ kind: 'class', name: '4AM2', group: 'G2', a: 0, b: 60 }],
    );
    const half = [
      session({ class: '4AM2', teacher: 'Teacher A', group: 'G1', week: 'A' }),
      session({ class: '4AM2', teacher: 'Teacher B', group: 'G1 1/2', week: 'B', day: 1 }),
    ];
    assert.deepEqual(weekBalance(half), [
      { kind: 'class', name: '4AM2', group: 'G1', a: 60, b: 0 },
      { kind: 'teacher', name: 'Teacher A', group: '', a: 60, b: 0 },
      { kind: 'teacher', name: 'Teacher B', group: '', a: 0, b: 60 },
    ]);
    const deep = [...half, session({ class: '4AM2', teacher: 'Teacher C', group: 'G1 1/2 a', week: 'B', day: 2 })];
    assert.deepEqual(
      weekBalance(deep).filter((one) => one.kind === 'class'),
      [
        { kind: 'class', name: '4AM2', group: 'G1', a: 60, b: 0 },
        { kind: 'class', name: '4AM2', group: 'G1 1/2 a', a: 60, b: 120 },
      ],
    );
  });
});
