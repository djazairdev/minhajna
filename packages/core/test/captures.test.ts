// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Captures during the session (#239, answers 441 and 442): each item's
// range; the last capture counting and a zero clearing it; the homework
// counts a session's captures propose; a pupil's evidence over a period and
// a course; captures travelling with the pupil records; and a session not
// held no longer counting, while a withdrawn one's still do (answer 450).
// Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  confirmSessions,
  evidence,
  homeworkProposal,
  layerOf,
  recordsForRoute,
  sessionCaptures,
  sessionsBetween,
  setCapture,
  type SessionRef,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const session = (day: string, courseId = 'c-math'): SessionRef => ({
  key: `${courseId}/${day}/m1/g-all`,
  courseId,
  groupId: 'g-all',
  day: d(day),
  slot: { half: 'morning', index: 1 },
});

test('each item keeps to its range', () => {
  const s = session('2026-10-05');
  assert.equal(layerOf(setCapture(s, 'p01', 'participation', 7)), 'pupil-records');
  assert.throws(() => setCapture(s, 'p01', 'homework', 3), /within its item/);
  assert.throws(() => setCapture(s, 'p01', 'notebook', 2), /within its item/);
  assert.throws(() => setCapture(s, 'p01', 'behaviour', -1), /within its item/);
  assert.throws(() => setCapture(s, 'p01', 'participation', 1.5), /within its item/);
});

test('the last capture counts, a zero clears it, and homework proposes its two counts', async () => {
  const book = await openBook(cemEvents());
  const s = session('2026-10-05');
  for (const event of [
    setCapture(s, 'p01', 'participation', 1),
    setCapture(s, 'p01', 'participation', 2),
    setCapture(s, 'p02', 'homework', 1),
    setCapture(s, 'p03', 'homework', 2),
    setCapture(s, 'p04', 'homework', 1),
    setCapture(s, 'p04', 'homework', 0),
    setCapture(s, 'p05', 'notebook', 1),
    setCapture(session('2026-10-06'), 'p06', 'homework', 1),
  ]) {
    await book.record(d('2026-10-05'), event);
  }
  assert.deepEqual(Object.fromEntries(sessionCaptures(book.state, s.key)), {
    p01: { participation: 2 },
    p02: { homework: 1 },
    p03: { homework: 2 },
    p05: { notebook: 1 },
  });
  const all = ['p01', 'p02', 'p03', 'p04', 'p05'];
  assert.deepEqual(homeworkProposal(book.state, s.key, all), { notDone: 1, reliedOn: 1 });
  assert.deepEqual(homeworkProposal(book.state, s.key, ['p01', 'p03']), { notDone: 0, reliedOn: 1 });
  const sent = recordsForRoute(book.state, 'school-space').filter((one) => one.kind === 'capture.set');
  assert.equal(sent.length, 5);
});

test('a pupil’s evidence counts the course’s sessions in the period only', async () => {
  const book = await openBook(cemEvents());
  for (const event of [
    setCapture(session('2026-09-28'), 'p01', 'participation', 3),
    setCapture(session('2026-10-05'), 'p01', 'participation', 2),
    setCapture(session('2026-10-05'), 'p01', 'behaviour', 1),
    setCapture(session('2026-10-05'), 'p01', 'homework', 2),
    setCapture(session('2026-10-12'), 'p01', 'homework', 1),
    setCapture(session('2026-10-12'), 'p01', 'notebook', 1),
    setCapture(session('2026-10-12', 'c-other'), 'p01', 'participation', 5),
    setCapture(session('2026-12-20'), 'p01', 'participation', 4),
    setCapture(session('2026-10-12'), 'p02', 'participation', 9),
  ]) {
    await book.record(d('2026-10-12'), event);
  }
  assert.deepEqual(evidence(book.state, 'c-math', 'p01', d('2026-09-21'), d('2026-12-17')), {
    participation: 5,
    behaviour: 1,
    homeworkNotDone: 1,
    homeworkHelped: 1,
    notebookIncomplete: 1,
  });
});

test('a session not held no longer counts its captures, and a withdrawn one still does', async () => {
  const book = await openBook(cemEvents());
  const [held] = sessionsBetween(contextOf(book), d('2026-09-30'), d('2026-09-30'), new Set(['c-math']));
  assert.ok(held);
  const [event] = confirmSessions(contextOf(book), [{ session: held, details: {} }]);
  assert.ok(event?.kind === 'session.recorded');
  const s = event.record.session;
  await book.record(d('2026-09-30'), setCapture(s, 'p01', 'homework', 1));
  await book.record(d('2026-09-30'), setCapture(s, 'p01', 'participation', 2));
  const shown = () => [
    sessionCaptures(book.state, s.key).size,
    homeworkProposal(book.state, s.key, ['p01']).notDone,
    evidence(book.state, 'c-math', 'p01', d('2026-09-30'), d('2026-09-30')).participation,
  ];
  assert.deepEqual(shown(), [1, 1, 2]);
  await book.record(d('2026-09-30'), event);
  assert.deepEqual(shown(), [1, 1, 2]);
  await book.record(d('2026-10-01'), { kind: 'session.withdrawn', session: s });
  assert.deepEqual(shown(), [1, 1, 2]);
  const notHeld = { ...event.record, outcome: 'not-held' as const };
  await book.record(d('2026-10-01'), { kind: 'session.recorded', record: notHeld });
  assert.deepEqual(shown(), [0, 0, 0]);
  await book.record(d('2026-10-02'), event);
  assert.deepEqual(shown(), [1, 1, 2]);
});
