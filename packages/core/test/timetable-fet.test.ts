// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reading a school's timetable from FET's timetable CSV export (#575, answer
// 590): FET's header in any order and letter case, the room optional and other
// columns not read; the rows of one activity on one day, wherever they sit and
// in any order, are one session, from its first hour's start to its last
// hour's end, with the first row's number, and on another day another session;
// hours that do not follow one another are said on their row; a row with no
// activity ID is its own session; hours named by their times, or with the bell
// times by their number, in any digits, or their start, and otherwise said;
// students sets joined by + are taught together and not listed; a set named as
// another, then a group word and a number or a half, is a group of its class,
// through any group above it, and listed, while a level beside its classes and
// any other set are classes; several teachers, an empty cell, an unknown day
// and a missing column are said and left out, each on its row; and the
// template's clash checks apply. Every school, class and teacher is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCsv, readFetHour, readFetTimetable, type FetWords } from '../src/index.ts';

const words: FetWords = {
  days: { 0: ['sunday', 'الأحد'], 1: ['monday', 'الإثنين'] },
  groups: ['g', 'groupe', 'فوج'],
};
const HEADER = '"Activity Id","Day","Hour","Students Sets","Subject","Teachers","Activity Tags","Room","Comments"\n';
const read = (body: string, bells?: readonly (readonly [number, number])[]) =>
  readFetTimetable(parseCsv(HEADER + body), words, bells);

describe('FET timetable export', () => {
  it('reads the rows of one activity on one day as one session, with its first row', () => {
    const { sessions, problems } = read(
      '"1","Sunday","08:00-09:00","4AM2","arabic","Made-up Teacher A","t1,t2","R1",""\n' +
        '"1","Sunday","09:00-10:00","4AM2","arabic","Made-up Teacher A","t1,t2","R1",""\n' +
        '"2","الأحد","10:00-11:00","4AM3","math","Made-up Teacher B","","",""\n',
    );
    assert.deepEqual(problems, []);
    assert.deepEqual(sessions, [
      {
        row: 2,
        class: '4AM2',
        group: '',
        subject: 'arabic',
        teacher: 'Made-up Teacher A',
        room: 'R1',
        day: 0,
        start: 480,
        end: 600,
        week: 'both',
      },
      {
        row: 4,
        class: '4AM3',
        group: '',
        subject: 'math',
        teacher: 'Made-up Teacher B',
        room: '',
        day: 0,
        start: 600,
        end: 660,
        week: 'both',
      },
    ]);
  });

  it('reads the header in any order and case, without the room, past blank rows', () => {
    const { sessions, problems } = readFetTimetable(
      parseCsv(
        '\uFEFFsubject,TEACHERS,day,hour,students sets,activity id\n\n' +
          'arabic,Made-up Teacher A,monday,8h00 - 9h00,4AM2,7\n' +
          'arabic,Made-up Teacher A,Sunday,08:00-09:00,4AM2,7\n',
      ),
      words,
    );
    assert.deepEqual(problems, []);
    assert.deepEqual(
      sessions.map((one) => [one.row, one.day, one.room]),
      [
        [3, 1, ''],
        [4, 0, ''],
      ],
    );
  });

  it('takes an hour named by its number from the bell times, and says it without them', () => {
    const body = '"1","Sunday","2","4AM2","arabic","Made-up Teacher A","","R1",""\n';
    const bells = [
      [480, 540],
      [540, 600],
    ] as const;
    assert.deepEqual(
      read(body, bells).sessions.map((one) => [one.start, one.end]),
      [[540, 600]],
    );
    assert.deepEqual(read(body).problems, [{ row: 2, kind: 'time', value: '2' }]);
    assert.deepEqual(read(body.replace('"2"', '"3"'), bells).problems, [{ row: 2, kind: 'time', value: '3' }]);
    assert.deepEqual(readFetHour('\u0662', bells), [540, 600]);
    assert.deepEqual(readFetHour('8h00', bells), [480, 540]);
    assert.equal(readFetHour('08:00'), null);
    assert.equal(readFetHour('08:30', bells), null);
  });

  it('reads hours named by their times, and nothing else', () => {
    assert.deepEqual(readFetHour('08:00-09:00'), [480, 540]);
    assert.deepEqual(readFetHour(' 8h00 – 9h30 '), [480, 570]);
    assert.deepEqual(readFetHour('٠٨:٠٠-٠٩:٠٠'), [480, 540]);
    for (const name of ['09:00-08:00', '08:00-09:00-10:00', 'morning', '0', ''])
      assert.equal(readFetHour(name, [[480, 540]]), null, name);
  });

  it('teaches sets joined by + together, and reads a set named after another as its group', () => {
    const { sessions, problems, together, groups } = read(
      '"1","Sunday","08:00-09:00","4AM2+4AM3","english","Made-up Teacher A","","R1",""\n' +
        '"2","Monday","08:00-09:00","4AM2 G1","physics","Made-up Teacher B","","Lab",""\n' +
        '"3","Monday","08:00-09:00","4AM2-G2","science","Made-up Teacher C","","R2",""\n' +
        '"4","Monday","09:00-10:00","4AM20+1AM","sport","Made-up Teacher D","","",""\n' +
        '"5","Monday","10:00-11:00","4AM3_فوج 1","physics","Made-up Teacher B","","Lab",""\n' +
        '"6","Sunday","10:00-11:00","4AM2 G1 1/2","informatics","Made-up Teacher E","","Lab",""\n',
    );
    assert.deepEqual(problems, []);
    assert.deepEqual(
      sessions.map((one) => [one.row, one.class, one.group]),
      [
        [2, '4AM2', ''],
        [2, '4AM3', ''],
        [3, '4AM2', 'G1'],
        [4, '4AM2', 'G2'],
        [5, '4AM20', ''],
        [5, '1AM', ''],
        [6, '4AM3', 'فوج 1'],
        [7, '4AM2', 'G1 1/2'],
      ],
    );
    assert.deepEqual(together, []);
    assert.deepEqual(groups, [
      { set: '4AM2 G1', class: '4AM2', group: 'G1' },
      { set: '4AM2-G2', class: '4AM2', group: 'G2' },
      { set: '4AM3_فوج 1', class: '4AM3', group: 'فوج 1' },
      { set: '4AM2 G1 1/2', class: '4AM2', group: 'G1 1/2' },
    ]);
  });

  it('reads a level beside its classes, and any set without a group word, as a class', () => {
    const { sessions, groups } = read(
      '"1","Sunday","08:00-09:00","1AS","assembly","Made-up Teacher A","","Yard",""\n' +
        '"2","Sunday","09:00-10:00","1AS ST1","math","Made-up Teacher B","","R1",""\n' +
        '"3","Sunday","09:00-10:00","1AS L1","arabic","Made-up Teacher C","","R2",""\n' +
        '"4","Sunday","10:00-11:00","1AS ST1 Gx","math","Made-up Teacher B","","R1",""\n',
    );
    assert.deepEqual(
      sessions.map((one) => [one.class, one.group]),
      [
        ['1AS', ''],
        ['1AS ST1', ''],
        ['1AS L1', ''],
        ['1AS ST1 Gx', ''],
      ],
    );
    assert.deepEqual(groups, []);
  });

  it('joins an activity’s rows wherever they sit, and says hours that do not follow one another', () => {
    const { sessions, problems } = read(
      '"1","Sunday","09:00-10:00","4AM2","arabic","Made-up Teacher A","","R1",""\n' +
        '"2","Sunday","10:00-11:00","4AM3","math","Made-up Teacher B","","R2",""\n' +
        '"1","Sunday","08:00-09:00","4AM2","arabic","Made-up Teacher A","","R1",""\n' +
        '"3","Monday","08:00-09:00","4AM2","french","Made-up Teacher C","","R3",""\n' +
        '"3","Monday","10:00-11:00","4AM2","french","Made-up Teacher C","","R3",""\n' +
        '"4","Sunday","11:00-12:30","4AM2","music","Made-up Teacher E","","R4",""\n' +
        '"4","Sunday","12:00-13:00","4AM2","music","Made-up Teacher E","","R4",""\n' +
        '"","Monday","11:00-12:00","4AM3","sport","Made-up Teacher D","","",""\n' +
        '"","Monday","11:00-12:00","4AM2","sport","Made-up Teacher D","","",""\n',
    );
    assert.deepEqual(problems, [
      { row: 6, kind: 'time', value: '10:00-11:00' },
      { row: 8, kind: 'time', value: '12:00-13:00' },
    ]);
    assert.deepEqual(
      sessions.map((one) => [one.row, one.class, one.start, one.end]),
      [
        [2, '4AM2', 480, 600],
        [3, '4AM3', 600, 660],
        [9, '4AM3', 660, 720],
        [10, '4AM2', 660, 720],
      ],
    );
  });

  it('says several teachers, an empty cell, an unknown day and an unreadable hour, and leaves them out', () => {
    const { sessions, problems } = read(
      '"1","Sunday","08:00-09:00","4AM2","arabic","Made-up Teacher A+Made-up Teacher B","","",""\n' +
        '"2","Sunday","09:00-10:00","4AM2","","Made-up Teacher A","","",""\n' +
        '"3","Friday","08:00-09:00","4AM2","arabic","Made-up Teacher A","","",""\n' +
        '"4","Sunday","10:00-11:00","+","arabic","Made-up Teacher A","","",""\n' +
        '"5","Monday","08:00-09:00","4AM2","arabic","Made-up Teacher A","","",""\n' +
        '"5","Monday","noon","4AM2","arabic","Made-up Teacher A","","",""\n' +
        '"6","Monday","10:00-11:00","4AM2","arabic","Made-up Teacher A","","",""\n',
    );
    assert.deepEqual(problems, [
      { row: 2, kind: 'teachers', value: 'Made-up Teacher A+Made-up Teacher B' },
      { row: 3, kind: 'empty', column: 'subject' },
      { row: 4, kind: 'day', value: 'Friday' },
      { row: 5, kind: 'empty', column: 'class' },
      { row: 7, kind: 'time', value: 'noon' },
    ]);
    assert.deepEqual(
      sessions.map((one) => one.row),
      [8],
    );
  });

  it('says the columns FET writes that are missing', () => {
    assert.deepEqual(readFetTimetable(parseCsv('Day,Hour,Subject,Room\n'), words).problems, [
      { row: 1, kind: 'fet-columns', missing: ['activity id', 'students sets', 'teachers'] },
    ]);
    assert.deepEqual(readFetTimetable([], words).problems, [
      { row: 1, kind: 'fet-columns', missing: ['activity id', 'day', 'hour', 'students sets', 'subject', 'teachers'] },
    ]);
  });

  it('applies the template’s clash checks', () => {
    const { sessions, problems } = read(
      '"1","Sunday","08:00-10:00","4AM2","arabic","Made-up Teacher A","","R1",""\n' +
        '"2","Sunday","09:00-10:00","4AM3","math","made-up  teacher a","","R2",""\n' +
        '"3","Sunday","08:00-09:00","4AM2 G1","physics","Made-up Teacher B","","Lab",""\n' +
        '"4","Monday","08:00-09:00","4AM2 G1","physics","Made-up Teacher B","","Lab",""\n' +
        '"5","Monday","08:00-09:00","4AM2 G2","science","Made-up Teacher C","","R1",""\n' +
        '"6","Monday","08:00-09:00","4AM3","history","Made-up Teacher D","","lab",""\n',
    );
    assert.deepEqual(problems, [
      { row: 3, kind: 'teacher', with: 2 },
      { row: 4, kind: 'class', with: 2 },
      { row: 7, kind: 'room', with: 5 },
    ]);
    assert.deepEqual(
      sessions.map((one) => one.row),
      [2, 5, 6],
    );
  });
});
