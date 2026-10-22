// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Re-pace cases (#229, answer 369): the gap measured with a ticked
// leave-out applied and in plan weeks before the buffers, a draft starting
// at a backlog day, and rotating half-groups counted once. Made-up data
// only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  confirmRepace,
  pace,
  pastWindow,
  queueItems,
  repaceDraft,
  repaceOffered,
  sessionsBetween,
} from '../src/index.ts';
import { cemEvents, contextOf as fixtureContext, d, primaryEvents } from './fixtures.ts';
import { contextOf, itemIds, late, nearExams, pack, plan, today } from './repace-fixtures.ts';
import { rotatingBook } from './rotation-fixtures.ts';

describe('re-pacing cases', () => {
  it('measures the gap with a ticked leave-out applied, in plan weeks before the buffers', async () => {
    const day = d('2026-10-15');
    const book = await late(primaryEvents(), day);
    const context = contextOf(book);
    const none = repaceDraft(context, 'c-lang', day, []);
    const leave = none?.choices.findIndex((choice) => choice.kind === 'leave-out' && choice.item.id === 'w2') ?? -1;
    assert.ok(leave >= 0);
    const draft = repaceDraft(context, 'c-lang', day, [leave]);
    assert.ok(none && draft);
    assert.ok(draft.behind.sessions < none.behind.sessions);
    assert.equal(draft.behind.weeks, pace(context, 'c-lang', day)?.planWeeksBehind);
    const ids = { repace: 'rp-1', decisions: ['dc-1'] };
    const input = { courseId: 'c-lang', ticked: [leave], ids, approved: day };
    await book.recordAll(day, confirmRepace(context, input, day));
    const paced = pace(contextOf(book), 'c-lang', day);
    assert.deepEqual([paced?.delay, paced?.ahead, paced?.bufferUsed, paced?.weeksBehind], [0, 0, 0, 0]);
  });

  it('starts at a backlog day before today, so no item falls between', async () => {
    const context = contextOf(await late(cemEvents(), d('2026-09-30')));
    const draft = repaceDraft(context, 'c-math', today, []);
    assert.ok(draft);
    assert.ok(draft.from < today);
    assert.equal(plan(draft), draft.counts?.gives);
    const first = queueItems(pack, 'main').find((item) => item.buffer !== true)?.id;
    assert.ok(itemIds(draft).includes(first ?? ''));
  });

  it('counts a pair of rotating half-groups as one plan session, in the week that completes it', async () => {
    const even = (weekday: 0 | 2 | 4) => ({
      id: `e-${weekday}`,
      weekday,
      slot: { half: 'morning' as const, index: 1 },
      courseId: 'c-math',
      groupId: 'g-all',
      weeks: 'every' as const,
      sessionType: 'lesson',
    });
    for (const straddles of [false, true]) {
      const book = await rotatingBook();
      if (straddles) {
        const version = {
          id: 'v2',
          from: d('2026-09-20'),
          source: 'hand' as const,
          blocks: [],
          entries: [0, 2, 4].map((n) => even(n as 0 | 2 | 4)),
        };
        await book.record(d('2026-09-19'), { kind: 'timetable.set', version });
      }
      const day = d('2026-09-20');
      const draft = repaceDraft(fixtureContext(book), 'c-math', day, []);
      assert.ok(draft);
      assert.equal(plan(draft), draft.counts?.gives);
      const [first, second] = draft.weeks.map((week) => week.plan);
      assert.deepEqual([first, second], straddles ? [0, 3] : [2, 2]);
      const sessions = sessionsBetween(fixtureContext(book), day, draft.weeks[1]?.end ?? day, new Set(['c-math']));
      const halves = sessions.filter((one) => one.rotation !== undefined && one.sessionType !== 'td');
      assert.equal(halves.length, straddles ? 6 : 8);
    }
  });

  it('is offered for items past the exams only while the class is behind its distribution', async () => {
    const book = await late(cemEvents(), nearExams);
    assert.ok(repaceOffered(contextOf(book), 'c-math', nearExams));
    const input = { courseId: 'c-math', ticked: [], ids: { repace: 'rp-1', decisions: [] } };
    await book.recordAll(nearExams, confirmRepace(contextOf(book), input, nearExams));
    assert.ok(pastWindow(contextOf(book), 'c-math', nearExams));
    assert.equal(repaceOffered(contextOf(book), 'c-math', nearExams), false);
  });
});
