// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's own list offered for review (#227, answer 347): only the
// course's level, grade, subject and year, the items, the licence and the
// credit go, and the curators read the file back. Made-up lists only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { listOffer, listOfferFile, readListOffer, saveFreeList, type Context, type FreeList } from '../src/index.ts';
import { cemEvents, contextOf, country, d, openBook } from './fixtures.ts';

const list: FreeList = {
  courseId: 'c-math',
  started: d('2026-09-14'),
  items: [
    { id: 'u1', kind: 'unit', title: 'Made-up unit' },
    { id: 'l1', kind: 'lesson', title: 'Made-up lesson', sessions: 2, stages: ['Made-up start', 'Made-up end'] },
  ],
  removed: [{ id: 'l0', kind: 'lesson', title: 'Made-up removed' }],
};

async function withList(one: FreeList = list): Promise<Context> {
  const book = await openBook(
    cemEvents().map((event) =>
      event.kind === 'course.set' && event.course.id === 'c-math'
        ? { ...event, course: { ...event.course, pack: null } }
        : event,
    ),
  );
  await book.record(d('2026-09-14'), saveFreeList(book.state.courses, one));
  return contextOf(book);
}

const made = d('2026-10-04');

describe('offering a class’s own list', () => {
  it('sends the course’s codes, the items, the licence and the credit, and reads back', async () => {
    const context = await withList();
    const offer = listOffer(context, 'c-math', null, made);
    assert.ok(offer);
    const course = context.state.courses.get('c-math')!;
    assert.equal(offer.subject, course.subject);
    assert.equal(offer.year, course.year);
    assert.equal(offer.credit, null);
    assert.deepEqual(offer.items, list.items);
    const file = listOfferFile(offer, country);
    assert.ok(file);
    for (const absent of ['c-math', 'courseId', 'started', 'removed', 'Made-up removed', 'k-']) {
      assert.equal(file.includes(absent), false, absent);
    }
    assert.deepEqual(readListOffer(file, country), offer);
    const named = listOffer(context, 'c-math', 'Made-up teacher', made);
    assert.equal(named?.credit, 'Made-up teacher');
    const extra = { ...list, items: [{ ...list.items[1]!, note: 'Made-up' } as FreeList['items'][0]] };
    const stripped = listOffer(await withList(extra), 'c-math', null, made);
    assert.deepEqual(stripped?.items, [list.items[1]]);
    assert.ok(listOfferFile(stripped, country));
  });

  it('offers nothing without a saved list, items, or a credit that fits', async () => {
    const context = await withList();
    assert.equal(listOffer(context, 'c-other', null, made), null);
    assert.equal(listOffer(context, 'c-math', 'Made-up\nteacher', made), null);
    assert.equal(listOffer(context, 'c-math', 'x'.repeat(81), made), null);
    assert.equal(listOffer(await withList({ ...list, items: [] }), 'c-math', null, made), null);
  });

  it('refuses a file out of place', async () => {
    const offer = listOffer(await withList(), 'c-math', null, made)!;
    const file = JSON.parse(listOfferFile(offer, country)!) as Record<string, unknown>;
    const read = (change: Record<string, unknown>) => readListOffer(JSON.stringify({ ...file, ...change }), country);
    assert.equal(read({ version: { major: 2, minor: 0 } }), 'version');
    for (const change of [
      { format: 'other' },
      { country: 'tn' },
      { level: 'unknown' },
      { grade: 'unknown' },
      { subject: 'unknown' },
      { year: '2026-2028' },
      { licence: 'CC-BY-4.0' },
      { source: 'pack' },
      { credit: '' },
      { made: '2026-13-01' },
      { items: [] },
      { items: [offer.items[1], offer.items[1]] },
      { items: [{ ...offer.items[1], pupil: 'x' }] },
      { items: [{ ...offer.items[0], sessions: 1 }] },
      { courseId: 'c-math' },
    ]) {
      assert.equal(read(change), 'invalid', JSON.stringify(change));
    }
    assert.equal(readListOffer('not json', country), 'invalid');
  });
});
