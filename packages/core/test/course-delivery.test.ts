// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a teacher's signed weeks deliver, course by course (#584, answer 612): a
// session falls on its weekday from its week's first day, Sunday or Saturday;
// over a span, each course counts, once a week at its highest version, the
// lower text winning a tie, the sessions of its signed weeks with a session in
// the span, a week the span starts or ends in included, only the span's days,
// held, awaiting, not held for the calendar, by the entry that takes the
// session, the whole day or its half, and for another cause, each session not
// held in the order of its day and start, its weeks and the latest's first day,
// named as the latest week names its class and subject, a course with only
// sessions awaiting too, in the school's order of classes, then by name,
// numbers read as numbers; a span with no signed week gives nothing. Every
// school, class and teacher is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  courseDeliveries,
  parseDay,
  sessionDay,
  type CalendarEntry,
  type Day,
  type DeliveryReading,
  type WeekRecord,
  type WeekSession,
} from '../src/index.ts';

const TOTALS = { subject: 'arabic', items: [], reached: 0, runsLong: false, covered: 0, closed: 0 };
const at = (day: WeekSession['day'], start: number, state: WeekSession['state']): WeekSession => ({
  day,
  start,
  end: start + 60,
  group: '',
  week: 'both',
  state,
});
const week = (course: string, first: string, sessions: WeekSession[], name = '4م2', version = 0): WeekRecord => ({
  course,
  week: parseDay(first),
  version,
  totals: TOTALS,
  class: name,
  subject: 'اللغة العربية',
  sessions,
});
const [A, B, C] = ['a'.repeat(32), 'b'.repeat(32), 'c'.repeat(32)];
const HOLIDAY = parseDay('2026-12-08');
const entry = (id: string, from: Day, effect: CalendarEntry['effect'], half?: 'morning'): CalendarEntry => ({
  id,
  layer: half === undefined ? 'national' : 'school',
  from,
  to: from,
  effect,
  name: { en: id },
  source: 'Made-up calendar',
  confidence: 'announced',
  ...(half === undefined ? {} : { half }),
});
const NATIONAL = entry('holiday', HOLIDAY, 'no-school');
const MORNING = entry('morning-closure', parseDay('2026-12-10'), 'closure', 'morning');
/** The holiday takes the whole day; the morning closure, sessions before noon on its day. */
const READING: DeliveryReading = {
  takenBy: (day, session) =>
    day === HOLIDAY ? NATIONAL : day === MORNING.from && session.start < 720 ? MORNING : null,
};
const span = (from: string, to: string, weeks: WeekRecord[], reading = READING) =>
  courseDeliveries(weeks, parseDay(from), parseDay(to), reading);
const counts = (one: ReturnType<typeof courseDeliveries>[number] | undefined) =>
  one === undefined ? [] : [one.weeks, one.planned, one.held, one.awaiting, one.calendar, one.other];

describe('a course’s delivery from its signed weeks', () => {
  it('places each session on its day, from a week starting on Sunday or Saturday', () => {
    assert.equal(sessionDay(parseDay('2026-12-06'), { day: 3 }), parseDay('2026-12-09'));
    assert.equal(sessionDay(parseDay('2026-12-05'), { day: 6 }), parseDay('2026-12-05'));
    assert.equal(sessionDay(parseDay('2026-12-05'), { day: 0 }), parseDay('2026-12-06'));
  });

  it('counts the span’s sessions by state, the calendar’s losses apart with their entry, each course apart', () => {
    const weeks = [
      week(B, '2026-12-13', [at(0, 480, 'held'), at(1, 480, 'awaiting'), at(2, 480, 'held')], '4م2 ج'),
      week(A, '2026-12-06', [at(0, 480, 'held'), at(2, 600, 'not-held'), at(2, 480, 'not-held')], '4م1'),
      week(B, '2026-12-06', [at(1, 480, 'held'), at(4, 480, 'not-held'), at(4, 840, 'not-held')]),
      week(B, '2026-11-29', [at(0, 480, 'held')]),
      week(A, '2026-12-20', [at(0, 480, 'not-held')], '4م9'),
      week(C, '2026-12-06', [at(3, 480, 'awaiting')], '4م3'),
    ];
    const read = span('2026-12-01', '2026-12-14', weeks);
    assert.deepEqual(
      read.map((one) => [one.course, one.class, one.subject, one.lastWeek, ...counts(one)]),
      [
        [A, '4م1', 'اللغة العربية', parseDay('2026-12-06'), 1, 3, 1, 0, 2, 0],
        [B, '4م2 ج', 'اللغة العربية', parseDay('2026-12-13'), 2, 5, 2, 1, 1, 1],
        [C, '4م3', 'اللغة العربية', parseDay('2026-12-06'), 1, 1, 0, 1, 0, 0],
      ],
    );
    const lost = (one: (typeof read)[number] | undefined) =>
      one?.lost.map((each) => [each.day, each.session.start, each.entry?.id]);
    assert.deepEqual(lost(read[0]), [
      [HOLIDAY, 480, 'holiday'],
      [HOLIDAY, 600, 'holiday'],
    ]);
    assert.deepEqual(lost(read[1]), [
      [parseDay('2026-12-10'), 480, 'morning-closure'],
      [parseDay('2026-12-10'), 840, undefined],
    ]);
    assert.deepEqual(span('2027-01-03', '2027-01-07', weeks), []);
  });

  it('takes a week the span starts or ends in, counting the span’s days alone', () => {
    const weeks = [week(A, '2026-12-06', [at(0, 480, 'held'), at(3, 480, 'held'), at(4, 480, 'not-held')])];
    const open = { takenBy: () => null };
    assert.deepEqual(counts(span('2026-12-09', '2026-12-31', weeks, open)[0]), [1, 2, 1, 0, 0, 1]);
    assert.deepEqual(counts(span('2026-11-01', '2026-12-09', weeks, open)[0]), [1, 2, 2, 0, 0, 0]);
    assert.deepEqual(span('2026-12-11', '2026-12-31', weeks, open), []);
  });

  it('counts each course’s week once, at its highest version, the lower text winning a tie', () => {
    const first = week(A, '2026-12-06', [at(0, 480, 'awaiting'), at(1, 480, 'awaiting')]);
    const tie = [
      week(A, '2026-12-06', [at(0, 480, 'held'), at(1, 480, 'held')], '4م2', 1),
      week(A, '2026-12-06', [at(0, 480, 'not-held'), at(1, 480, 'held')], '4م2', 1),
    ];
    const both = [first, ...tie, first];
    assert.deepEqual(counts(span('2026-12-01', '2026-12-31', both)[0]), [1, 2, 2, 0, 0, 0]);
    assert.deepEqual(counts(span('2026-12-01', '2026-12-31', [...tie].reverse())[0]), [1, 2, 2, 0, 0, 0]);
  });

  it('places courses in the school’s order of classes, then by name with numbers read as numbers', () => {
    const weeks = ['1م10', '1م2', '2م1', '1م1'].map((name, index) =>
      week(String(index).repeat(32), '2026-12-06', [at(0, 480, 'held')], name),
    );
    const classes = (reading: DeliveryReading) =>
      span('2026-12-01', '2026-12-31', weeks, reading).map((one) => one.class);
    assert.deepEqual(classes(READING), ['1م1', '1م2', '1م10', '2م1']);
    const order = ['2م1', '1م10'];
    const school = {
      ...READING,
      classOrder: (name: string) => (order.includes(name) ? order.indexOf(name) : undefined),
    };
    assert.deepEqual(classes(school), ['2م1', '1م10', '1م1', '1م2']);
  });
});
