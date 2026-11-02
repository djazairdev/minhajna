// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The days whose totals the server keeps worked out (#596, answer 628): a day
// takes the shares of at most MAX_DIRECTORATES directorates, MAX_SUBJECTS
// subjects and MAX_ITEMS plan items, in MAX_DAY_BYTES, a share sent again
// counting its bytes once and a name once taken counting while the day is kept;
// the day is read from the store once, and its sums worked out once until a
// share comes in, for the last days whose shares take twice a day's bytes in
// all, not kept when one came in while they were added up; a world started
// again under the same ID keeps its own days; and an erased world's days are
// forgotten. Every world and share here is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Share } from '../src/totals/share-read.js';
import { MAX_DAY_BYTES, MAX_DIRECTORATES, MAX_ITEMS, MAX_SUBJECTS, TotalsDays } from '../src/totals/totals-days.js';
import type { World } from '../src/worlds/world-store.js';
import { madeUpShare } from './share-kit.js';

const WORLD = { id: 'K7QF3', starterHash: 'a'.repeat(64) } as World;
const AGAIN = { id: 'K7QF3', starterHash: 'b'.repeat(64) } as World;
const none = () => Promise.resolve([]);

/** A made-up share of a directorate, its math holding these plan items, each done `sessions` times. */
function share(at: number, directorate = 'dir-01', items: readonly string[] = ['item-01'], sessions = 1): Share {
  const base = madeUpShare(at);
  const done = { sessions, merged: 0, skipped: 0, retaught: 0 };
  const math = { ...base.subjects['math']!, items: Object.fromEntries(items.map((item) => [item, done])) };
  return { ...base, directorate, subjects: { math } };
}

describe('the days of totals kept', () => {
  it('takes the shares of at most MAX_DIRECTORATES directorates and MAX_SUBJECTS subjects', async () => {
    const days = new TotalsDays();
    for (let at = 1; at <= MAX_DIRECTORATES; at += 1)
      assert.equal(await days.take(WORLD, share(at, `d-${at}`), none), null);
    assert.match((await days.take(WORLD, share(100, 'd-new'), none))!, /directorates/);
    assert.equal(await days.take(WORLD, share(100, 'd-1'), none), null);
    const math = share(1).subjects['math']!;
    const many = (from: number) => Object.fromEntries(Array.from({ length: 32 }, (_, at) => [`s-${from + at}`, math]));
    assert.equal(await days.take(WORLD, { ...share(101, 'd-1'), subjects: many(0) }, none), null);
    assert.equal(await days.take(WORLD, { ...share(102, 'd-1'), subjects: many(31) }, none), null);
    assert.match((await days.take(WORLD, { ...share(103, 'd-1'), subjects: many(40) }, none))!, /subjects/);
    assert.equal(MAX_SUBJECTS, 64);
  });

  it('takes at most MAX_ITEMS plan items, a name once taken counting while the day is kept', async () => {
    const days = new TotalsDays();
    const names = (from: number) => Array.from({ length: 2000 }, (_, at) => `item-${from + at}`);
    for (let at = 0; at < MAX_ITEMS / 2000; at += 1)
      assert.equal(await days.take(WORLD, share(at, 'dir-01', names(at * 2000)), none), null);
    assert.match((await days.take(WORLD, share(50, 'dir-01', ['item-new']), none))!, /plan items/);
    assert.equal(await days.take(WORLD, share(0, 'dir-01', ['item-1']), none), null);
    assert.match((await days.take(WORLD, share(0, 'dir-01', ['item-new']), none))!, /plan items/);
  });

  it('takes at most MAX_DAY_BYTES of shares, a share sent again counting once', async () => {
    const days = new TotalsDays();
    const names = Array.from({ length: 1800 }, (_, at) => `item-${at}-${'x'.repeat(48)}`);
    const big = (at: number) => share(at, 'dir-01', names, 99_999_999);
    const each = Buffer.byteLength(JSON.stringify(big(1)));
    const fit = Math.floor(MAX_DAY_BYTES / each);
    for (let at = 1; at <= fit; at += 1) assert.equal(await days.take(WORLD, big(at), none), null);
    assert.equal(await days.take(WORLD, big(1), none), null);
    assert.match((await days.take(WORLD, big(fit + 1), none))!, /bytes/);
  });

  it('reads a day once, works its sums out once until a share comes in, and keeps a world’s own days', async () => {
    const days = new TotalsDays();
    const kept = [share(1), share(2), share(3)];
    let reads = 0;
    const read = () => {
      reads += 1;
      return Promise.resolve(kept);
    };
    const first = await days.sums(WORLD, '2026-12-06', read);
    assert.equal(await days.sums(WORLD, '2026-12-06', read), first);
    assert.equal(reads, 1);
    days.changed(WORLD, '2026-12-06');
    assert.notEqual(await days.sums(WORLD, '2026-12-06', read), first);
    assert.equal(reads, 2);
    assert.equal(await days.take(AGAIN, share(9, 'dir-09'), none), null);
    await days.sums(AGAIN, '2026-12-06', read);
    assert.equal(reads, 3);
    days.forget(['K7QF3']);
    await days.sums(WORLD, '2026-12-06', read);
    await days.sums(WORLD, '2026-12-06', read);
    assert.equal(reads, 4);
  });

  it('keeps the sums of the last days whose shares take twice a day’s bytes in all', async () => {
    const days = new TotalsDays();
    const names = Array.from({ length: 1800 }, (_, at) => `item-${at}-${'x'.repeat(48)}`);
    const big = share(1, 'dir-01', names, 99_999_999);
    const count = Math.ceil((0.7 * MAX_DAY_BYTES) / Buffer.byteLength(JSON.stringify(big)));
    let reads = 0;
    const read = () => {
      reads += 1;
      return Promise.resolve([share(1)]);
    };
    const dated = (day: string) => ({ ...WORLD, id: `D${day.slice(-4).replace('-', '')}` }) as World;
    for (const day of ['2026-12-06', '2026-12-13', '2026-12-20']) {
      for (let at = 1; at <= count; at += 1) await days.take(dated(day), { ...big, id: madeUpShare(at).id, day }, none);
      await days.sums(dated(day), day, read);
    }
    await days.sums(dated('2026-12-20'), '2026-12-20', read);
    await days.sums(dated('2026-12-13'), '2026-12-13', read);
    assert.equal(reads, 3);
    await days.sums(dated('2026-12-06'), '2026-12-06', read);
    assert.equal(reads, 4);
  });

  it('keeps no sums worked out while a share came in', async () => {
    const days = new TotalsDays();
    await days.take(WORLD, share(1), none);
    const read = () => {
      days.changed(WORLD, '2026-12-06');
      return Promise.resolve([share(1)]);
    };
    const first = await days.sums(WORLD, '2026-12-06', read);
    assert.notEqual(await days.sums(WORLD, '2026-12-06', () => Promise.resolve([share(1)])), first);
  });
});
