// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The inspector's spot-check sheet (#594, answer 622): three days are drawn
// among the candidates, each once and in order, every candidate when there are
// fewer, and over many draws every day is drawn; the days with a held session
// count each course's week at its version in force, a correction that holds a
// session adding its day and one that drops it removing it; a drawn day's rows
// are its held sessions in the order of day, start and class; a sheet reads
// only in its shape, within its limits and with one note a row under a row's
// key, a short sheet is topped up keeping its days, and the latest kept for a
// grant counts, under one record key a grant. Every class and course is made
// up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  drawSpotDays,
  heldDays,
  keptSpotSheet,
  parseDay,
  readSpotSheet,
  recordKey,
  spotRowOf,
  spotRows,
  topUpSpotDays,
  SPOT_BOOKS_MOST,
  SPOT_NOTE_MOST,
  type Day,
  type WeekRecord,
  type WeekSession,
} from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';

const TOTALS = { subject: 'arabic', items: [], reached: 0, runsLong: false, covered: 0, closed: 0 };
const at = (day: WeekSession['day'], start: number, state: WeekSession['state']): WeekSession => ({
  day,
  start,
  end: start + 60,
  group: '',
  week: 'both',
  state,
});
const week = (course: string, first: string, sessions: WeekSession[], name: string, version = 0): WeekRecord => ({
  course,
  week: parseDay(first),
  version,
  totals: TOTALS,
  class: name,
  subject: 'Maths',
  sessions,
});
const [A, B, G] = ['a'.repeat(32), 'b'.repeat(32), 'c'.repeat(32)];
const days = (...list: string[]) => list.map(parseDay);
/** A made-up source of random bytes, counting up from a seed. */
const counter = (seed: number) => {
  let next = seed;
  return (length: number) => Uint8Array.from({ length }, () => (next++ * 37) % 256);
};

describe('the days a sheet draws', () => {
  it('are three of the candidates, each once and in order, or every candidate when fewer', () => {
    const pool = days('2027-01-03', '2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07');
    for (let seed = 0; seed < 20; seed += 1) {
      const drawn = drawSpotDays([...pool, ...pool.slice(0, 1)], counter(seed));
      assert.equal(drawn.length, 3);
      assert.equal(new Set(drawn).size, 3);
      assert.deepEqual(drawn, [...drawn].sort());
      assert.ok(drawn.every((one) => pool.includes(one)));
    }
    assert.deepEqual(drawSpotDays(pool.slice(0, 2).reverse(), counter(1)), pool.slice(0, 2));
    assert.deepEqual(drawSpotDays([], counter(1)), []);
  });

  it('reach every day over many draws', () => {
    const pool = days('2027-01-03', '2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07');
    const seen = new Set<Day>();
    for (let seed = 0; seed < 200; seed += 1) for (const one of drawSpotDays(pool, counter(seed))) seen.add(one);
    assert.deepEqual([...seen].sort(), pool);
  });
});

describe('the days and rows of signed weeks', () => {
  const weeks = [
    week(A, '2027-01-03', [at(0, 480, 'held'), at(1, 480, 'not-held'), at(2, 480, 'awaiting')], '1م2'),
    week(B, '2027-01-03', [at(0, 420, 'held'), at(3, 480, 'held')], '1م1'),
    week(A, '2027-01-10', [at(0, 480, 'held'), at(2, 480, 'not-held')], '1م2'),
  ];

  it('count each course’s week at its version in force', () => {
    assert.deepEqual(heldDays(weeks), days('2027-01-03', '2027-01-06', '2027-01-10'));
    const corrected = week(A, '2027-01-10', [at(0, 480, 'not-held'), at(2, 480, 'held')], '1م2', 1);
    assert.deepEqual(heldDays([...weeks, corrected]), days('2027-01-03', '2027-01-06', '2027-01-12'));
  });

  it('give a drawn day’s held sessions in the order of day, start and class', () => {
    const rows = spotRows(weeks, days('2027-01-03', '2027-01-12'));
    assert.deepEqual(
      rows.map((one) => [one.day, one.start, one.class, one.course]),
      [
        [parseDay('2027-01-03'), 420, '1م1', B],
        [parseDay('2027-01-03'), 480, '1م2', A],
      ],
    );
    assert.equal(rows[1]?.key, `2027-01-03\n${A}\n480\n`);
    assert.deepEqual(spotRows(weeks, []), []);
  });
});

describe('a kept sheet', () => {
  const sheet = { grant: G, days: days('2027-01-03', '2027-01-06'), notes: 'Made-up notes', books: [] };

  it('reads only in its shape, within its limits, with one note a row', () => {
    const books = [{ row: `2027-01-03\n${A}\n480\n`, note: 'matches' }];
    const row = (start: number) => `2027-01-03\n${A}\n${start}\nG1`;
    assert.deepEqual(readSpotSheet({ ...sheet, books }), { ...sheet, books });
    const broken = [
      { ...sheet, extra: 1 },
      { ...sheet, grant: 'not-an-id' },
      { ...sheet, days: days('2027-01-03', '2027-01-04', '2027-01-05', '2027-01-06') },
      { ...sheet, days: ['2027-13-01'] },
      { ...sheet, days: days('2027-01-03', '2027-01-03') },
      { ...sheet, notes: 'x'.repeat(SPOT_NOTE_MOST + 1) },
      { ...sheet, books: [...books, ...books] },
      { ...sheet, books: [{ row: books[0]?.row, note: 'x', more: 1 }] },
      { ...sheet, books: [{ row: 'not a row', note: 'x' }] },
      { ...sheet, books: [{ row: `2027-01-03\nnot-an-id\n480\n`, note: 'x' }] },
      { ...sheet, books: [{ row: row(1440), note: 'x' }] },
      { ...sheet, books: [{ row: `2027-01-03\n${A}\n480\n${'g'.repeat(81)}`, note: 'x' }] },
      { ...sheet, books: Array.from({ length: SPOT_BOOKS_MOST + 1 }, (_, one) => ({ row: row(one), note: '' })) },
    ];
    for (const one of broken) assert.equal(readSpotSheet(one), null, JSON.stringify(one).slice(0, 80));
    const most = Array.from({ length: SPOT_BOOKS_MOST }, (_, one) => ({ row: row(one), note: '' }));
    assert.equal(readSpotSheet({ ...sheet, books: most })?.books.length, SPOT_BOOKS_MOST);
    assert.deepEqual(spotRowOf(row(480)), { day: parseDay('2027-01-03'), course: A, start: 480, group: 'G1' });
    assert.equal(spotRowOf(`2027-01-03\n${A}\n480\n${'g'.repeat(80)}`)?.group.length, 80);
  });

  it('is topped up to three days, the days kept staying', () => {
    const pool = days('2027-01-03', '2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07');
    for (let seed = 0; seed < 20; seed += 1) {
      const topped = topUpSpotDays(days('2027-01-06'), pool, counter(seed));
      assert.equal(topped.length, 3);
      assert.ok(topped.includes(parseDay('2027-01-06')));
      assert.deepEqual(topped, [...new Set(topped)].sort());
    }
    assert.deepEqual(topUpSpotDays(pool.slice(0, 3), pool, counter(1)), pool.slice(0, 3));
    assert.deepEqual(topUpSpotDays([], [], counter(1)), []);
  });

  it('is the latest kept for its grant, under one record key a grant', async () => {
    const book = await openBook(cemEvents());
    assert.equal(keptSpotSheet(book.entries, G), null);
    await book.record(d('2027-01-12'), { kind: 'inspector.sheet', sheet });
    await book.record(d('2027-01-12'), { kind: 'inspector.sheet', sheet: { ...sheet, grant: A } });
    await book.record(d('2027-01-13'), { kind: 'inspector.sheet', sheet: { ...sheet, notes: 'Later' } });
    await book.record(d('2027-01-13'), { kind: 'inspector.sheet', sheet: { ...sheet, notes: 5 } as never });
    assert.equal(keptSpotSheet(book.entries, G)?.notes, 'Later');
    assert.equal(keptSpotSheet(book.entries, A)?.grant, A);
    assert.equal(recordKey({ kind: 'inspector.sheet', sheet }), `inspector-sheet:${G}`);
  });
});
