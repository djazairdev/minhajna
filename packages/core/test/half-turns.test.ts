// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Half-groups taking a main-plan lesson in turn (#231, R-4.7-15, answer
// 387): a pair counts once in the class's expected position and in the term
// check, on the day the second half has it, whatever activity each half has
// and with whole-class sessions between; a half alone in the main plan, even
// beside TD halves, counts each session; TD keeps counting each half's
// session; a rotation keeps its own rule. Made-up classes only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  awaitingBetween,
  confirmSessions,
  halfTurns,
  pace,
  rotationCredits,
  sessionsBetween,
  termCheck,
  type RecordEvent,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';
import { rotatingBook, rotation } from './rotation-fixtures.ts';

/**
 * The class's Tuesday TD, taken by each half in turn, made a lesson; `only` keeps the first half alone, and `apart`
 * gives each half its own activity.
 */
function labEvents(only = false, apart = false): RecordEvent[] {
  return cemEvents().map((event) =>
    event.kind === 'timetable.set'
      ? {
          ...event,
          version: {
            ...event.version,
            entries: event.version.entries
              .filter((entry) => !only || entry.id !== 'e-tue-2')
              .map((entry) =>
                entry.id.startsWith('e-tue')
                  ? { ...entry, sessionType: 'lesson', ...(apart && { activity: entry.id.endsWith('1') ? 'a' : 'b' }) }
                  : entry,
              ),
          },
        }
      : event,
  );
}

const from = d('2026-09-20');

describe('half-groups in turn', () => {
  it('counts a pair of half-group lessons once, and a lone half’s lessons each', async () => {
    const lab = contextOf(await openBook(labEvents()));
    const halves = sessionsBetween(lab, from, d('2026-11-26')).filter(
      (one) => one.groupId !== 'g-all' && one.calendar === null,
    );
    assert.ok(halves.length >= 4);
    assert.equal(rotationCredits(halves, halfTurns(lab)), Math.floor(halves.length / 2));
    assert.equal(rotationCredits(halves), halves.length);

    const base = termCheck(contextOf(await openBook(cemEvents())), 'c-math', from)!;
    const check = termCheck(lab, 'c-math', from)!;
    const pairs = sessionsBetween(lab, from, check.before).filter(
      (one) => one.groupId !== 'g-all' && one.calendar === null && one.day < check.before,
    ).length;
    assert.equal(check.gives - base.gives, Math.floor(pairs / 2));
    assert.equal(check.td.gives, 0);

    const alone = contextOf(await openBook(labEvents(true)));
    const lone = sessionsBetween(alone, from, d('2026-11-26')).filter(
      (one) => one.groupId === 'g-1' && one.calendar === null,
    );
    assert.equal(rotationCredits(lone, halfTurns(alone)), lone.length);
  });

  it('places the class once both halves have had the lesson', async () => {
    const book = await openBook(labEvents());
    const first = contextOf(book);
    const day = d('2026-10-01');
    const sessions = awaitingBetween(first, from, day);
    await book.recordAll(
      day,
      confirmSessions(
        first,
        sessions.map((session) => ({ session, choice: { outcome: 'done' } })),
      ),
    );
    const context = contextOf(book);
    const whole = sessions.filter((one) => one.groupId === 'g-all').length;
    const halves = sessions.filter((one) => one.groupId !== 'g-all').length;
    assert.equal(halves, 2);
    assert.equal(pace(context, 'c-math', day)!.expected, whole + 1);
  });

  it('pairs halves whatever their activities, and keeps a rotation’s rule', async () => {
    const apart = contextOf(await openBook(labEvents(false, true)));
    const halves = sessionsBetween(apart, from, d('2026-11-26')).filter(
      (one) => one.groupId !== 'g-all' && one.calendar === null,
    );
    assert.ok(halves.length >= 4);
    assert.equal(rotationCredits(halves, halfTurns(apart)), Math.floor(halves.length / 2));

    const rotating = contextOf(await rotatingBook());
    const lessons = sessionsBetween(rotating, rotation.from, rotation.to).filter((one) => one.sessionType === 'lesson');
    assert.equal(rotationCredits(lessons, halfTurns(rotating)), rotationCredits(lessons));
  });

  it('counts a half alone in the main plan each time, even beside TD halves', async () => {
    const events = cemEvents().map((event) =>
      event.kind === 'timetable.set'
        ? {
            ...event,
            version: {
              ...event.version,
              entries: [
                ...event.version.entries,
                {
                  ...event.version.entries[0]!,
                  id: 'e-sat-1',
                  weekday: 3 as const,
                  groupId: 'g-1',
                  slot: { half: 'afternoon' as const, index: 2 },
                },
              ],
            },
          }
        : event,
    );
    const context = contextOf(await openBook(events));
    const lone = sessionsBetween(context, from, d('2026-11-26')).filter(
      (one) => one.groupId === 'g-1' && one.sessionType === 'lesson' && one.calendar === null,
    );
    assert.ok(lone.length >= 4);
    assert.equal(rotationCredits(lone, halfTurns(context)), lone.length);
  });
});
