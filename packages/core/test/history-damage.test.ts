// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a history changed outside the app shows (#235, answer 427): nothing
// for an intact one; for a broken one, the last day that checks, the first
// that cannot, never before the last that checks, the changes past it
// counted by kind, each version once, and the log trusted up to the break,
// an erasure before it included, every later change unchecked, with no
// content from past it. Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  confirmSessions,
  historyDamage,
  inspectHistory,
  rollCallUnits,
  sessionsBetween,
  takeRollCall,
  type Entry,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';
import { deps } from './support.ts';

/** A class's setup, a session confirmed and corrected, then a roll call and a private note on later days. */
async function sample(): Promise<Entry[]> {
  const book = await openBook(cemEvents());
  const [session] = sessionsBetween(contextOf(book), d('2026-09-30'), d('2026-09-30'), new Set(['c-math']));
  assert.ok(session);
  const [event] = confirmSessions(contextOf(book), [{ session, details: {} }]);
  assert.ok(event?.kind === 'session.recorded');
  await book.record(d('2026-09-30'), event);
  await book.record(d('2026-10-01'), { kind: 'session.recorded', record: { ...event.record, outcome: 'partial' } });
  const [unit] = rollCallUnits(contextOf(book), 'k-1am2', d('2026-10-01'), d('2026-10-01'));
  assert.ok(unit);
  await book.record(d('2026-10-02'), takeRollCall(contextOf(book), unit, { absent: [], late: ['p01'] }));
  await book.record(d('2026-10-03'), {
    kind: 'session.noted',
    note: { sessionKey: session.key, note: 'Made-up private note' },
  });
  return [...book.entries];
}

test('an intact history shows no damage', async () => {
  assert.equal(historyDamage(await inspectHistory(deps.digest, await sample())), null);
});

test('a changed body breaks the chain there: the days, the counts by kind, and the log up to it', async () => {
  const entries = await sample();
  const at = entries.findIndex((one) => one.kind === 'session.recorded' && one.day === '2026-10-01');
  const changed = entries.map((one, index) =>
    index === at && one.content !== null
      ? { ...one, content: { ...one.content, body: { ...(one.content.body as object), made: 'up' } } }
      : one,
  );
  const damage = historyDamage(await inspectHistory(deps.digest, changed));
  assert.ok(damage);
  assert.equal(damage.trustedThrough, '2026-09-30');
  assert.equal(damage.uncheckedFrom, '2026-10-01');
  assert.deepEqual(damage.counts, { 'texts-book': 1, 'roll-call': 1, notes: 1, other: 0 });
  assert.deepEqual(
    damage.log.flatMap((day) => day.items.map((item) => [item.day, item.category, item.line])),
    [
      ['2026-10-03', null, { kind: 'unverified', entryKind: 'session.noted' }],
      ['2026-10-02', null, { kind: 'unverified', entryKind: 'roll-call.taken' }],
      ['2026-10-01', null, { kind: 'unverified', entryKind: 'session.recorded' }],
    ],
  );
  assert.doesNotMatch(JSON.stringify(damage), /Made-up private note|partial|p01/);
});

test('a row removed from the start leaves nothing trusted, and an unreadable row counts as other', async () => {
  const entries = await sample();
  const damage = historyDamage(await inspectHistory(deps.digest, [{ broken: true }, ...entries.slice(1)]));
  assert.ok(damage);
  assert.equal(damage.trustedThrough, null);
  assert.equal(damage.uncheckedFrom, entries[1]?.day);
  assert.equal(damage.counts.other, entries.length - 4);
  assert.equal(
    damage.log.every((day) => day.items.every((item) => item.line.kind === 'unverified')),
    true,
  );
});

test('a header moved before the last day that checks never puts the first unchecked day before it', async () => {
  const entries = await sample();
  const at = entries.findIndex((one) => one.kind === 'roll-call.taken');
  const moved = entries.map((one, index) => (index === at ? { ...one, day: d('2026-09-01') } : one));
  const damage = historyDamage(await inspectHistory(deps.digest, moved));
  assert.ok(damage);
  assert.equal(damage.trustedThrough, '2026-10-01');
  assert.equal(damage.uncheckedFrom, '2026-10-01');
});

test('each version past the break counts, and an erasure before it stays in the trusted log', async () => {
  const book = await openBook(cemEvents());
  const [session] = sessionsBetween(contextOf(book), d('2026-09-30'), d('2026-09-30'), new Set(['c-math']));
  assert.ok(session);
  const note = await book.record(d('2026-09-29'), {
    kind: 'session.noted',
    note: { sessionKey: session.key, note: 'Made-up private note' },
  });
  await book.erase(d('2026-09-29'), [note.id]);
  const [event] = confirmSessions(contextOf(book), [{ session, details: {} }]);
  assert.ok(event?.kind === 'session.recorded');
  await book.record(d('2026-09-30'), event);
  await book.record(d('2026-10-01'), { kind: 'session.recorded', record: { ...event.record, outcome: 'partial' } });
  const at = book.entries.findIndex((one) => one.kind === 'session.recorded');
  const changed = book.entries.map((one, index) =>
    index === at && one.content !== null
      ? { ...one, content: { ...one.content, body: { ...(one.content.body as object), made: 'up' } } }
      : one,
  );
  const damage = historyDamage(await inspectHistory(deps.digest, changed));
  assert.ok(damage);
  assert.deepEqual(damage.counts, { 'texts-book': 2, 'roll-call': 0, notes: 0, other: 0 });
  assert.deepEqual(
    damage.log.flatMap((day) => day.items.map((item) => [item.day, item.line.kind])),
    [
      ['2026-10-01', 'unverified'],
      ['2026-09-30', 'unverified'],
      ['2026-09-29', 'erased'],
    ],
  );
});
