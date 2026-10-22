// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Re-pacing the rest of a term (#229, answers 363 to 367): the draft laid
// out by teaching week up to the exams, with tests and the days the
// calendar takes in their place; rung 3's choices ticked as suggested; the
// confirmed re-pace moving the reference back without changing a proposal;
// taking it back with or without its decisions; and the director's approval
// in primary. The demo pack marks «Subtracting whole numbers» optional
// here. Made-up data only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  awaitingBetween,
  catchUp,
  confirmRepace,
  confirmSessions,
  makeContext,
  pace,
  pastWindow,
  queueItems,
  recordsForRoute,
  removeRepace,
  repaceDraft,
  repaceOffered,
  repaceShift,
  sessionsBetween,
  suggestedChoices,
  walkCourse,
  type Context,
} from '../src/index.ts';
import { cemEvents, d, openBook, primaryEvents } from './fixtures.ts';
import { contextOf, itemIds, late, nearExams, pack, plan, ref, today } from './repace-fixtures.ts';

describe('re-pacing', () => {
  it('lays the rest of the term out by week, up to the exams, around holidays', async () => {
    const context = contextOf(await late());
    const draft = repaceDraft(context, 'c-math', today, []);
    assert.ok(draft);
    assert.equal(draft.term, 1);
    assert.equal(draft.to, d('2026-12-05'));
    assert.deepEqual(draft.window, { from: d('2026-12-06'), to: d('2026-12-10'), confidence: 'announced' });
    assert.ok(draft.from > today);
    assert.equal(plan(draft), draft.counts?.gives);
    const order = queueItems(pack, 'main').map((item) => item.id);
    const ids = itemIds(draft);
    assert.ok(ids.length > 0);
    assert.deepEqual(
      ids,
      [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    );
    const taken = draft.weeks.flatMap((week) => week.entries.filter((entry) => entry.kind === 'taken'));
    assert.ok(
      taken.some((entry) => entry.kind === 'taken' && entry.mark === 'holiday' && entry.entry?.id === 'autumn'),
    );
    const paced = pace(context, 'c-math', today);
    assert.equal(draft.behind.sessions, (paced?.expected ?? 0) - (paced?.position ?? 0));
    assert.equal(draft.behind.weeks, null);
    assert.equal(draft.primary, false);
    assert.ok(repaceOffered(context, 'c-math', today));
    assert.equal(catchUp(context, 'c-math', today)?.repace, true);
  });

  it('keeps a test in its week, counted as no plan session', async () => {
    const book = await late();
    const [session] = sessionsBetween(contextOf(book), d('2026-11-10'), d('2026-11-12'), new Set(['c-math'])).filter(
      (one) => one.sessionType !== 'td',
    );
    assert.ok(session);
    const before = repaceDraft(contextOf(book), 'c-math', today, []);
    const test = { id: 't-1', courseId: 'c-math', day: session.day, slot: session.slot, groupId: session.groupId };
    await book.record(today, { kind: 'test.set', test: { ...test, title: 'Test 1' } });
    const draft = repaceDraft(contextOf(book), 'c-math', today, []);
    assert.ok(before && draft);
    const week = draft.weeks.find((one) => one.entries.some((entry) => entry.kind === 'test'));
    assert.deepEqual(
      week?.entries.find((entry) => entry.kind === 'test'),
      { kind: 'test', id: 't-1', title: 'Test 1', day: session.day },
    );
    assert.equal(plan(draft), plan(before) - 1);
  });

  it('ticks the suggested choices only when items land after the exams, and follows the ticks', async () => {
    assert.deepEqual(repaceDraft(contextOf(await late()), 'c-math', today)?.ticked, []);
    const context = contextOf(await late(cemEvents(), nearExams));
    const warning = pastWindow(context, 'c-math', nearExams);
    assert.ok(warning);
    const suggested = repaceDraft(context, 'c-math', nearExams);
    const none = repaceDraft(context, 'c-math', nearExams, []);
    assert.ok(suggested && none);
    assert.deepEqual(suggested.ticked, suggestedChoices(context, warning, suggested.choices, nearExams));
    assert.ok(suggested.ticked.length > 0);
    assert.ok((suggested.counts?.needs ?? 0) < (none.counts?.needs ?? 0));
    assert.ok(suggested.after.length < none.after.length);
    assert.deepEqual(repaceDraft(context, 'c-math', nearExams, [0, 0, 99])?.ticked, [0]);
  });

  it('moves the reference back once confirmed, without changing a proposal, and is taken back', async () => {
    const book = await late();
    const before = contextOf(book);
    const paced = pace(before, 'c-math', today);
    assert.ok(paced && paced.delay > 0);
    const proposed = (context: Context) =>
      [...walkCourse(context, 'c-math', d('2026-12-05')).proposals.values()].map((one) => one?.item.id ?? null);
    const draft = repaceDraft(before, 'c-math', today);
    assert.ok(draft);
    const ids = { repace: 'rp-1', decisions: draft.ticked.map((index) => `dc-${index}`) };
    const events = confirmRepace(before, { courseId: 'c-math', ticked: draft.ticked, ids }, today);
    assert.deepEqual(
      events.map((event) => event.kind),
      [...draft.ticked.map(() => 'plan.decided'), 'repace.set'],
    );
    const plain = confirmRepace(
      before,
      { courseId: 'c-math', ticked: [], ids: { repace: 'rp-0', decisions: [] } },
      today,
    );
    await book.recordAll(today, plain);
    const after = contextOf(book);
    assert.deepEqual(proposed(after), proposed(before));
    const repaced = pace(after, 'c-math', today);
    assert.equal(repaced?.delay, 0);
    assert.equal(repaced?.bufferUsed, 0);
    assert.equal(repaced?.position, paced.position);
    assert.deepEqual(repaceShift(book.state, 'c-math', today), { gap: draft.behind.sessions, weeks: 0 });
    assert.ok(recordsForRoute(book.state, 'statement').some((record) => record.kind === 'repace.set'));

    await book.recordAll(today, removeRepace(after, 'rp-0'));
    assert.equal(pace(contextOf(book), 'c-math', today)?.delay, paced.delay);
    assert.throws(() => removeRepace(contextOf(book), 'rp-0'), /No such/);
  });

  it('takes back its decisions only with «تراجع» right after', async () => {
    const book = await late(cemEvents(), nearExams);
    const draft = repaceDraft(contextOf(book), 'c-math', nearExams);
    assert.ok(draft && draft.ticked.length > 0);
    const ids = { repace: 'rp-1', decisions: draft.ticked.map((index) => `dc-${index}`) };
    const input = { courseId: 'c-math', ticked: draft.ticked, ids };
    await book.recordAll(nearExams, confirmRepace(contextOf(book), input, nearExams));
    assert.deepEqual(book.state.repaces.get('rp-1')?.decisions, ids.decisions);
    assert.deepEqual(
      removeRepace(contextOf(book), 'rp-1').map((event) => event.kind),
      ['repace.removed'],
    );
    await book.recordAll(nearExams, removeRepace(contextOf(book), 'rp-1', true));
    assert.equal(book.state.repaces.size, 0);
    assert.ok(ids.decisions.every((id) => !book.state.decisions.has(id)));
  });

  it('adds a later re-pace to the one before', async () => {
    const book = await late();
    const first = { courseId: 'c-math', ticked: [], ids: { repace: 'rp-1', decisions: [] } };
    await book.recordAll(today, confirmRepace(contextOf(book), first, today));
    const later = d('2026-10-15');
    const context = makeContext(ref, book.state);
    const sessions = awaitingBetween(context, d('2026-10-05'), later);
    await book.recordAll(
      later,
      confirmSessions(
        context,
        sessions.map((session) => ({ session, choice: { outcome: 'not-held' } })),
      ),
    );
    const draft = repaceDraft(contextOf(book), 'c-math', later, []);
    assert.ok(draft && draft.behind.sessions > 0);
    const second = { courseId: 'c-math', ticked: [], ids: { repace: 'rp-2', decisions: [] } };
    await book.recordAll(later, confirmRepace(contextOf(book), second, later));
    const gaps = [...book.state.repaces.values()].reduce((sum, repace) => sum + repace.gap, 0);
    assert.equal(repaceShift(book.state, 'c-math', later).gap, gaps);
    assert.equal(pace(contextOf(book), 'c-math', later)?.delay, 0);
    assert.throws(() => removeRepace(contextOf(book), 'rp-1'), /later re-pace/);
    assert.deepEqual(
      removeRepace(contextOf(book), 'rp-2').map((event) => event.kind),
      ['repace.removed'],
    );
  });

  it('waits for the director’s approval in primary, from the day approved', async () => {
    const day = d('2026-10-15');
    const book = await late(primaryEvents(), day);
    const context = contextOf(book);
    const draft = repaceDraft(context, 'c-lang', day, []);
    assert.ok(draft);
    assert.equal(draft.primary, true);
    assert.equal(draft.window, null);
    assert.equal(draft.to, d('2026-12-17'));
    assert.ok(draft.weeks.every((week) => week.planWeeks.every((n, i, all) => i === 0 || n >= (all[i - 1] ?? 0))));
    const input = { courseId: 'c-lang', ticked: [], ids: { repace: 'rp-1', decisions: [] } };
    assert.throws(() => confirmRepace(context, input, day), /director approves/);
    assert.throws(() => confirmRepace(context, { ...input, approved: d('2026-10-18') }, day), /after today/);
    await book.recordAll(day, confirmRepace(context, { ...input, approved: d('2026-10-14') }, day));
    assert.equal(book.state.repaces.get('rp-1')?.approved, d('2026-10-14'));
    assert.equal(repaceShift(book.state, 'c-lang', d('2026-10-13')).gap, 0);
    assert.equal(repaceShift(book.state, 'c-lang', day).weeks, draft.behind.weeks ?? 0);
    assert.ok((draft.behind.weeks ?? 0) > 0);
    assert.equal(pace(contextOf(book), 'c-lang', day)?.weeksBehind, 0);
  });

  it('refuses what does not hold', async () => {
    const context = contextOf(await late());
    const input = { courseId: 'c-math', ticked: [0], ids: { repace: 'rp-1', decisions: [] } };
    assert.throws(() => confirmRepace(context, input, today), /its own ID/);
    assert.throws(() => confirmRepace(context, { ...input, ticked: [], approved: today }, today), /Only primary/);
    assert.equal(repaceDraft(context, 'c-math', d('2026-12-07')), null);
    assert.throws(
      () => confirmRepace(context, { ...input, ticked: [], ids: { repace: 'rp-1', decisions: [] } }, d('2026-12-07')),
      /Nothing to re-pace/,
    );
    const onPlan = contextOf(await openBook(cemEvents()));
    assert.equal(repaceOffered(onPlan, 'c-math', d('2026-09-20')), false);
    const plain = { courseId: 'c-math', ticked: [], ids: { repace: 'rp-1', decisions: [] } };
    assert.throws(() => confirmRepace(onPlan, plain, d('2026-09-20')), /Nothing to re-pace/);
    const twice = { courseId: 'c-math', ticked: [0], ids: { repace: 'rp-1', decisions: ['rp-1'] } };
    assert.throws(() => confirmRepace(context, twice, today), /its own ID/);
  });
});
