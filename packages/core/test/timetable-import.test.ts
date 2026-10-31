// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reading a school's timetable from its CSV template (#574): the header, under
// a title or not, names the columns in any order and in any of the app's
// languages, and an unknown one is said; each row is a session, read in the
// words given for days and weeks, with times as H:MM, HhMM or with seconds, in
// Latin or Arabic-Indic digits; two spellings of a name, or one with a
// direction mark, are one person; a teacher, a class or a room in two places at
// once is a clash on the row that makes it, with the row it meets, even a row
// left out for its own clash, while two groups of a class, weeks A and B, or
// classes taught together never meet, and those taught together are listed; a
// missing column, an empty or unreadable cell, an end before the start, and a
// column named twice are each said with their row; rows are numbered as a
// spreadsheet does, past blank rows and cells on two lines, in a file with
// semicolons and a byte-order mark; a row with a problem is left out while the
// rest are read; and one word naming two things is a mistake in the app's
// words. Every school, class and teacher is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCsv, readTime, readTimetable, type TimetableWords } from '../src/index.ts';

const words: TimetableWords = {
  columns: {
    class: ['class', 'القسم'],
    group: ['group', 'الفوج'],
    subject: ['subject', 'المادة'],
    teacher: ['teacher', 'الأستاذ'],
    day: ['day', 'اليوم'],
    start: ['start', 'من'],
    end: ['end', 'إلى'],
    room: ['room', 'القاعة'],
    week: ['week', 'الأسبوع'],
  },
  days: { 0: ['sunday', 'الأحد'], 1: ['monday', 'الإثنين'], 2: ['tuesday', 'الثلاثاء'] },
  weeks: { A: ['a', 'أ'], B: ['b', 'ب'] },
};

const read = (csv: string) => readTimetable(parseCsv(csv), words);

describe('the timetable template', () => {
  it('reads each row as a session, in any column order and letter case', () => {
    const { sessions, problems } = read(
      'Teacher,Class,Subject,Day,Start,End,Room\n' +
        'Made-up Teacher A,4AM2,arabic,Sunday,8:00,9:00,R1\n' +
        ' made-up  teacher a ,4AM3,arabic,sunday,09h00,10:00,\n',
    );
    assert.deepEqual(problems, []);
    assert.deepEqual(sessions[0], {
      row: 2,
      class: '4AM2',
      group: '',
      subject: 'arabic',
      teacher: 'Made-up Teacher A',
      room: 'R1',
      day: 0,
      start: 480,
      end: 540,
      week: 'both',
    });
    assert.equal(sessions[1]?.start, 540);
  });

  it('reads a header and cells in Arabic, as the app’s words give them', () => {
    const { sessions, problems } = read(
      'القسم,المادة,الأستاذ,اليوم,من,إلى,الأسبوع\n4م2,العربية,أستاذ مختلق,الإثنين,08:00,09:00,أ\n',
    );
    assert.deepEqual(problems, []);
    assert.equal(sessions[0]?.day, 1);
    assert.equal(sessions[0]?.week, 'A');
  });

  it('says a clash of teacher, class or room on the row that makes it, with the row it meets', () => {
    const { sessions, problems } = read(
      'class,subject,teacher,day,start,end,room\n' +
        '4AM1,math,Teacher M,sunday,8:00,9:00,R1\n' +
        '4AM2,math,teacher m,sunday,8:30,9:30,R2\n' +
        '4AM1,french,Teacher F,sunday,8:00,9:00,R3\n' +
        '4AM3,french,Teacher F,sunday,8:00,9:00,r1\n' +
        '4AM1,math,Teacher M,sunday,9:00,10:00,R1\n',
    );
    assert.deepEqual(problems, [
      { row: 3, kind: 'teacher', with: 2 },
      { row: 4, kind: 'class', with: 2 },
      { row: 5, kind: 'teacher', with: 4 },
      { row: 5, kind: 'room', with: 2 },
      { row: 6, kind: 'teacher', with: 3 },
    ]);
    assert.deepEqual(
      sessions.map((one) => one.row),
      [2],
    );
  });

  it('lets two groups of a class, or weeks A and B, share a time, but not a group with the whole class', () => {
    const { sessions, problems } = read(
      'class,group,subject,teacher,day,start,end,week\n' +
        '1AM1,1,science,Teacher S,monday,8:00,9:00,\n' +
        '1AM1,2,physics,Teacher P,monday,8:00,9:00,\n' +
        '1AM1,,arabic,Teacher A,monday,8:30,9:30,\n' +
        '1AM2,,music,Teacher U,tuesday,8:00,9:00,a\n' +
        '1AM2,,art,Teacher U,tuesday,8:00,9:00,B\n' +
        '1AM2,,sport,Teacher T,tuesday,8:00,9:00,\n',
    );
    assert.deepEqual(problems, [
      { row: 4, kind: 'class', with: 2 },
      { row: 7, kind: 'class', with: 5 },
    ]);
    assert.deepEqual(
      sessions.map((one) => [one.row, one.week]),
      [
        [2, 'both'],
        [3, 'both'],
        [5, 'A'],
        [6, 'B'],
      ],
    );
  });

  it('says each problem with its row and reads the rest', () => {
    const { sessions, problems } = read(
      'class,subject,teacher,day,start,end,week\n' +
        '4AM1,,Teacher A,sunday,8:00,9:00,\n' +
        '4AM1,arabic,Teacher A,friday,8:00,9:00,\n' +
        '4AM1,arabic,Teacher A,sunday,8,9:00,\n' +
        '4AM1,arabic,Teacher A,sunday,8:00,24:00,\n' +
        '4AM1,arabic,Teacher A,sunday,9:00,8:00,\n' +
        '4AM1,arabic,Teacher A,sunday,8:00,9:00,C\n' +
        ',,,,,,\n' +
        '4AM1,arabic,Teacher A,sunday,8:00,9:00,\n',
    );
    assert.deepEqual(problems, [
      { row: 2, kind: 'empty', column: 'subject' },
      { row: 3, kind: 'day', value: 'friday' },
      { row: 4, kind: 'time', value: '8' },
      { row: 5, kind: 'time', value: '24:00' },
      { row: 6, kind: 'order' },
      { row: 7, kind: 'week', value: 'C' },
    ]);
    assert.deepEqual(
      sessions.map((one) => one.row),
      [9],
    );
  });

  it('says a clash with a row left out for its own clash, so each clash is said in one reading', () => {
    const { sessions, problems } = read(
      'class,subject,teacher,day,start,end,room\n' +
        '4AM1,math,Teacher T,sunday,8:00,9:00,R1\n' +
        '4AM2,math,Teacher T,sunday,8:00,9:00,R2\n' +
        '4AM3,french,Teacher F,sunday,8:00,9:00,R2\n',
    );
    assert.deepEqual(problems, [
      { row: 3, kind: 'teacher', with: 2 },
      { row: 4, kind: 'room', with: 3 },
    ]);
    assert.deepEqual(
      sessions.map((one) => one.row),
      [2],
    );
  });

  it('reads two spellings of one name, or one with a direction mark, as one person', () => {
    const { problems } = read(
      'class,subject,teacher,day,start,end\n' +
        '4AM1,arabic,أحمد مختلق,sunday,8:00,9:00\n' +
        '4AM2,history,احمـد مختلق,sunday,8:00,9:00\n' +
        '4AM3,math,T,monday,8:00,9:00\n' +
        '4AM4,physics,T\u200f,monday,8:00,9:00\n',
    );
    assert.deepEqual(problems, [
      { row: 3, kind: 'teacher', with: 2 },
      { row: 5, kind: 'teacher', with: 4 },
    ]);
  });

  it('reads classes taught together as one session, but not one teacher with two subjects or rooms', () => {
    const { sessions, problems, together } = read(
      'class,subject,teacher,day,start,end,room\n' +
        '1AS1,german,Teacher G,sunday,8:00,9:00,R7\n' +
        '1AS2,german,teacher g,sunday,8:00,9:00,R7\n' +
        '1AS3,german,Teacher G,sunday,8:00,9:00,\n' +
        '1AS4,spanish,Teacher G,sunday,8:00,9:00,R7\n' +
        '1AS5,german,Teacher G,sunday,8:00,9:00,R8\n' +
        '1AS6,german,Teacher G,sunday,8:30,9:00,R7\n',
    );
    assert.deepEqual(
      sessions.map((one) => one.row),
      [2, 3, 4],
    );
    assert.deepEqual(problems, [
      { row: 5, kind: 'teacher', with: 2 },
      { row: 5, kind: 'room', with: 2 },
      { row: 6, kind: 'teacher', with: 2 },
      { row: 7, kind: 'teacher', with: 2 },
      { row: 7, kind: 'room', with: 2 },
    ]);
    assert.deepEqual(together, [
      { row: 3, with: 2 },
      { row: 4, with: 2 },
    ]);
  });

  it('finds the header under a title, says a header cell it does not know, and numbers rows as a spreadsheet', () => {
    const { sessions, problems } = read(
      '\uFEFFMade-up timetable 2026;;;\n\n' +
        'class;subject;teacher;day;start;end;sale\n' +
        '4AM1;arabic;Teacher A;sunday;8:00:00;9:00:00;R1\n\n' +
        '4AM2;"arabic\nlanguage";Teacher B;sunday;8:00;9:00;R1\n' +
        '4AM2;math;Teacher B;sunday;8:30;9:30;R1\n',
    );
    assert.deepEqual(
      sessions.map((one) => [one.row, one.start, one.subject]),
      [
        [4, 480, 'arabic'],
        [6, 480, 'arabic\nlanguage'],
      ],
    );
    assert.deepEqual(problems, [
      { row: 3, kind: 'column-unknown', value: 'sale' },
      { row: 7, kind: 'teacher', with: 6 },
      { row: 7, kind: 'class', with: 6 },
    ]);
  });

  it('refuses words of the app that name two columns, days or weeks', () => {
    const twice = (change: Partial<TimetableWords>) => () => readTimetable([['class']], { ...words, ...change });
    assert.throws(twice({ days: { 0: ['sunday'], 1: ['Sunday'] } }), RangeError);
    assert.throws(twice({ weeks: { A: ['a'], B: ['A'] } }), RangeError);
    assert.throws(twice({ columns: { ...words.columns, room: ['room', 'class'] } }), RangeError);
  });

  it('reads nothing when the header lacks a column or names one twice', () => {
    assert.deepEqual(read('class,subject,teacher,day,start\n4AM1,arabic,T,sunday,8:00\n'), {
      sessions: [],
      problems: [{ row: 1, kind: 'columns', missing: ['end'] }],
      together: [],
    });
    assert.deepEqual(read('class,subject,teacher,day,start,end,القسم\n').problems, [
      { row: 1, kind: 'column-twice', column: 'class' },
    ]);
    assert.deepEqual(readTimetable([], words).problems, [
      { row: 1, kind: 'columns', missing: ['class', 'subject', 'teacher', 'day', 'start', 'end'] },
    ]);
  });

  it('reads times as H:MM, HH:MM, HhMM or H.MM, with :00 seconds or none, in either digits, and nothing else', () => {
    const times = ['8:05', '08:05', '8h05', '8H05', '8.05', ' 13:30 ', '8:05:00', '٨:٠٥', '۱۳:۳۰'];
    assert.deepEqual(times.map(readTime), [485, 485, 485, 485, 485, 810, 485, 485, 810]);
    const wrong = ['8', '8:5', '24:00', '12:60', 'eight', '8:00 am', '8:00:30'];
    assert.deepEqual(
      wrong.map(readTime),
      wrong.map(() => null),
    );
  });
});
