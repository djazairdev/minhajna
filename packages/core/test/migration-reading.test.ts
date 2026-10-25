// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class read on a new release (#322, answer 487, R-4.2-13): its recorded
// sessions never change, yet it keeps its place. A renamed item keeps its
// stages, even renamed twice; both parts of a finished split item are finished,
// and a started one leaves the class at the first part; a merged item is
// finished once every old item is; a removed item drops out. The class's own
// changes, its school layer's and its notes follow it, the notes on every part,
// and so do the days taught and the progress of a class it continues, and of
// its own parts of an item split or merged. An item an exam answer was carried
// to is never split. Made-up data only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addLayer,
  awaitingBetween,
  confirmSessions,
  courseDecisions,
  courseSetup,
  current,
  noteFor,
  planView,
  progressStatement,
  Progress,
  layerKey,
  queueItems,
  releaseChain,
  skippedBy,
  switchLayer,
  type Coverage,
  type PlanLayer,
  type PlanPack,
  type RecordBook,
  type SessionRecord,
} from '../src/index.ts';
import { cemEvents, contextOf, d, mathPack, openBook } from './fixtures.ts';
import { edit, mathFix, mathFixSource, releaseOf, withFix } from './migration-fixtures.ts';
import { attempt, change, made } from './plan-change-fixtures.ts';

const steps = (...packs: PlanPack[]) => {
  const chain = releaseChain(packs, packs.at(-1)!, '2026.1');
  assert.ok(chain.ok);
  return chain.steps;
};
const titleOf = (id: string) => mathPack.items.find((item) => item.id === id)!.title;
const taught = (item: string, from: number, to: number): Coverage => ({ op: 'taught', item, from, to });
const record = (...coverage: Coverage[]) => ({ session: { groupId: 'g' }, coverage }) as unknown as SessionRecord;

async function taughtUntil(book: RecordBook, upTo: string) {
  const context = contextOf(book);
  const sessions = awaitingBetween(context, d('2026-09-13'), d(upTo));
  await book.recordAll(
    d(upTo),
    confirmSessions(
      context,
      sessions.map((session) => ({ session })),
    ),
  );
}

async function moved(book: RecordBook) {
  const course = book.state.courses.get('c-math')!;
  await book.recordAll(d('2026-09-25'), [
    { kind: 'course.set', course: { ...course, pack: { id: mathFix.id, release: '2026.2' } } },
  ]);
  return withFix(book);
}

describe('progress read on a new release', () => {
  it('keeps a renamed item, and finishes both parts of a split item only once the old one was', () => {
    const progress = new Progress('g', [], steps(mathPack, mathFix));
    progress.apply(record(taught('l1', 0, 4), taught('l2', 0, 2)));
    assert.deepEqual(progress.coveredStages('l1b', 'g'), [0, 1, 2, 3]);
    assert.deepEqual(
      [progress.covered('l2a', 'g'), progress.spent('l2a', 'g'), progress.spent('l2b', 'g')],
      [0, 0.5, 0],
    );
    progress.apply(record(taught('l2', 2, 4)));
    assert.deepEqual([progress.covered('l2a', 'g'), progress.covered('l2b', 'g')], [4, 4]);
  });

  it('finishes a merged item once every old item is, and drops a removed one', () => {
    const progress = new Progress('g', [], steps(mathPack, mathFix));
    progress.apply(record(taught('l5', 0, 4)));
    progress.leaveOut('l7');
    assert.deepEqual([progress.covered('l56', 'g'), progress.spent('l56', 'g')], [0, 1]);
    progress.apply(record(taught('l6', 0, 1)));
    assert.equal(progress.covered('l56', 'g'), 4);
    assert.equal(progress.skipped('l7'), false);
  });

  it('reads an item renamed twice as one item, whichever release taught it', () => {
    const third = releaseOf({
      release: '2027.1',
      items: edit(mathFixSource.items, { l1b: ['l1c'] }),
      migration: { from: '2026.2', entries: [{ kind: 'rename', from: 'l1b', to: 'l1c' }] },
    });
    const progress = new Progress('g', ['h1', 'h2'], steps(mathPack, mathFix, third));
    progress.apply(record(taught('l1', 0, 2)));
    progress.apply(record(taught('l1b', 2, 4)));
    assert.deepEqual(progress.coveredStages('l1c', 'g'), [0, 1, 2, 3]);
  });

  it("puts the progress of the class's own parts back on an item split or merged", () => {
    const progress = new Progress('g', [], steps(mathPack, mathFix));
    progress.apply(record(taught('l2~s1~1', 0, 2), taught('l2~s1~2', 0, 2), taught('l5', 0, 4)));
    progress.apply(record(taught('l6~s2~1', 0, 1)));
    assert.deepEqual(
      [progress.covered('l2a', 'g'), progress.covered('l2b', 'g'), progress.covered('l56', 'g')],
      [4, 4, 0],
    );
    progress.apply(record(taught('l6~s2~2', 0, 1)));
    assert.equal(progress.covered('l56', 'g'), 4);
    const second = new Progress('g', [], steps(mathPack, mathFix));
    second.apply(record(taught('l5', 0, 4), taught('l6~s2~2', 0, 1)));
    assert.equal(second.covered('l56', 'g'), 0);
    second.leaveOut('l6~s2~1');
    assert.equal(second.covered('l56', 'g'), 4);
  });

  it('reads the progress of the class it continues on its own release', () => {
    const older = new Progress('g', [], steps(mathPack, mathFix));
    older.apply(record(taught('l2', 0, 4), taught('l1', 0, 2)));
    const progress = new Progress('w', [], steps(mathPack, mathFix));
    progress.inherit(older);
    assert.deepEqual(
      [progress.covered('l2a', 'w'), progress.covered('l2b', 'w'), progress.covered('l1b', 'w')],
      [4, 4, 2],
    );
  });
});

describe('a class moved to a new release', () => {
  it('keeps its place, its recorded sessions, its changes and its notes', async () => {
    const book = await openBook(cemEvents());
    await taughtUntil(book, '2026-09-24');
    await change(
      book,
      { ...made, id: 'k5', kind: 'skip', item: 'l5' },
      { ...made, id: 'k6', kind: 'skip', item: 'l6' },
    );
    const note = { id: 'n1', courseId: 'c-math', itemId: 'l2', number: 1, paragraphs: [] };
    await book.recordAll(d('2026-09-24'), [{ kind: 'lesson-note.set', note }]);
    const recorded = [...book.state.sessions.values()].map((versions) => current(versions));
    const context = await moved(book);
    const setup = courseSetup(context, 'c-math');
    assert.equal(setup.migration.length, 1);
    assert.deepEqual(
      queueItems(setup.pack!, 'main')
        .slice(1, 4)
        .map((item) => item.id),
      ['l1b', 'l2a', 'l2b'],
    );
    const rows = planView(context, 'c-math', d('2026-09-25'))!.main;
    assert.equal(rows.find((row) => row.position)?.item.id, 'l3');
    const parts = rows.filter((row) => row.item.id.startsWith('l2'));
    assert.deepEqual(
      parts.map((row) => [row.item.id, row.covered]),
      [
        ['l2a', 4],
        ['l2b', 4],
      ],
    );
    assert.notEqual(parts[0]?.taught, null);
    assert.deepEqual(parts[1]?.taught, parts[0]?.taught);
    assert.deepEqual(skippedBy(setup.pack!, courseDecisions(context, 'c-math'), 'c-math'), ['l56']);
    assert.deepEqual(
      [...book.state.sessions.values()].map((versions) => current(versions)),
      recorded,
    );
    assert.equal(progressStatement(context, 'c-math', d('2026-09-25'))?.lastResource?.title, `${titleOf('l2')} l2a`);
    assert.equal(noteFor(context.state, 'c-math', 'l2b', setup.migration)?.id, 'n1');
    assert.equal(noteFor(context.state, 'c-math', 'l3', setup.migration), undefined);
  });

  it('refuses to split an item an exam answer was carried to', async () => {
    const book = await openBook(cemEvents());
    const decision = { id: 'p1', courseId: 'c-math', kind: 'postpone', items: ['l2'], term: 1 } as const;
    await book.record(d('2026-09-20'), { kind: 'plan.decided', decision });
    const context = await moved(book);
    const split = (item: string) => attempt(context, { ...made, id: 's1', kind: 'split', item, titles: ['A', 'B'] });
    assert.throws(split('l2a'), RangeError);
    assert.doesNotThrow(split('l4'));
  });

  it("carries a school layer's operations as the class's own", async () => {
    const book = await openBook(cemEvents());
    const school: PlanLayer = {
      level: 'school',
      id: 'example-school',
      pack: mathPack.id,
      title: 'Made-up school layer',
      by: 'Made-up author',
      made: d('2026-09-20'),
      operations: [
        { kind: 'move', item: 'l3', before: 'l2' },
        { kind: 'skip', item: 'l2' },
      ],
    };
    await book.record(d('2026-09-20'), addLayer(book.state, { layer: school }));
    await book.record(d('2026-09-20'), switchLayer(book.state, 'c-math', 'school', layerKey(school)));
    const setup = courseSetup(await moved(book), 'c-math');
    const main = queueItems(setup.pack!, 'main').map((item) => item.id);
    assert.deepEqual(main.slice(main.indexOf('l1b'), main.indexOf('l1b') + 4), ['l1b', 'l3', 'l2a', 'l2b']);
    assert.deepEqual(setup.pack!.fromLayers?.skips, ['l2a', 'l2b']);
  });

  it('carries on a renamed item from the stage it reached', async () => {
    const book = await openBook(cemEvents());
    await taughtUntil(book, '2026-09-21');
    const context = await moved(book);
    const row = planView(context, 'c-math', d('2026-09-22'))!.main.find((one) => one.position);
    assert.deepEqual([row?.item.id, row?.covered, row?.stages], ['l1b', 2, 4]);
  });
});
