// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Moving a class to a newer release (#322, answer 487): offered only with
// every release between on the phone; each change the newer release makes
// unclear is asked, and each answer recorded after the move as the class's
// own change on the new IDs, checked against the newer plan and the answers
// before it; a move goes where its place carries to, or records nothing once
// done; a change asked once is not asked again on a later move. The move pins
// the class to a newer release only while it is on the one the move leaves,
// the log showing only such a move, and a session record keeps the release it
// was read in on, there and where it is sent, late confirmations included
// (release-sent.test.ts for an edition change or an own list). Made-up data.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  activityLog,
  addLayer,
  awaitingBetween,
  confirmSessions,
  courseDecisions,
  fittingChoices,
  layerKey,
  layerOf,
  movePlan,
  moveEvents,
  recordKey,
  recordsForRoute,
  switchLayer,
  type PlanLayer,
  type RecordBook,
  type RecordEvent,
} from '../src/index.ts';
import { cemEvents, d, mathPack, openBook } from './fixtures.ts';
import { edit, mathFixSource, releaseOf, withFix } from './migration-fixtures.ts';
import { change, made } from './plan-change-fixtures.ts';

const moved = (from: string, to: string): RecordEvent => ({
  kind: 'course.moved',
  move: { courseId: 'c-math', from, to },
});

async function confirmUntil(book: RecordBook, from: string, upTo: string) {
  const context = withFix(book);
  const sessions = awaitingBetween(context, d(from), d(upTo));
  await book.recordAll(
    d(upTo),
    confirmSessions(
      context,
      sessions.map((session) => ({ session })),
    ),
  );
}

const ids = (count: number) => {
  let next = 0;
  return { newId: () => `a${(next += 1)}of${count}`, day: d('2026-09-25') };
};

describe('a class moved to a newer release', () => {
  it('moves only forward from its own release, and keeps each record on the release it was read in on', async () => {
    const book = await openBook(cemEvents());
    await confirmUntil(book, '2026-09-21', '2026-09-21');
    await book.record(d('2026-09-22'), moved('2025.1', '2026.2'));
    assert.equal(book.state.courses.get('c-math')?.pack?.release, '2026.1');
    await book.record(d('2026-09-22'), moved('2026.1', '2026.2'));
    await book.record(d('2026-09-22'), moved('2026.2', '2026.1'));
    assert.equal(book.state.courses.get('c-math')?.pack?.release, '2026.2');
    await confirmUntil(book, '2026-09-13', '2026-09-24');
    const stamps = (state: RecordBook['state']) =>
      [...state.sessions.values()].flatMap((versions) => {
        const last = versions.at(-1);
        return last?.value?.session.courseId === 'c-math' ? [[last.value.session.day, last.pack?.release]] : [];
      });
    assert.deepEqual(stamps(book.state).sort(), [
      [d('2026-09-20'), '2026.2'],
      [d('2026-09-21'), '2026.1'],
      [d('2026-09-22'), '2026.2'],
      [d('2026-09-23'), '2026.2'],
      [d('2026-09-24'), '2026.2'],
    ]);
    assert.ok([...book.state.sessions.values()].every((versions) => !('release' in (versions[0]?.value ?? {}))));
    const records = recordsForRoute(book.state, 'school-space');
    assert.deepEqual(
      records.filter((one) => one.kind === 'course.moved'),
      [moved('2026.1', '2026.2')],
    );
    const sent = await openBook(records);
    assert.deepEqual(stamps(sent.state).sort(), stamps(book.state).sort());
    assert.equal(sent.state.courses.get('c-math')?.pack?.release, '2026.2');
    const lines = activityLog(book.entries).flatMap((day) => day.items.map((item) => item.line));
    assert.deepEqual(
      lines.filter((line) => line.kind === 'course-moved'),
      [{ kind: 'course-moved', courseId: 'c-math', release: '2026.2' }],
    );
    assert.equal(layerOf(moved('2026.1', '2026.2')), 'lesson-record');
    assert.equal(recordKey(moved('2026.1', '2026.2')), 'course:c-math');
  });

  it('asks about unclear changes, lists one on a removed item, and needs every release', async () => {
    const book = await openBook(cemEvents());
    await change(
      book,
      { ...made, id: 'b2', kind: 'budget', item: 'l2', sessions: 2 },
      { ...made, id: 'k5', kind: 'skip', item: 'l5' },
      { ...made, id: 'k7', kind: 'skip', item: 'l7' },
    );
    const plan = movePlan(withFix(book), 'c-math', '2026.2');
    assert.ok(plan.ok);
    assert.deepEqual(
      plan.questions.map((question) => [question.decision.id, question.choices]),
      [
        ['b2', ['l2a', 'l2b']],
        ['k5', ['l56']],
      ],
    );
    assert.deepEqual(
      plan.removed.map((one) => one.decision.id),
      ['k7'],
    );
    assert.deepEqual(movePlan(withFix(book), 'c-math', '2027.1'), { ok: false, problem: 'missing', release: '2027.1' });
    assert.deepEqual(movePlan(withFix(book), 'c-math', '2026.1'), {
      ok: false,
      problem: 'not-newer',
      release: '2026.1',
    });
  });

  it('records the answers after the move as its own changes, and asks nothing again on the next move', async () => {
    const book = await openBook(cemEvents());
    await change(book, { ...made, id: 'b2', kind: 'budget', item: 'l2', sessions: 2 });
    const third = releaseOf({
      release: '2027.1',
      items: edit(mathFixSource.items, { l3: ['l3b'] }),
      migration: { from: '2026.2', entries: [{ kind: 'rename', from: 'l3', to: 'l3b' }] },
    });
    const plan = movePlan(withFix(book, third), 'c-math', '2026.2');
    assert.ok(plan.ok);
    const events = moveEvents(withFix(book, third), 'c-math', plan, ['l2b'], ids(1));
    assert.deepEqual(
      events.map((event) => (event.kind === 'plan.decided' ? event.decision : event)),
      [
        moved('2026.1', '2026.2'),
        { ...made, day: d('2026-09-25'), id: 'a1of1', kind: 'budget', item: 'l2b', sessions: 2, seq: 2 },
      ],
    );
    await book.recordAll(d('2026-09-25'), events);
    const context = withFix(book, third);
    const own = [...courseDecisions(context, 'c-math').values()].filter((one) => one.courseId === 'c-math');
    assert.deepEqual(
      own.map((one) => [one.id, 'item' in one ? one.item : null]),
      [['a1of1', 'l2b']],
    );
    const next = movePlan(context, 'c-math', '2027.1');
    assert.ok(next.ok);
    assert.deepEqual([next.questions, next.removed], [[], []]);
    const lines = activityLog(book.entries).flatMap((day) => day.items.map((item) => item.line));
    assert.deepEqual(
      lines.filter((line) => line.kind === 'course-moved'),
      [{ kind: 'course-moved', courseId: 'c-math', release: '2026.2' }],
    );
  });

  it("asks about a layer's change, records nothing when not carried, and refuses what does not fit", async () => {
    const book = await openBook(cemEvents());
    const school: PlanLayer = {
      level: 'school',
      id: 'example-school',
      pack: mathPack.id,
      title: 'Made-up school layer',
      by: 'Made-up author',
      made: d('2026-09-20'),
      operations: [{ kind: 'budget', item: 'l2', sessions: 3 }],
    };
    await book.record(d('2026-09-20'), addLayer(book.state, { layer: school }));
    await book.record(d('2026-09-20'), switchLayer(book.state, 'c-math', 'school', layerKey(school)));
    await change(book, { ...made, id: 'j1', kind: 'join', items: ['l2', 'l3'] });
    const plan = movePlan(withFix(book), 'c-math', '2026.2');
    assert.ok(plan.ok);
    assert.deepEqual(
      plan.questions.map((question) => [question.decision.id, question.layer?.title ?? null]),
      [
        ['j1', null],
        [plan.questions[1]?.decision.id, 'Made-up school layer'],
      ],
    );
    assert.equal(moveEvents(withFix(book), 'c-math', plan, [null, null], ids(0)).length, 1);
    assert.throws(() => moveEvents(withFix(book), 'c-math', plan, ['l2a', null], ids(1)), RangeError);
    assert.deepEqual(fittingChoices(withFix(book), 'c-math', plan, 0, { answers: [], day: d('2026-09-25') }), ['l2b']);
    const events = moveEvents(withFix(book), 'c-math', plan, ['l2b', 'l2a'], ids(2));
    assert.deepEqual(
      events.slice(1).map((event) => (event.kind === 'plan.decided' ? event.decision : null)),
      [
        { ...made, day: d('2026-09-25'), id: 'a1of2', kind: 'join', items: ['l2b', 'l3'], seq: 2 },
        { courseId: 'c-math', day: d('2026-09-25'), id: 'a2of2', kind: 'budget', item: 'l2a', sessions: 3, seq: 3 },
      ],
    );
    assert.throws(() => moveEvents(withFix(book), 'c-math', plan, ['l56', null], ids(1)), RangeError);
  });

  it('places a move as its item was placed, and checks each answer after the ones before it', async () => {
    const book = await openBook(cemEvents());
    await change(
      book,
      { ...made, id: 'm5', kind: 'move', item: 'l5', before: 'l7' },
      { ...made, id: 'm6', kind: 'move', item: 'l6', before: 'l5' },
      { ...made, id: 's2', kind: 'split', item: 'l2', titles: ['A', 'B'] },
      { ...made, id: 'b2', kind: 'budget', item: 'l2~s2~1', sessions: 2 },
    );
    const plan = movePlan(withFix(book), 'c-math', '2026.2');
    assert.ok(plan.ok);
    assert.deepEqual(
      plan.questions.map((question) => [question.decision.id, question.choices]),
      [
        ['m5', ['l56']],
        ['m6', ['l56']],
        ['s2', ['l2a', 'l2b']],
        ['b2', ['l2a', 'l2b']],
      ],
    );
    const events = moveEvents(withFix(book), 'c-math', plan, ['l56', 'l56', 'l2a', null], ids(3));
    assert.deepEqual(
      events.slice(1).map((event) => (event.kind === 'plan.decided' ? event.decision : null)),
      [
        { ...made, day: d('2026-09-25'), id: 'a1of3', kind: 'move', item: 'l56', before: null, seq: 5 },
        { ...made, day: d('2026-09-25'), id: 'a3of3', kind: 'split', item: 'l2a', titles: ['A', 'B'], seq: 6 },
      ],
    );
    const fits = (answers: (string | null)[]) =>
      fittingChoices(withFix(book), 'c-math', plan, 3, { answers, day: d('2026-09-25') });
    assert.deepEqual(fits([null, null, 'l2a']), ['l2b']);
    assert.deepEqual(fits([null, null, null]), ['l2a', 'l2b']);
  });
});
