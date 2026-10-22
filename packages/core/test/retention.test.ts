// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How long records are kept (#235, answer 428): the drawn defaults, the
// teacher's choice kept privately as its last version, leaving on no route
// out of the teacher's devices, each year's offers from its own end, and a
// stored choice checked field by field. Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_RETENTION,
  erasureOffers,
  isRetention,
  layerOf,
  OWN_ROUTES,
  ROUTES,
  recordsForRoute,
  retentionOf,
  type OutboundRoute,
  type RecordEvent,
} from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';

test('the defaults keep lesson records and notes, and offer pupil data after the next year', async () => {
  const book = await openBook(cemEvents());
  assert.deepEqual(retentionOf(book.state), DEFAULT_RETENTION);
  assert.deepEqual(erasureOffers(book.state), [
    { year: '2026-2027', pupils: '2028-07-01', lessons: null, notes: null },
  ]);
});

test('the teacher’s last choice counts and stays private; an earlier year is offered on its own date', async () => {
  const book = await openBook(cemEvents());
  const event: RecordEvent = {
    kind: 'retention.set',
    retention: { lessons: 'after-three-years', pupils: 'after-next-year', notes: 'kept' },
  };
  assert.equal(layerOf(event), 'private');
  await book.record(d('2026-10-01'), event);
  const chosen = { lessons: 'after-three-years', pupils: 'after-its-year', notes: 'with-pupils' } as const;
  await book.record(d('2026-10-02'), { kind: 'retention.set', retention: chosen });
  await book.record(d('2026-10-02'), {
    kind: 'course.set',
    course: {
      id: 'c-old',
      classId: 'k-1am2',
      subject: 'math',
      year: '2025-2026',
      pack: { id: 'dz.cem.1am.math.example', release: '2026.1' },
    },
  });
  assert.deepEqual(retentionOf(book.state), chosen);
  for (const route of ROUTES.filter((one) => !(OWN_ROUTES as readonly string[]).includes(one)) as OutboundRoute[]) {
    assert.deepEqual(
      recordsForRoute(book.state, route).filter((one) => one.kind === 'retention.set'),
      [],
    );
  }
  assert.deepEqual(erasureOffers(book.state), [
    { year: '2025-2026', pupils: '2026-07-01', lessons: '2029-07-01', notes: '2026-07-01' },
    { year: '2026-2027', pupils: '2027-07-01', lessons: '2030-07-01', notes: '2027-07-01' },
  ]);
});

test('a stored choice must name each of the three kinds with a known value, and nothing else', () => {
  assert.equal(isRetention(DEFAULT_RETENTION), true);
  assert.equal(isRetention({ ...DEFAULT_RETENTION, lessons: 'never' }), false);
  assert.equal(isRetention({ ...DEFAULT_RETENTION, extra: true }), false);
  assert.equal(isRetention({ lessons: 'kept', pupils: 'after-its-year' }), false);
  assert.equal(isRetention(null), false);
  assert.equal(isRetention('kept'), false);
});
