// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teacher's statement inside a demo world (#630, answer 725), on made-up
// packs, the bundled example among them, and signed weeks: the record counts
// the whole class's sessions held or not held on days no entry takes, each week
// at its version in force, within the span, and sessions not held of every
// group, exam days apart; the whole statement with nothing reached; any main
// item named, its last lesson at or before it; the last unit whose main items,
// buffers aside, are all finished, and none with only a buffer; expected
// against position, using the buffers left before counting delay, a buffer
// finished or of another term not counted; hour budgets in sessions; a week
// pack's plan up to its weeks with a recorded session, and delay in plan weeks
// from the first open item; and no statement for a stale pack, an own list, an
// item outside the main queue, or one that would not read.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { DeliveryReading } from '../src/course-delivery.ts';
import { addDays, parseDay } from '../src/day.ts';
import { parsePlanPack, type PlanPack } from '../src/pack.ts';
import type { CalendarEntry } from '../src/reference.ts';
import { STATEMENT_FORMAT } from '../src/statement-read.ts';
import type { SessionState, WeekRecord, WeekSession } from '../src/week-record.ts';
import {
  worldCourseRecord,
  worldStatement,
  type WorldCourseRecord,
  type WorldStatementInput,
} from '../src/world-statement.ts';
import { languagePackSource, mathPackSource } from './fixtures.ts';

function read(source: unknown): PlanPack {
  const found = parsePlanPack(source);
  if (!found.ok) throw new RangeError(JSON.stringify(found.problems));
  return found.value;
}

const budgetItems = [
  { id: 'u1', kind: 'unit', title: 'Unit 1' },
  { id: 'u1-1', kind: 'lesson', title: 'Lesson 1', unit: 'u1', budget: 2 },
  { id: 'u1-2', kind: 'lesson', title: 'Lesson 2', unit: 'u1', budget: 2 },
  { id: 'u1-i', kind: 'integration', title: 'Integration', unit: 'u1', budget: 1 },
  { id: 'u1-b', kind: 'assessment-remediation', title: 'Remediation', unit: 'u1', budget: 2, buffer: true, term: 1 },
  { id: 'u2', kind: 'unit', title: 'Unit 2' },
  { id: 'u2-b', kind: 'assessment-remediation', title: 'Only a buffer', unit: 'u2', budget: 1, buffer: true },
  { id: 'u3', kind: 'unit', title: 'Unit 3' },
  { id: 'u3-1', kind: 'lesson', title: 'Lesson 3', unit: 'u3', budget: 2 },
  { id: 'td', kind: 'td', title: 'Practical', budget: 1 },
];
const pack = read({ ...mathPackSource, anchor: { kind: 'budgets', unit: 'sessions' }, items: budgetItems, merges: [] });

const NONE: WorldCourseRecord = { recorded: 0, weeks: 0, lastWeek: 0, notHeld: { calendar: 0, other: 0 } };
const recorded = (count: number, weeks = 0, lastWeek = 0): WorldCourseRecord => ({
  ...NONE,
  recorded: count,
  weeks,
  lastWeek,
});
const input = (change: Partial<WorldStatementInput> = {}): WorldStatementInput => ({
  level: 'cem',
  grade: '4am',
  section: '4AM1',
  subject: 'arabic',
  year: '2026-2027',
  pack,
  reached: null,
  record: NONE,
  sessionMinutes: 60,
  day: parseDay('2027-02-18'),
  ...change,
});
const done = (item: string) => ({ item, status: 'done' as const });
const started = (item: string) => ({ item, status: 'started' as const });

const SUNDAY = parseDay('2027-01-03');
const session = (day: number, state: SessionState, group = '', start = 480 + day): WeekSession => ({
  day: day as WeekSession['day'],
  start,
  end: start + 60,
  group,
  week: 'both',
  state,
});
const week = (first: number, sessions: readonly WeekSession[], version = 0): WeekRecord => ({
  course: 'made-up-course',
  week: addDays(SUNDAY, 7 * first),
  version,
  totals: { subject: 'arabic', items: [], reached: 0, runsLong: false, covered: 0, closed: 0 },
  class: '4AM1',
  subject: 'arabic',
  sessions,
});

describe('a course’s record in a world', () => {
  const none: DeliveryReading['takenBy'] = () => null;
  const span = (weeks: readonly WeekRecord[], takenBy = none) =>
    worldCourseRecord(weeks, SUNDAY, addDays(SUNDAY, 27), { takenBy });

  it('counts the whole class’s sessions held or not, leaving out groups and what awaits', () => {
    const one = week(0, [
      session(0, 'held'),
      session(1, 'not-held'),
      session(2, 'awaiting'),
      session(3, 'held', 'group-a'),
      session(4, 'not-held', 'group-a'),
    ]);
    assert.deepEqual(span([one]), { recorded: 2, weeks: 1, lastWeek: 2, notHeld: { calendar: 0, other: 2 } });
  });

  it('counts a week with a recorded session, the last such week’s sessions, and a corrected week once', () => {
    const weeks = [
      week(1, [session(0, 'held'), session(1, 'held')]),
      week(0, [session(0, 'not-held')]),
      week(0, [session(0, 'held'), session(1, 'held'), session(2, 'held')], 1),
      week(2, [session(0, 'awaiting')]),
      week(3, [session(0, 'held', 'group-a')]),
    ];
    assert.deepEqual(span(weeks), { recorded: 5, weeks: 2, lastWeek: 2, notHeld: { calendar: 0, other: 0 } });
  });

  it('counts nothing outside the span', () => {
    const late = [week(0, [session(0, 'held')]), week(4, [session(0, 'held'), session(1, 'not-held')])];
    assert.equal(span(late).recorded, 1);
    assert.equal(span(late).notHeld.other, 0);
    const first = worldCourseRecord([week(0, [session(0, 'held'), session(1, 'held')])], addDays(SUNDAY, 1), SUNDAY, {
      takenBy: none,
    });
    assert.equal(first.recorded, 0);
  });

  it('counts no session a calendar entry takes, and an exam day as no loss', () => {
    const entry = (effect: string) => ({ effect }) as CalendarEntry;
    const takenBy: DeliveryReading['takenBy'] = (day) =>
      day === SUNDAY ? entry('exam') : day === addDays(SUNDAY, 1) ? entry('closure') : null;
    const one = week(0, [session(0, 'not-held'), session(1, 'not-held'), session(2, 'held'), session(3, 'not-held')]);
    assert.deepEqual(span([one], takenBy), { recorded: 2, weeks: 1, lastWeek: 2, notHeld: { calendar: 1, other: 1 } });
    const heldOnExam = week(0, [session(0, 'held')]);
    assert.equal(span([heldOnExam], takenBy).recorded, 0);
  });
});

describe('a statement in a world', () => {
  it('says the whole statement with nothing reached', () => {
    const made = worldStatement(input({ record: { ...NONE, notHeld: { calendar: 3, other: 1 } } }));
    assert.deepEqual(made, {
      format: STATEMENT_FORMAT,
      version: { major: 1, minor: 0 },
      day: '2027-02-18',
      class: { level: 'cem', grade: '4am', section: '4AM1', subject: 'arabic', year: '2026-2027' },
      pack: { id: pack.id, release: pack.release },
      lastUnit: null,
      lastResource: null,
      delay: { sessions: 0, weeks: null, bufferUsed: 0, bufferLeft: 3 },
      notHeld: { calendar: 3, other: 1 },
      td: { calendar: 0, other: 0 },
    });
    assert.equal(worldStatement(input({ stream: 'made-up' }))?.class.stream, 'made-up');
  });

  it('takes any main item, its last resource the last lesson at or before it', () => {
    const last = (reached: WorldStatementInput['reached']) => worldStatement(input({ reached }))?.lastResource;
    assert.deepEqual(last(started('u1-2')), { id: 'u1-2', title: 'Lesson 2', status: 'started' });
    assert.equal(last(done('u1-2'))?.status, 'done');
    assert.deepEqual(last(started('u1-i')), { id: 'u1-2', title: 'Lesson 2', status: 'done' });
    const open = read({ ...mathPackSource, merges: [] });
    assert.equal(worldStatement(input({ pack: open, reached: done('d1') }))?.lastResource, null);
  });

  it('names the last unit whose main items, buffers aside, are all finished, and none of only a buffer', () => {
    const unit = (reached: WorldStatementInput['reached']) => worldStatement(input({ reached }))?.lastUnit?.id ?? null;
    assert.equal(unit(done('u1-2')), null);
    assert.equal(unit(started('u1-i')), null);
    assert.equal(unit(done('u1-i')), 'u1');
    assert.equal(unit(started('u3-1')), 'u1');
    assert.equal(unit(done('u3-1')), 'u3');
  });

  it('uses the buffers left before counting delay, and counts none ahead of the plan', () => {
    const delay = (change: Partial<WorldStatementInput>) => worldStatement(input(change))?.delay;
    const at = { reached: done('u1-1') };
    assert.deepEqual(delay({ ...at, record: recorded(1) }), { sessions: 0, weeks: null, bufferUsed: 0, bufferLeft: 3 });
    assert.deepEqual(delay({ ...at, record: recorded(3) }), { sessions: 0, weeks: null, bufferUsed: 1, bufferLeft: 2 });
    assert.deepEqual(delay({ ...at, record: recorded(7) }), { sessions: 2, weeks: null, bufferUsed: 3, bufferLeft: 0 });
    assert.deepEqual(delay({ reached: started('u1-1'), record: recorded(3) }), {
      sessions: 0,
      weeks: null,
      bufferUsed: 2,
      bufferLeft: 1,
    });
    assert.equal(delay({ reached: null, record: recorded(50) })?.sessions, 7);
  });

  it('counts a buffer passed or of another term as none left, and one with no term as left', () => {
    const left = (change: Partial<WorldStatementInput>) => worldStatement(input(change))?.delay.bufferLeft;
    assert.equal(left({ reached: done('u3-1') }), 0);
    assert.equal(left({ reached: started('u1-b') }), 2);
    assert.equal(left({ term: 2 }), 1);
    assert.equal(left({ term: 1 }), 3);
    assert.equal(left({}), 3);
  });

  it('reads hour budgets in sessions at the class’s session length', () => {
    const hours = read({ ...mathPackSource, items: budgetItems, merges: [] });
    assert.equal(worldStatement(input({ pack: hours, sessionMinutes: 30 }))?.delay.bufferLeft, 6);
  });

  it('says plan weeks for a week pack alone, against the plan up to its weeks', () => {
    const weekly = read(languagePackSource);
    const [first, second] = weekly.items.filter((one) => one.kind !== 'unit' && one.kind !== 'td');
    assert.equal(worldStatement(input({ record: recorded(9) }))?.delay.weeks, null);
    const onPlan = worldStatement(input({ pack: weekly, reached: done(first!.id), record: recorded(9, 1, 1) }));
    assert.equal(onPlan?.delay.sessions, 0);
    assert.equal(onPlan?.delay.weeks, 0);
    const behind = worldStatement(input({ pack: weekly, reached: done(first!.id), record: recorded(40, 3, 5) }));
    assert.ok(behind !== null && behind.delay.sessions > 0);
    assert.equal(behind.delay.weeks, Math.max(0, 3 - second!.week!));
    const openStill = worldStatement(input({ pack: weekly, reached: started(first!.id), record: recorded(40, 3, 5) }));
    assert.equal(openStill?.delay.weeks, Math.max(0, 3 - first!.week!));
    const delay = (reached: WorldStatementInput['reached'], record: WorldCourseRecord, of = weekly) =>
      worldStatement(input({ pack: of, reached, record }))?.delay;
    assert.deepEqual(delay(done('w2'), recorded(8, 2, 3)), { sessions: 2, weeks: 0, bufferUsed: 1, bufferLeft: 0 });
    assert.deepEqual(delay(null, recorded(9, 2, 9)), { sessions: 9, weeks: 1, bufferUsed: 1, bufferLeft: 0 });
    assert.deepEqual(delay(done('w2'), recorded(11, 3, 1)), { sessions: 5, weeks: 1, bufferUsed: 1, bufferLeft: 0 });
    const roomy = read({
      ...languagePackSource,
      items: languagePackSource.items.map((one) => (one.id === 'b1' ? { ...one, budget: 3 } : one)),
    });
    const inBuffers = delay(done('s1'), recorded(6, 2, 1), roomy);
    assert.deepEqual(inBuffers, { sessions: 0, weeks: 0, bufferUsed: 3, bufferLeft: 0 });
  });

  it('names any item of the bundled example, whose buffer ends it, and can fall behind on it', () => {
    const shipped = read(
      JSON.parse(
        readFileSync(new URL('../../../data/dz/packs/dz.cem.4am.arabic.example@2026.1.json', import.meta.url), 'utf8'),
      ),
    );
    const of = (reached: WorldStatementInput['reached'], count: number) =>
      worldStatement(input({ pack: shipped, reached, record: recorded(count) }));
    const whole = of(done('u2-7'), 18);
    assert.deepEqual(
      [whole?.lastUnit?.id, whole?.lastResource?.id, whole?.lastResource?.status, whole?.delay.bufferLeft],
      ['u2', 'u2-5', 'done', 0],
    );
    const early = of(done('d1'), 5);
    assert.deepEqual(early?.delay, { sessions: 1, weeks: null, bufferUsed: 2, bufferLeft: 0 });
    assert.deepEqual([early?.lastUnit, early?.lastResource], [null, null]);
  });

  it('gives none for a stale pack, an own list, an item outside the main queue, or what would not read', () => {
    assert.equal(worldStatement(input({ pack: { ...pack, status: 'stale' } })), null);
    assert.equal(worldStatement(input({ pack: { ...pack, release: 'own' } })), null);
    assert.equal(worldStatement(input({ reached: done('gone') })), null);
    assert.equal(worldStatement(input({ reached: done('td') })), null);
    assert.equal(worldStatement(input({ reached: done('u1') })), null);
    assert.equal(worldStatement(input({ section: 'x'.repeat(200) })), null);
  });
});
