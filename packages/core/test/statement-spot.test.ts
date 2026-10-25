// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's spot check (#246, R-Spot, answer 491): the period from the
// year's first day to the statement's day; its school days, the country's
// working days without the holidays; three of them drawn at random, distinct
// and in order, a draw out of range drawn again; and no period for a
// statement of another school year. Made-up statements only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spotDays, spotPeriod, spotSchoolDays, type ProgressStatement, type RandomBytes } from '../src/index.ts';
import { contextOf, d, openBook } from './fixtures.ts';

const statement = (day: string, year = '2026-2027') =>
  ({
    day: d(day),
    class: { level: 'cem', grade: '4am', section: '4M2', subject: 'arabic', year },
  }) as unknown as ProgressStatement;

/** Bytes that read first as a value the draw must refuse, then as zero. */
function refusedThenZero(): RandomBytes {
  let first = true;
  return (length) => {
    const bytes = new Uint8Array(length).fill(first ? 0xff : 0);
    first = false;
    return bytes;
  };
}

test('the period runs from the year’s first day to the statement’s day, on school days only', async () => {
  const context = contextOf(await openBook([]));
  assert.deepEqual(spotPeriod(context, statement('2026-11-12')), { from: '2026-09-20', to: '2026-11-12' });
  const days = spotSchoolDays(context, statement('2026-11-12'));
  assert.equal(days.length, 34);
  assert.equal(days.includes(d('2026-09-25')), false);
  assert.equal(
    days.some((day) => day >= '2026-10-29' && day <= '2026-11-07'),
    false,
  );
  assert.equal(spotPeriod(context, statement('2026-06-01', '2025-2026')), null);
  assert.deepEqual(spotDays(context, statement('2026-06-01', '2025-2026'), refusedThenZero()), []);
});

test('three distinct school days are drawn, in order, a draw out of range drawn again', async () => {
  const context = contextOf(await openBook([]));
  assert.deepEqual(spotDays(context, statement('2026-11-12'), refusedThenZero()), [
    '2026-09-20',
    '2026-09-21',
    '2026-09-22',
  ]);
  const school = new Set(spotSchoolDays(context, statement('2026-11-12')));
  for (let run = 0; run < 50; run += 1) {
    const drawn = spotDays(context, statement('2026-11-12'), (length) =>
      Uint8Array.from({ length }, () => Math.floor(Math.random() * 256)),
    );
    assert.equal(new Set(drawn).size, 3);
    assert.deepEqual([...drawn].sort(), drawn);
    assert.equal(
      drawn.every((day) => school.has(day)),
      true,
    );
  }
  assert.deepEqual(spotDays(context, statement('2026-09-21'), refusedThenZero()), ['2026-09-20', '2026-09-21']);
});
