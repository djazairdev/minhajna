// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reshaping classes after reorientation (#231, Reorient, answer 391): the
// old classes are archived from the day and have no sessions after it;
// each new class's course continues the old class's course it names, with
// its recorded sessions, plan position and plan changes; every pupil
// leaves the old class on the day, «تغيير القسم», and joins the class
// chosen, or none; the timetable's sessions go to the new classes, the
// first taking a history; the old class keeps its roll calls, and its
// halves' coverage, re-paces and plan changes carry on in order; and a
// reorientation that does not hold is refused. Made-up classes only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  courseDecisions,
  courseSetup,
  nextSeq,
  pace,
  pupilsOn,
  recordChange,
  reorient,
  repaceShift,
  rollCallUnits,
  sessionsBetween,
  walkCourse,
  wholeGroup,
  type Reorientation,
} from '../src/index.ts';
import { contextOf, d, openBook } from './fixtures.ts';
import { teach, twoClasses } from './parallel-fixtures.ts';

const day = d('2026-10-08');
const plan: Reorientation = {
  day,
  olds: ['k-1am2', 'k-1am3'],
  classes: [
    { name: '1AM2 new', takes: 'k-1am2' },
    { name: '1AM3 new', takes: 'k-1am3' },
  ],
  pupils: new Map([
    ['p06', 1],
    ['p10', null],
  ]),
};

function ids(): () => string {
  let next = 0;
  return () => `r-${(next += 1)}`;
}

async function reoriented() {
  const book = await openBook(twoClasses());
  await teach(book, 'c-math', '2026-10-07');
  await book.record(d('2026-10-01'), {
    kind: 'plan.decided',
    decision: { id: 'x-skip', courseId: 'c-math', kind: 'skip', item: 'l7', seq: 1 },
  });
  const before = contextOf(book);
  const events = reorient(before, plan, day, ids());
  await book.recordAll(day, events);
  const context = contextOf(book);
  const course = (classId: string) =>
    [...context.state.courses.values()].find((one) => one.classId === classId && one.continues !== undefined)!;
  const named = (name: string) => [...context.state.classes.values()].find((one) => one.name === name)!;
  return { book, before, events, context, course, named };
}

describe('reorientation', () => {
  it('archives the old classes and gives the new classes their history', async () => {
    const { before, context, course, named } = await reoriented();
    const first = named('1AM2 new');
    const math = course(first.id);
    assert.deepEqual(math.continues, { courseId: 'c-math', from: day });
    assert.equal(context.state.classes.get('k-1am2')?.archivedFrom, day);
    assert.equal(pace(context, math.id, day)?.position, pace(before, 'c-math', day)?.position);
    const walked = walkCourse(context, math.id, d('2026-10-12'));
    const next = [...walked.proposals.values()].find((one) => one !== null);
    const old = [...walkCourse(before, 'c-math', d('2026-10-12')).proposals.values()].find((one) => one !== null);
    assert.equal(next?.item.id, old?.item.id);
    assert.equal(courseDecisions(context.state, math.id).get('x-skip')?.courseId, math.id);
    assert.equal(walked.progress.skipped('l7'), true);

    const all = sessionsBetween(context, d('2026-09-20'), d('2026-10-20'));
    assert.equal(
      all.some((one) => one.classId === 'k-1am2' && one.day >= day),
      false,
    );
    const mine = sessionsBetween(context, d('2026-09-20'), d('2026-10-20'), new Set([math.id]));
    assert.ok(mine.some((one) => one.courseId === 'c-math' && one.day < day));
    assert.ok(mine.every((one) => one.courseId === math.id || context.state.sessions.has(one.key)));
    assert.ok(mine.some((one) => one.courseId === math.id && one.day >= day));
    assert.ok(mine.filter((one) => one.courseId === math.id).every((one) => one.groupId === first.groups[0]?.id));
  });

  it('moves every pupil on the day, and keeps the old lists before it', async () => {
    const { context, named } = await reoriented();
    const first = named('1AM2 new');
    const second = named('1AM3 new');
    const names = (classId: string, groupId: string, on: string) =>
      pupilsOn(context, classId, groupId, d(on)).map((one) => one.name);
    assert.equal(names('k-1am2', 'g-all', '2026-10-07').length, 10);
    assert.deepEqual(names('k-1am2', 'g-all', '2026-10-08'), []);
    assert.equal(names(first.id, first.groups[0]!.id, '2026-10-08').length, 8);
    assert.deepEqual(names(second.id, second.groups[0]!.id, '2026-10-08'), ['يوسف شعبان']);
    assert.equal(names(first.id, first.groups[0]!.id, '2026-10-07').length, 0);
    const moved = [...context.state.pupils.values()].find((one) => one.id === 'p10');
    assert.deepEqual(moved?.movements.at(-1), { day, kind: 'out', reason: 'class-change', confirmed: true });
  });

  it('keeps the old class’s roll calls, and carries its halves, re-paces and plan changes in order', async () => {
    const book = await openBook(twoClasses());
    await teach(book, 'c-math', '2026-10-07');
    await book.record(d('2026-10-01'), {
      kind: 'plan.decided',
      decision: { id: 'x-skip', courseId: 'c-math', kind: 'skip', item: 'l7', seq: 1 },
    });
    await book.record(d('2026-10-01'), {
      kind: 'repace.set',
      repace: {
        id: 'rp',
        courseId: 'c-math',
        on: d('2026-10-01'),
        from: d('2026-10-01'),
        to: d('2026-12-10'),
        gap: 2,
        decisions: [],
      },
    });
    const old = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-10-07')).length;
    await book.recordAll(day, reorient(contextOf(book), plan, day, ids()));
    const context = contextOf(book);
    const first = [...context.state.classes.values()].find((one) => one.name === '1AM2 new')!;
    const math = [...context.state.courses.values()].find((one) => one.classId === first.id)!;
    assert.deepEqual(rollCallUnits(context, first.id, d('2026-09-20'), d('2026-10-07')), []);
    assert.equal(rollCallUnits(context, 'k-1am2', d('2026-09-20'), d('2026-10-07')).length, old);

    const setup = courseSetup(context, math.id);
    const td = walkCourse(context, math.id, day).progress;
    assert.equal(
      td.isFinished(
        setup.pack!,
        setup.pack!.items.find((one) => one.id === 't1')!,
        wholeGroup(first).id,
      ),
      true,
    );
    assert.equal(repaceShift(context.state, math.id, day).gap, 2);

    const seq = nextSeq(courseDecisions(context.state, math.id), math.id);
    assert.equal(seq, 2);
    const change = { id: 'x-budget', courseId: math.id, kind: 'budget' as const, item: 'l6', sessions: 3 };
    assert.throws(() => recordChange(context, { ...change, seq: 1 }), /out of order/);
    assert.equal(recordChange(context, { ...change, seq }).kind, 'plan.decided');
  });

  it('lets two new classes take one history, the first with its sessions', async () => {
    const book = await openBook(twoClasses());
    const twice: Reorientation = {
      ...plan,
      classes: [
        { name: 'A', takes: 'k-1am2' },
        { name: 'B', takes: 'k-1am2' },
      ],
      pupils: new Map(),
    };
    await book.recordAll(day, reorient(contextOf(book), twice, day, ids()));
    const context = contextOf(book);
    const courses = [...context.state.courses.values()].filter((one) => one.continues?.courseId === 'c-math');
    assert.equal(courses.length, 2);
    const held = sessionsBetween(context, day, d('2026-10-20')).map((one) => one.courseId);
    assert.ok(held.includes(courses[0]!.id));
    assert.equal(held.includes(courses[1]!.id), false);
  });

  it('refuses a reorientation that does not hold', async () => {
    const book = await openBook(twoClasses());
    await teach(book, 'c-math', '2026-10-12');
    const context = contextOf(book);
    assert.throws(() => reorient(context, plan, day, ids()), /^RangeError: recorded$/);
    const fresh = contextOf(await openBook(twoClasses()));
    assert.throws(() => reorient(fresh, { ...plan, olds: ['nope'] }, day, ids()), /unknown-class/);
    const blank = { ...plan, classes: [{ name: ' ', takes: 'k-1am2' }] };
    assert.throws(() => reorient(fresh, blank, day, ids()), /no-name/);
    const twice = { ...plan, classes: [plan.classes[0]!, plan.classes[0]!] };
    assert.throws(() => reorient(fresh, twice, day, ids()), /same-name/);
    const other = { ...plan, classes: [{ name: 'X', takes: 'k-5apb' }] };
    assert.throws(() => reorient(fresh, other, day, ids()), /other-history/);
    assert.throws(() => reorient(fresh, plan, d('2026-10-09'), ids()), /^RangeError: past$/);
    assert.throws(() => reorient(fresh, plan, d('2026-10-07'), ids()), /^RangeError: future$/);
    assert.throws(() => reorient(fresh, { ...plan, pupils: new Map([['p01', 5]]) }, day, ids()), /unknown-target/);
    const tested = await openBook(twoClasses());
    await tested.record(d('2026-10-01'), {
      kind: 'test.set',
      test: {
        id: 't-1',
        courseId: 'c-math',
        day: d('2026-10-12'),
        slot: { half: 'morning', index: 1 },
        groupId: 'g-all',
        title: 'Test',
      },
    });
    assert.throws(() => reorient(contextOf(tested), plan, day, ids()), /^RangeError: test$/);
  });
});
