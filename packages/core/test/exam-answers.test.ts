// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The answers to an exam-window warning (#221): the choices the pack allows,
// the ones ticked first, the postponement, and a test previewed before it
// is added. The demo pack marks «Subtracting whole numbers» optional here,
// and nothing is taught until the day each case starts from.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  awaitingBetween,
  confirmSessions,
  decisionOf,
  makeContext,
  packKey,
  pastWindow,
  planChoices,
  postponeOf,
  suggestedChoices,
  withPlanChanges,
  type Context,
  type Day,
  type PlanChoice,
} from '../src/index.ts';
import { cemEvents, d, mathPack, openBook, reference } from './fixtures.ts';

const pack = {
  ...mathPack,
  items: mathPack.items.map((item) => (item.id === 'l4' ? { ...item, optional: true } : item)),
};
const ref = { ...reference, packs: new Map([[packKey(pack.id, pack.release), pack]]) };

async function lateContext(until: Day): Promise<Context> {
  const book = await openBook(cemEvents());
  const before = makeContext(ref, book.state);
  const sessions = awaitingBetween(before, d('2026-09-20'), until);
  await book.recordAll(
    until,
    confirmSessions(
      before,
      sessions.map((session) => ({ session, choice: { outcome: 'not-held' } })),
    ),
  );
  return makeContext(ref, book.state);
}

function named(choice: PlanChoice): string {
  return choice.kind === 'leave-out'
    ? `leave-out ${choice.item.id}`
    : `merge ${choice.items.map((item) => item.id).join('+')}`;
}

describe('exam-window answers', () => {
  it('offers the leave-outs and merges the pack allows, in plan order', async () => {
    const context = await lateContext(d('2026-11-26'));
    const warning = pastWindow(context, 'c-math', d('2026-11-26'));
    assert.ok(warning);
    assert.deepEqual(planChoices(context, warning).map(named), ['merge l2+l3', 'leave-out l4']);

    const merged = withPlanChanges(context, {
      decisions: [{ id: 'x-1', courseId: 'c-math', kind: 'merge', items: ['l2', 'l3'] }],
    });
    const after = pastWindow(merged, 'c-math', d('2026-11-26'));
    assert.ok(after);
    assert.deepEqual(planChoices(merged, after).map(named), ['leave-out l4']);
  });

  it('ticks the fewest choices that clear the warning, or come nearest', async () => {
    const near = await lateContext(d('2026-11-22'));
    const some = pastWindow(near, 'c-math', d('2026-11-22'));
    assert.ok(some);
    assert.deepEqual(
      some.items.map(({ item }) => item.id),
      ['i1', 'l5'],
    );
    assert.deepEqual(suggestedChoices(near, some, planChoices(near, some), d('2026-11-22')), [0]);

    const late = await lateContext(d('2026-11-26'));
    const many = pastWindow(late, 'c-math', d('2026-11-26'));
    assert.ok(many);
    const choices = planChoices(late, many);
    assert.deepEqual(suggestedChoices(late, many, choices, d('2026-11-26')), [0, 1]);
    const decisions = choices.map((choice, i) => decisionOf(choice, `x-${i}`, 'c-math'));
    assert.deepEqual(
      pastWindow(withPlanChanges(late, { decisions }), 'c-math', d('2026-11-26'))?.items.map(({ item }) => item.id),
      ['i1', 'l5'],
    );
  });

  it('postpones every item past the window, which clears the warning', async () => {
    const context = await lateContext(d('2026-11-26'));
    const warning = pastWindow(context, 'c-math', d('2026-11-26'));
    assert.ok(warning);
    const decision = postponeOf(warning, 'x-1');
    assert.deepEqual(decision, {
      id: 'x-1',
      courseId: 'c-math',
      kind: 'postpone',
      items: ['l3', 'l4', 'i1', 'l5'],
      term: 1,
    });
    assert.equal(pastWindow(withPlanChanges(context, { decisions: [decision] }), 'c-math', d('2026-11-26')), null);
  });

  it('previews a test before it is added', async () => {
    const context = await lateContext(d('2026-11-19'));
    const test = {
      id: 't-1',
      courseId: 'c-math',
      day: d('2026-11-22'),
      slot: { half: 'morning', index: 1 },
      groupId: 'g-all',
      title: 'First test',
    } as const;
    assert.deepEqual(
      pastWindow(context, 'c-math', d('2026-11-19'))?.items.map(({ item }) => item.id),
      ['l5'],
    );
    assert.deepEqual(
      pastWindow(withPlanChanges(context, { tests: [test] }), 'c-math', d('2026-11-19'))?.items.map(
        ({ item }) => item.id,
      ),
      ['i1', 'l5'],
    );
    assert.equal(context.state.tests.size, 0);
  });
});
