// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's own list without a pack (#227, answer 346): saved whole, read
// as a pack of its own with status `own`, followed by Today, and never
// changed by the class's changes. Made-up lists only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  awaitingBetween,
  confirmCourse,
  courseSetup,
  freeListFits,
  offerFreeList,
  ownPack,
  PACK_ID,
  queueItems,
  recordedItems,
  recordsForRoute,
  saveFreeList,
  skippedBy,
  switchLayer,
  walkCourse,
  withItem,
  withMove,
  withoutItems,
  type Context,
  type Day,
  type FreeItem,
  type FreeList,
  type RecordBook,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';
import { attempt, change, made } from './plan-change-fixtures.ts';

const list: FreeList = {
  courseId: 'c-math',
  started: d('2026-09-14'),
  items: [
    { id: 'u1', kind: 'unit', title: 'Made-up unit' },
    { id: 'l1', kind: 'lesson', title: 'Made-up lesson one', sessions: 2, stages: ['Made-up start', 'Made-up end'] },
    { id: 'l2', kind: 'lesson', title: 'Made-up lesson two', sessions: 1 },
  ],
};

/** The made-up middle school, with c-math taken off its pack. */
async function withoutPack(): Promise<RecordBook> {
  return openBook(
    cemEvents().map((event) =>
      event.kind === 'course.set' && event.course.id === 'c-math'
        ? { ...event, course: { ...event.course, pack: null } }
        : event,
    ),
  );
}

async function saved(one: FreeList = list): Promise<{ book: RecordBook; context: Context }> {
  const book = await withoutPack();
  await book.record(d('2026-09-14'), saveFreeList(book.state.courses, one));
  return { book, context: contextOf(book) };
}

const plan = (context: Context) => courseSetup(context, 'c-math').pack!;

describe('a class’s own list', () => {
  it('is refused for a course on a pack, and for a list that breaks the rules', async () => {
    const book = await openBook(cemEvents());
    assert.throws(() => saveFreeList(book.state.courses, list), RangeError);
    const free = (await withoutPack()).state.courses;
    assert.throws(() => saveFreeList(free, { ...list, courseId: 'c-unknown' }), RangeError);
    const [unit, lesson] = list.items as [FreeList['items'][0], FreeList['items'][0]];
    for (const items of [
      [lesson, lesson],
      [{ ...unit, sessions: 1 }],
      [{ ...unit, stages: ['Made-up'] }],
      [{ ...lesson, kind: 'lecture' } as unknown as FreeItem],
      [{ ...lesson, sessions: 0 }],
      [{ ...lesson, sessions: 61 }],
      [{ ...lesson, sessions: 1.5 }],
      [{ id: 'l9', kind: 'lesson' as const, title: 'Made-up' }],
      [{ ...lesson, title: 'Made-up\nlesson' }],
      [{ ...lesson, title: ' ' }],
      [{ ...lesson, stages: Array.from({ length: 13 }, (_, n) => `Stage ${n}`) }],
      [{ ...lesson, id: 'l 1' }],
    ]) {
      assert.equal(freeListFits({ ...list, items }), false, JSON.stringify(items));
    }
    assert.equal(freeListFits({ ...list, offered: d('2026-09-13') }), false);
    assert.equal(freeListFits({ ...list, removed: [{ id: 'l2', kind: 'lesson', title: 'Made-up' }] }), false);
    const odd = { id: 'l9', kind: 'lecture', title: 'Made-up' } as unknown as FreeItem;
    assert.equal(freeListFits({ ...list, removed: [odd] }), false);
    const many = Array.from({ length: 301 }, (_, n) => ({ id: `r${n}`, kind: 'lesson' as const, title: 'Made-up' }));
    assert.equal(freeListFits({ ...list, removed: many }), false);
    assert.equal(freeListFits(list), true);
  });

  it('is the class’s plan: an own pack whose units group the items after them', async () => {
    const { context } = await saved();
    const pack = plan(context);
    assert.equal(pack.status, 'own');
    assert.equal(courseSetup(context, 'c-math').packMissing, false);
    assert.match(pack.id, PACK_ID);
    const { course, schoolClass } = courseSetup(context, 'c-math');
    assert.equal(ownPack(context.state.lists.get('c-math')!, course, schoolClass, context.ref.country), pack);
    assert.deepEqual(
      pack.items.map((item) => [item.id, item.unit, item.budget]),
      [
        ['u1', undefined, undefined],
        ['l1', 'u1', 2],
        ['l2', 'u1', 1],
      ],
    );
    assert.deepEqual(pack.stageTemplates, [{ id: 'l1~stages', stages: ['Made-up start', 'Made-up end'] }]);
    assert.deepEqual(
      queueItems(pack, 'main').map((item) => item.id),
      ['l1', 'l2'],
    );
  });

  it('gives Today its next item', async () => {
    const { context } = await saved();
    const walk = walkCourse(context, 'c-math', d('2026-09-30'));
    const proposed = awaitingBetween(context, d('2026-09-14'), d('2026-09-30'))
      .filter((session) => session.courseId === 'c-math')
      .map((session) => walk.proposals.get(session.key)?.item.id);
    assert.equal(proposed[0], 'l1');
    assert.ok(proposed.includes('l2'));
  });

  it('keeps the order the teacher gives', () => {
    const edited = withMove(withItem(withoutItems(list, ['l1'], new Set()), list.items[1]!, 'u1'), 'u1', null);
    assert.deepEqual(
      edited.items.map((item) => item.id),
      ['l1', 'l2', 'u1'],
    );
    assert.equal(edited.removed, undefined);
    assert.equal(freeListFits(edited), true);
    assert.equal(withoutItems(list, ['missing'], new Set()), list);
  });

  it('keeps the title of a removed item a recorded session names, and drops one never taught', async () => {
    const { book, context } = await saved();
    const [session] = awaitingBetween(context, d('2026-09-14'), d('2026-09-30')).filter(
      (one) => one.courseId === 'c-math',
    );
    assert.ok(session);
    const [record] = confirmCourse(context, 'c-math', [{ sessionKey: session.key }], session.day);
    assert.ok(record);
    await book.record(session.day, { kind: 'session.recorded', record });
    const recorded = recordedItems(book.state, 'c-math');
    assert.deepEqual([...recorded], ['l1']);
    const removed = withoutItems(list, ['l1', 'l2'], recorded);
    assert.deepEqual(removed.removed, [{ id: 'l1', kind: 'lesson', title: 'Made-up lesson one' }]);
    await book.record(session.day, saveFreeList(book.state.courses, removed));
    assert.deepEqual(plan(contextOf(book)).retired, [{ id: 'l1', kind: 'lesson', title: 'Made-up lesson one' }]);
  });

  it('takes no class change, and the history ignores a list that breaks the rules', async () => {
    const { book, context } = await saved();
    assert.throws(attempt(context, { ...made, id: 'm1', kind: 'skip', item: 'l2' }), /Only a class on a pack/);
    assert.throws(() => switchLayer(book.state, 'c-math', 'school', null), RangeError);
    await book.record(d('2026-09-15'), { kind: 'list.set', list: { ...list, items: [], started: 'not a day' as Day } });
    assert.equal(plan(contextOf(book)).items.length, 3);
  });

  it('leaves out the changes made while the class was on a pack', async () => {
    const book = await openBook(cemEvents());
    await change(book, { ...made, id: 'k1', kind: 'skip', item: 'l4' });
    const course = book.state.courses.get('c-math')!;
    await book.record(d('2026-09-21'), { kind: 'course.set', course: { ...course, pack: null } });
    const reused = { ...list, items: [{ id: 'l4', kind: 'lesson' as const, title: 'Made-up', sessions: 1 }] };
    await book.record(d('2026-09-21'), saveFreeList(book.state.courses, reused));
    const context = contextOf(book);
    assert.deepEqual(skippedBy(plan(context), context.state.decisions, 'c-math'), []);
  });

  it('keeps the day it was offered, and goes with the lesson record', async () => {
    const { book } = await saved();
    await book.record(d('2026-10-01'), offerFreeList(book.state.courses, list, d('2026-10-01')));
    const kept = book.state.lists.get('c-math');
    assert.equal(kept?.offered, d('2026-10-01'));
    assert.equal(kept?.started, d('2026-09-14'));
    const outbound = recordsForRoute(book.state, 'handover').filter((event) => event.kind === 'list.set');
    assert.deepEqual(outbound, [{ kind: 'list.set', list: kept }]);
  });
});
