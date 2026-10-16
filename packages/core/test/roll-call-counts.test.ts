// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_COUNTING,
  awaitingBetween,
  confirmSessions,
  countRollCalls,
  rollCallUnits,
  takeRollCall,
  type Marks,
  type RecordBook,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook, primaryEvents } from './fixtures.ts';

async function takeAll(book: RecordBook, from: string, to: string, marks: Record<string, Marks> = {}): Promise<void> {
  const context = contextOf(book);
  for (const unit of rollCallUnits(context, 'k-5apb', d(from), d(to))) {
    const key = `${unit.day} ${unit.half}`;
    await book.record(unit.day, takeRollCall(contextOf(book), unit, marks[key] ?? { absent: [], late: [] }));
  }
}

describe('roll-call counts', () => {
  it('counts half-days: a whole day absent counts 2, and lateness is never an absence', async () => {
    const book = await openBook(primaryEvents());
    await takeAll(book, '2026-09-20', '2026-09-24', {
      '2026-09-20 morning': { absent: [{ pupilId: 'q01', justified: false }], late: [] },
      '2026-09-20 afternoon': { absent: [{ pupilId: 'q01', justified: false }], late: [] },
      '2026-09-21 morning': { absent: [], late: ['q02'] },
      '2026-09-23 morning': { absent: [{ pupilId: 'q03', justified: true }], late: [] },
    });
    const counts = countRollCalls(contextOf(book), 'k-5apb', d('2026-09-20'), d('2026-09-24'));
    assert.equal(counts.units, 7);
    assert.equal(counts.untaken, 0);
    const byPupil = new Map(counts.pupils.map((count) => [count.pupilId, count]));
    assert.deepEqual(
      [...byPupil.keys()],
      ['q01', 'q02', 'q03', 'q04', 'q06'],
      'q05 arrives later, and q06 leaves later',
    );
    const q01 = byPupil.get('q01');
    assert.equal(q01?.possible, 7);
    assert.equal(q01?.absent, 2);
    assert.equal(q01?.unjustified, 2);
    assert.equal(q01?.present, 5);
    assert.equal(q01?.rate, 5 / 7);
    assert.deepEqual(byPupil.get('q02')?.late, ['2026-09-21']);
    assert.equal(byPupil.get('q02')?.absent, 0);
    assert.equal(byPupil.get('q03')?.justified, 1);
  });

  it('leaves out roll calls not taken, unless the rules say otherwise', async () => {
    const book = await openBook(primaryEvents());
    await takeAll(book, '2026-09-20', '2026-09-23');
    const context = contextOf(book);
    const strict = countRollCalls(context, 'k-5apb', d('2026-09-20'), d('2026-09-24'));
    assert.equal(strict.units, 6);
    assert.equal(strict.untaken, 1);
    assert.equal(strict.pupils[0]?.possible, 6);
    const lenient = countRollCalls(context, 'k-5apb', d('2026-09-20'), d('2026-09-24'), {
      ...DEFAULT_COUNTING,
      untaken: 'present',
    });
    assert.equal(lenient.units, 7);
    assert.equal(lenient.pupils[0]?.possible, 7);
  });

  it('leaves out half-days whose sessions were not held', async () => {
    const book = await openBook(primaryEvents());
    await takeAll(book, '2026-09-20', '2026-09-21');
    await takeAll(book, '2026-09-23', '2026-09-24');
    const context = contextOf(book);
    const [tuesday] = awaitingBetween(context, d('2026-09-22'), d('2026-09-22'));
    assert.ok(tuesday);
    await book.recordAll(
      d('2026-09-22'),
      confirmSessions(context, [{ session: tuesday, choice: { outcome: 'not-held' } }]),
    );
    const counts = countRollCalls(contextOf(book), 'k-5apb', d('2026-09-20'), d('2026-09-24'));
    assert.equal(counts.units, 6);
    assert.equal(counts.untaken, 0);
    const counted = countRollCalls(contextOf(book), 'k-5apb', d('2026-09-20'), d('2026-09-24'), {
      ...DEFAULT_COUNTING,
      notHeld: 'counted',
    });
    assert.equal(counted.untaken, 1);
  });

  // Two pieces of late news: a closure added for a day whose roll call was
  // taken, and a session recorded as not held after its roll call was taken.
  it('counts every roll call taken, and lists those the rest of the record leaves out', async () => {
    const book = await openBook(cemEvents());
    const count = (): ReturnType<typeof countRollCalls> =>
      countRollCalls(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-24'));
    const [sunday, monday] = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-21'));
    assert.ok(sunday && monday);

    await book.record(
      d('2026-09-21'),
      takeRollCall(contextOf(book), monday, { absent: [{ pupilId: 'p01', justified: false }], late: [] }),
    );
    await book.record(d('2026-09-23'), {
      kind: 'calendar.set',
      entry: {
        id: 'late-closure',
        layer: 'school',
        schoolId: 's-cem',
        from: d('2026-09-21'),
        to: d('2026-09-21'),
        effect: 'closure',
        name: { en: 'Made-up closure' },
        source: 'school',
        confidence: 'announced',
      },
    });
    const closed = count();
    assert.deepEqual(closed.conflicts, [monday.key]);
    assert.equal(closed.untaken, 4);
    assert.deepEqual(closed.pupils.find((pupil) => pupil.pupilId === 'p01')?.absences, [
      { day: '2026-09-21', half: 'morning', justified: false },
    ]);

    const absent = ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08'].map((pupilId) => ({
      pupilId,
      justified: false,
    }));
    await book.record(d('2026-09-20'), takeRollCall(contextOf(book), sunday, { absent, late: [] }));
    const [session] = awaitingBetween(contextOf(book), d('2026-09-20'), d('2026-09-20'));
    assert.ok(session);
    await book.recordAll(
      d('2026-09-20'),
      confirmSessions(contextOf(book), [{ session, choice: { outcome: 'not-held' }, privateReason: 'few-pupils' }]),
    );
    const notHeld = count();
    assert.deepEqual(notHeld.conflicts, [sunday.key, monday.key]);
    assert.equal(notHeld.units, 2);
    assert.equal(notHeld.pupils.find((pupil) => pupil.pupilId === 'p08')?.absent, 1);
  });

  it('counts the roll calls taken before a change of roll-call unit', async () => {
    const book = await openBook(cemEvents());
    for (const unit of rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-24'))) {
      await book.record(
        unit.day,
        takeRollCall(contextOf(book), unit, { absent: [{ pupilId: 'p01', justified: false }], late: [] }),
      );
    }
    const schoolClass = book.state.classes.get('k-1am2');
    assert.ok(schoolClass);
    await book.record(d('2026-09-27'), {
      kind: 'class.set',
      schoolClass: { ...schoolClass, rollCallUnit: 'half-day' },
    });
    const counts = countRollCalls(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-24'));
    assert.equal(counts.pupils.find((pupil) => pupil.pupilId === 'p01')?.absent, 5);
    assert.equal(counts.conflicts.length, 5);
    assert.equal(counts.untaken, 5);
  });

  // A roll call taken on such a day counts whatever the rules say, and is
  // listed for the teacher to check.
  it("leaves out units on the teacher's own calendar days, unless the rules count them", async () => {
    const book = await openBook(cemEvents());
    await book.record(d('2026-09-13'), {
      kind: 'calendar.set',
      entry: {
        id: 'training',
        layer: 'teacher',
        from: d('2026-09-21'),
        to: d('2026-09-21'),
        effect: 'no-school',
        name: { en: 'Made-up training day' },
        source: 'teacher',
        confidence: 'announced',
      },
    });
    const units = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-24'));
    assert.equal(units.length, 5);
    const monday = units.find((unit) => unit.day === '2026-09-21');
    assert.ok(monday);
    for (const unit of units) {
      if (unit !== monday) await book.record(unit.day, takeRollCall(contextOf(book), unit, { absent: [], late: [] }));
    }
    const count = (rules = DEFAULT_COUNTING): ReturnType<typeof countRollCalls> =>
      countRollCalls(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-24'), rules);
    assert.equal(count().units, 4);
    assert.equal(count().untaken, 0);
    assert.equal(count({ ...DEFAULT_COUNTING, seminars: 'counted' }).untaken, 1);
    assert.equal(count({ ...DEFAULT_COUNTING, seminars: 'counted', untaken: 'present' }).units, 5);

    await book.record(d('2026-09-21'), takeRollCall(contextOf(book), monday, { absent: [], late: ['p03'] }));
    assert.equal(count().units, 5);
    assert.deepEqual(count().conflicts, [monday.key]);
    assert.deepEqual(count().pupils.find((pupil) => pupil.pupilId === 'p03')?.late, ['2026-09-21']);
  });
});
