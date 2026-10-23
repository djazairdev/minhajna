// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What capture reads (#239, answers 441, 449 and 450): the session it opens
// on, the first not yet recorded, else the last, and none on a day off, on
// the teacher's own calendar day or for a session not held; the pupils of
// the session's group; and the homework counts proposed from the captures
// of the due day's session of the homework's own group or the whole class,
// for the pupils on its list only (answer 453). Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  captureList,
  captureSession,
  captureSessions,
  confirmSessions,
  homeworkCaptured,
  sessionsBetween,
  setCapture,
  type RecordEvent,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

/** Both halves' Tuesday TD every week, one after the other. */
function bothHalves(): RecordEvent[] {
  return cemEvents().map((event) =>
    event.kind === 'timetable.set'
      ? {
          ...event,
          version: {
            ...event.version,
            entries: event.version.entries.map((entry) =>
              entry.id === 'e-tue-1'
                ? { ...entry, weeks: 'every' as const }
                : entry.id === 'e-tue-2'
                  ? { ...entry, weeks: 'every' as const, slot: { ...entry.slot, index: entry.slot.index + 1 } }
                  : entry,
            ),
          },
        }
      : event,
  );
}

test('capture opens on the session not yet recorded, else the last, and none on a day off', async () => {
  const book = await openBook(cemEvents());
  const opened = () => captureSession(contextOf(book), 'c-math', d('2026-09-30'));
  const [session] = sessionsBetween(contextOf(book), d('2026-09-30'), d('2026-09-30'), new Set(['c-math']));
  assert.ok(session);
  assert.equal(opened()?.key, session.key);
  await book.record(d('2026-09-30'), confirmSessions(contextOf(book), [{ session, details: {} }])[0]!);
  assert.equal(opened()?.key, session.key);
  assert.equal(captureSession(contextOf(book), 'c-math', d('2026-10-02')), null);
  assert.equal(captureSession(contextOf(book), 'c-none', d('2026-09-30')), null);
});

test('with two sessions, capture opens on the first not yet recorded, else the last', async () => {
  const book = await openBook(bothHalves());
  const tuesday = d('2026-09-22');
  const [first, second] = sessionsBetween(contextOf(book), tuesday, tuesday, new Set(['c-math']));
  assert.ok(first && second);
  assert.deepEqual(
    captureSessions(contextOf(book), 'c-math', tuesday).map((one) => one.key),
    [first.key, second.key],
  );
  const opened = () => captureSession(contextOf(book), 'c-math', tuesday)?.key;
  assert.equal(opened(), first.key);
  await book.record(tuesday, confirmSessions(contextOf(book), [{ session: first, details: {} }])[0]!);
  assert.equal(opened(), second.key);
  await book.record(tuesday, confirmSessions(contextOf(book), [{ session: second, details: {} }])[0]!);
  assert.equal(opened(), second.key);
});

test('capture leaves out the teacher’s own calendar days and sessions not held', async () => {
  const book = await openBook(cemEvents());
  const monday = d('2026-09-21');
  const [session] = captureSessions(contextOf(book), 'c-math', monday);
  assert.ok(session);
  await book.record(d('2026-09-13'), {
    kind: 'calendar.set',
    entry: {
      id: 'training',
      layer: 'teacher',
      from: monday,
      to: monday,
      effect: 'no-school',
      name: { en: 'Made-up training day' },
      source: 'teacher',
      confidence: 'announced',
    },
  });
  assert.equal(captureSession(contextOf(book), 'c-math', monday), null);
  const day = d('2026-09-30');
  const [held] = sessionsBetween(contextOf(book), day, day, new Set(['c-math']));
  assert.ok(held);
  const [event] = confirmSessions(contextOf(book), [{ session: held, choice: { outcome: 'not-held' } }]);
  await book.record(day, event!);
  assert.deepEqual(captureSessions(contextOf(book), 'c-math', day), []);
});

test('a session’s capture list is its group’s pupils', async () => {
  const book = await openBook(cemEvents());
  const half = captureSession(contextOf(book), 'c-math', d('2026-09-22'));
  const whole = captureSession(contextOf(book), 'c-math', d('2026-09-21'));
  assert.equal(half?.groupId, 'g-1');
  assert.deepEqual(captureList(contextOf(book), half), ['p01', 'p02', 'p03', 'p04', 'p05']);
  assert.equal(captureList(contextOf(book), whole!).length, 10);
});

test('homework counts are proposed from the due day’s captures', async () => {
  const book = await openBook(cemEvents());
  const set = captureSession(contextOf(book), 'c-math', d('2026-09-21'))!;
  const back = captureSession(contextOf(book), 'c-math', d('2026-09-23'))!;
  const item = { session: set, due: d('2026-09-23') };
  assert.equal(homeworkCaptured(contextOf(book), item), null);
  for (const event of [
    setCapture(back, 'p01', 'homework', 1),
    setCapture(back, 'p02', 'homework', 2),
    setCapture(back, 'p03', 'homework', 1),
    setCapture(back, 'p04', 'participation', 2),
  ]) {
    await book.record(d('2026-09-23'), event);
  }
  assert.deepEqual(homeworkCaptured(contextOf(book), item), { notDone: 2, reliedOn: 1 });
  const half = captureSession(contextOf(book), 'c-math', d('2026-09-22'))!;
  const halfItem = { session: half, due: d('2026-09-23') };
  assert.deepEqual(homeworkCaptured(contextOf(book), halfItem), { notDone: 2, reliedOn: 1 });
  assert.equal(homeworkCaptured(contextOf(book), { ...item, due: d('2026-09-24') }), null);
});

test('a half’s homework is proposed from its own half’s session, not the other’s', async () => {
  const book = await openBook(bothHalves());
  const [set] = captureSessions(contextOf(book), 'c-math', d('2026-09-22'));
  const [own, other] = captureSessions(contextOf(book), 'c-math', d('2026-09-29'));
  assert.ok(set && own && other);
  assert.deepEqual([set.groupId, own.groupId, other.groupId], ['g-1', 'g-1', 'g-2']);
  const item = { session: set, due: d('2026-09-29') };
  await book.record(d('2026-09-29'), setCapture(other, 'p01', 'homework', 1));
  assert.equal(homeworkCaptured(contextOf(book), item), null);
  await book.record(d('2026-09-29'), setCapture(own, 'p01', 'homework', 2));
  assert.deepEqual(homeworkCaptured(contextOf(book), item), { notDone: 0, reliedOn: 1 });
});
