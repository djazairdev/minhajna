// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pilot's own timings (#220, answer 267): a tap's time split evenly
// among the sessions it confirmed, in whole tenths that add up; the median,
// the 90th percentile by nearest rank, the share confirmed in one tap, and
// the minutes per week on sessions and roll calls; a timing kept under its
// school week's first day; and only well-formed timings read back, with
// that week and no clock time. Made-up figures only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readTimings, splitTenths, timingSummary, timingWeek, type Timing } from '../src/index.ts';
import { d } from './fixtures.ts';

const session = (tenths: number, oneTap = true, week = '2026-10-11'): Timing => ({
  kind: 'session',
  week: d(week),
  tenths,
  oneTap,
});

test('one tap’s time is split evenly among its sessions, in whole tenths that add up', () => {
  assert.deepEqual(splitTenths(100, 4), [25, 25, 25, 25]);
  assert.deepEqual(splitTenths(101, 3), [34, 34, 33]);
  assert.deepEqual(splitTenths(2, 3), [1, 1, 0]);
  assert.deepEqual(splitTenths(-5, 2), [0, 0]);
});

test('the summary gives the median, the 90th percentile, one taps and minutes per week', () => {
  assert.deepEqual(timingSummary([]), {
    sessions: 0,
    median: null,
    p90: null,
    oneTap: 0,
    weeks: 0,
    weeklyMinutes: null,
  });
  const timings = [
    ...[30, 40, 40, 50, 60, 70, 80, 90, 100].map((tenths) => session(tenths)),
    session(300, false, '2026-10-18'),
    { kind: 'roll' as const, week: d('2026-10-18'), tenths: 1200, oneTap: false },
  ];
  const summary = timingSummary(timings);
  assert.equal(summary.sessions, 10);
  assert.equal(summary.median, 6.5);
  assert.equal(summary.p90, 10);
  assert.equal(summary.oneTap, 9);
  assert.equal(summary.weeks, 2);
  assert.equal(summary.weeklyMinutes, (560 + 300 + 1200) / 600 / 2);
  assert.equal(timingSummary([session(45)]).median, 4.5);
  assert.equal(timingSummary([session(45)]).p90, 4.5);
});

test('a timing is kept under its school week’s first day, never the day itself', () => {
  assert.equal(timingWeek(d('2026-10-15'), 0), '2026-10-11');
  assert.equal(timingWeek(d('2026-10-11'), 0), '2026-10-11');
  assert.equal(timingWeek(d('2026-10-15'), 1), '2026-10-12');
});

test('only well-formed timings are read back, with a week and no clock time', () => {
  const good = [{ kind: 'roll', week: '2026-10-11', tenths: 12, oneTap: false }];
  assert.deepEqual(readTimings(good, 0), good);
  assert.throws(() => readTimings(good, 1), TypeError);
  for (const bad of [
    { kind: 'mark', week: '2026-10-11', tenths: 12, oneTap: false },
    { kind: 'roll', week: '2026-10-11T08:00', tenths: 12, oneTap: false },
    { kind: 'roll', week: '2026-10-15', tenths: 12, oneTap: false },
    { kind: 'roll', week: '2026-13-45', tenths: 12, oneTap: false },
    { kind: 'roll', week: '2026-10-11', tenths: '12', oneTap: false },
    { kind: 'roll', week: '2026-10-11', tenths: 12, oneTap: 'true' },
    { kind: 'roll', week: '2026-10-11', tenths: 1.5, oneTap: false },
    { kind: 'roll', week: '2026-10-11', tenths: -1, oneTap: false },
    { kind: 'roll', week: '2026-10-11', tenths: 12 },
    null,
  ]) {
    assert.throws(() => readTimings([bad], 0), TypeError);
  }
  assert.throws(() => readTimings({}, 0), TypeError);
});
