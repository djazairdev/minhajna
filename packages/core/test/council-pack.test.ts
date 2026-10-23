// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The class-council pack (#244, answer 470): the class's figures over the
// pupils with an average, a 9.75 left below 10; the population's standard
// deviation; the bands and boys and girls apart; ranks in order; the default
// thresholds, then the teacher's, refused out of range, order or decimals,
// kept privately, on the teacher's own routes only, and on a 10 scale halved;
// term 2 beside term 1 with each previous rank; and the roll-call book's
// absences, lateness and rate, or none with no roll call taken. Made-up
// records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  councilPack,
  DEFAULT_COUNTING,
  DEFAULT_THRESHOLDS,
  isThresholds,
  layerOf,
  OWN_ROUTES,
  recordsForRoute,
  ROUTES,
  rollCallUnits,
  setMark,
  setThresholds,
  takeRollCall,
  thresholdsOf,
  type AssessmentData,
  type MarkValue,
  type OutboundRoute,
  type RecordBook,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

/** Averages that are the exam's mark, out of `scale`. */
const data = (scale: number): AssessmentData => ({
  country: 'dz',
  release: 'test.1',
  presets: [
    {
      level: 'cem',
      scale,
      circular: '270',
      rulesYear: '2025-2026',
      components: [{ id: 'a', name: { ar: 'a' }, capture: 'manual', points: scale, min: 1, max: scale }],
      source: 'Made up.',
    },
  ],
  formulas: [{ level: 'cem', id: 'cem', weights: { E: 1 } }],
});
const exams = (term: number, marks: Record<string, MarkValue>, max = 20) =>
  Object.entries(marks).map(([pupilId, value]) =>
    setMark({ courseId: 'c-math', term, target: { kind: 'exam' }, pupilId }, value, max),
  );
const TODAY = d('2027-03-25');
const pack = (book: RecordBook, term: number, scale = 20) =>
  councilPack(contextOf(book), data(scale), 'c-math', term, TODAY);

/** Term 1: girls p01 18, p03 12, p05 15; boys p02 9.75, p04 7.5, p06 4; p07 absent. */
async function termOne() {
  const book = await openBook(cemEvents());
  await book.recordAll(
    d('2026-12-10'),
    exams(1, { p01: 18, p02: 9.75, p03: 12, p04: 7.5, p05: 15, p06: 4, p07: 'absent' }),
  );
  return book;
}

test('the class’s figures, bands, boys and girls, ranks and default thresholds', async () => {
  const one = pack(await termOne(), 1);
  assert.ok(one);
  const averages = [18, 9.75, 12, 7.5, 15, 4];
  const mean = averages.reduce((sum, value) => sum + value, 0) / 6;
  assert.equal(one.mean?.toFixed(6), mean.toFixed(6));
  assert.deepEqual([one.highest, one.lowest, one.reached, one.counted], [18, 4, 3, 6]);
  const deviation = Math.sqrt(averages.reduce((sum, value) => sum + (value - mean) ** 2, 0) / 6);
  assert.equal(one.deviation?.toFixed(6), deviation.toFixed(6));
  assert.deepEqual(
    one.bands.map((band) => [band.from, band.to, band.count]),
    [
      [0, 5, 1],
      [5, 8, 1],
      [8, 10, 1],
      [10, 12, 0],
      [12, 14, 1],
      [14, 16, 1],
      [16, null, 1],
    ],
  );
  assert.deepEqual(
    one.sexes.map((sex) => [sex.sex, sex.counted, sex.reached, sex.mean?.toFixed(3)]),
    [
      ['m', 3, 0, '7.083'],
      ['f', 3, 3, '15.000'],
    ],
  );
  assert.deepEqual(
    one.ranks.map((row) => [row.pupilId, row.rank, row.previous]),
    [
      ['p01', 1, null],
      ['p05', 2, null],
      ['p03', 3, null],
      ['p02', 4, null],
      ['p04', 5, null],
      ['p06', 6, null],
    ],
  );
  assert.deepEqual(one.thresholds, DEFAULT_THRESHOLDS);
  assert.deepEqual(
    [one.remedial.map((row) => row.pupilId), one.distinction.map((row) => row.pupilId)],
    [
      ['p04', 'p06'],
      ['p01', 'p05'],
    ],
  );
  assert.equal(one.previous, null);
  assert.equal(one.attendance, null);
});

test('the teacher’s thresholds: refused unless kept on 20, in order, with two decimals; private', async () => {
  assert.throws(() => setThresholds({ remedial: 12, distinction: 10 }), /order/);
  assert.throws(() => setThresholds({ remedial: 0, distinction: 15 }), /range/);
  assert.throws(() => setThresholds({ remedial: 8, distinction: 21 }), /range/);
  assert.throws(() => setThresholds({ remedial: 8.125, distinction: 15 }), /decimals/);
  assert.equal(isThresholds({ remedial: 8.5, distinction: 15.25 }), true);
  assert.equal(isThresholds({ remedial: 8, distinction: 15, extra: 1 }), false);
  assert.equal(isThresholds({ remedial: '8', distinction: 15 }), false);
  const book = await termOne();
  const event = setThresholds({ remedial: 10, distinction: 12 });
  assert.equal(layerOf(event), 'private');
  await book.record(d('2026-12-11'), event);
  assert.deepEqual(thresholdsOf(book.state), { remedial: 10, distinction: 12 });
  for (const route of ROUTES as readonly OutboundRoute[]) {
    const kept = recordsForRoute(book.state, route).filter((one) => one.kind === 'council-thresholds.set');
    assert.equal(kept.length, (OWN_ROUTES as readonly string[]).includes(route) ? 1 : 0, route);
  }
  const one = pack(book, 1);
  assert.deepEqual(
    [one?.remedial.map((row) => row.pupilId), one?.distinction.map((row) => row.pupilId)],
    [
      ['p02', 'p04', 'p06'],
      ['p01', 'p03', 'p05'],
    ],
  );
});

test('on a 10 scale, the bands and thresholds are halved', async () => {
  const book = await openBook(cemEvents());
  await book.recordAll(d('2026-12-10'), exams(1, { p01: 7.5, p02: 3.99, p03: 5 }, 10));
  const one = pack(book, 1, 10);
  assert.ok(one);
  assert.deepEqual(
    one.bands.map((band) => [band.from, band.count]),
    [
      [0, 0],
      [2.5, 1],
      [4, 0],
      [5, 1],
      [6, 0],
      [7, 1],
      [8, 0],
    ],
  );
  assert.deepEqual(one.thresholds, { remedial: 4, distinction: 7.5 });
  assert.deepEqual(
    [one.remedial.map((row) => row.pupilId), one.distinction.map((row) => row.pupilId)],
    [['p02'], ['p01']],
  );
  assert.equal(one.reached, 2);
});

test('term 2 sits beside term 1, with each pupil’s previous rank', async () => {
  const book = await termOne();
  await book.recordAll(d('2027-03-10'), exams(2, { p01: 16, p02: 12, p03: 12, p05: 15, p06: 9 }));
  const two = pack(book, 2);
  assert.ok(two);
  assert.deepEqual(
    two.ranks.map((row) => [row.pupilId, row.rank, row.previous]),
    [
      ['p01', 1, 1],
      ['p05', 2, 2],
      ['p02', 3, 4],
      ['p03', 3, 3],
      ['p06', 5, 6],
    ],
  );
  assert.equal(two.previous?.mean?.toFixed(4), '11.0417');
  assert.deepEqual([two.previous?.reached, two.previous?.counted], [3, 6]);
  const three = pack(book, 3);
  assert.deepEqual(
    [three?.counted, three?.mean, three?.deviation, three?.ranks, three?.previous?.counted],
    [0, null, null, [], 5],
    'term 3 has no average yet, and compares with term 2',
  );
});

test('the attendance summary counts the term’s roll calls up to today', async () => {
  const book = await termOne();
  const units = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-21'), d('2026-09-23'));
  assert.ok(units.length >= 2);
  for (const [index, unit] of units.entries()) {
    const marks =
      index === 0
        ? { absent: [{ pupilId: 'p01', justified: false }], late: [] }
        : index === 1
          ? { absent: [], late: ['p02'] }
          : { absent: [], late: [] };
    await book.record(unit.day, takeRollCall(contextOf(book), unit, marks));
  }
  const attendance = pack(book, 1)?.attendance;
  assert.ok(attendance);
  assert.deepEqual([attendance.absent, attendance.late], [1, 1]);
  assert.ok(attendance.rate !== null && attendance.rate > 0.9 && attendance.rate < 1);
  const early = councilPack(contextOf(book), data(20), 'c-math', 1, d('2026-09-01'));
  assert.equal(early?.attendance, null, 'nothing is counted before the term starts');
});

test('with no roll call taken, there is no summary, even when units without one count as present', async () => {
  const book = await termOne();
  await book.record(d('2026-10-01'), {
    kind: 'counting.set',
    rules: { ...DEFAULT_COUNTING, untaken: 'present' },
  });
  assert.equal(pack(book, 1)?.attendance, null);
});
