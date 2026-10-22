// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_COUNTING,
  countMonth,
  isEnrolled,
  pupilsFor,
  rollCallUnits,
  takeRollCall,
  unitKind,
  type Context,
  type RecordEvent,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook, primaryEvents } from './fixtures.ts';

/** The director's confirmation that q06 left on 14 October, as the teacher records it. */
const Q06_LEFT: RecordEvent = {
  kind: 'pupil.moved',
  pupilId: 'q06',
  movement: { day: d('2026-10-14'), kind: 'out', reason: 'Transfer', confirmed: true },
};

describe('roll call', () => {
  it('takes CEM roll call per session, and a TD session covers only its half-group', async () => {
    const context = contextOf(await openBook(cemEvents()));
    const units = rollCallUnits(context, 'k-1am2', d('2026-09-20'), d('2026-09-24'));
    assert.equal(units.length, 5);
    const td = units.find((unit) => unit.day === '2026-09-22');
    assert.ok(td);
    assert.equal(td.groupId, 'g-1');
    assert.deepEqual(
      pupilsFor(context, td).map((pupil) => pupil.id),
      ['p01', 'p02', 'p03', 'p04', 'p05'],
    );
  });

  it('takes primary roll call per half-day', async () => {
    const context = contextOf(await openBook(primaryEvents()));
    const units = rollCallUnits(context, 'k-5apb', d('2026-09-20'), d('2026-09-20'));
    assert.deepEqual(
      units.map((unit) => `${unit.half} ${unit.sessions.length}`),
      ['morning 2', 'afternoon 1'],
    );
  });

  it('calls a primary specialist’s class per session, unless the other kind is on record', async () => {
    const asSpecialist = (context: Context): Context => {
      const { country } = context.ref;
      const subjects = country.subjects.map((one) =>
        one.code === 'language' ? { ...one, specialist: ['primary'] } : one,
      );
      return { ...context, ref: { ...context.ref, country: { ...country, subjects } } };
    };
    const context = asSpecialist(contextOf(await openBook(primaryEvents())));
    const units = rollCallUnits(context, 'k-5apb', d('2026-09-20'), d('2026-09-20'));
    assert.deepEqual(
      units.map((unit) => `${unit.half} ${unit.sessions.length}`),
      ['morning 1', 'morning 1', 'afternoon 1'],
    );
    const maths: RecordEvent = {
      kind: 'course.set',
      course: { id: 'c-maths', classId: 'k-5apb', subject: 'math', year: '2026-2027', pack: null },
    };
    const both = asSpecialist(contextOf(await openBook([...primaryEvents(), maths])));
    assert.equal(unitKind(both, both.state.classes.get('k-5apb')!), 'half-day');
    const book = await openBook(primaryEvents());
    const [halfDay] = rollCallUnits(contextOf(book), 'k-5apb', d('2026-09-20'), d('2026-09-20'));
    assert.ok(halfDay);
    await book.record(d('2026-09-20'), takeRollCall(contextOf(book), halfDay, { absent: [], late: [] }));
    const kept = asSpecialist(contextOf(book));
    assert.equal(unitKind(kept, kept.state.classes.get('k-5apb')!), 'half-day');
    const called = await openBook(primaryEvents());
    const [one] = rollCallUnits(asSpecialist(contextOf(called)), 'k-5apb', d('2026-09-20'), d('2026-09-20'));
    assert.ok(one);
    await called.record(d('2026-09-20'), takeRollCall(asSpecialist(contextOf(called)), one, { absent: [], late: [] }));
    await called.record(d('2026-09-21'), maths);
    const still = asSpecialist(contextOf(called));
    assert.equal(unitKind(still, still.state.classes.get('k-5apb')!), 'session');
    assert.ok(rollCallUnits(still, 'k-5apb', d('2026-09-20'), d('2026-09-20')).some((unit) => unit.key === one.key));
  });

  it('needs a reason to correct a roll call, and keeps every version', async () => {
    const book = await openBook(cemEvents());
    const [unit] = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-20'));
    assert.ok(unit);
    await book.record(
      d('2026-09-20'),
      takeRollCall(contextOf(book), unit, { absent: [{ pupilId: 'p01', justified: false }], late: ['p02'] }),
    );
    const correction = { absent: [{ pupilId: 'p01', justified: true }], late: ['p02'] };
    assert.throws(() => takeRollCall(contextOf(book), unit, correction), /needs a reason/);
    await book.record(d('2026-09-23'), takeRollCall(contextOf(book), unit, correction, 'Justification brought in'));
    const versions = book.state.rollCalls.get(unit.key);
    assert.equal(versions?.length, 2);
    assert.equal(versions?.[1]?.reason, 'Justification brought in');
    assert.equal(versions?.[1]?.value.absent[0]?.justified, true);
  });

  it('refuses marks for pupils outside the roll call, or marked twice', async () => {
    const context = contextOf(await openBook(cemEvents()));
    const td = rollCallUnits(context, 'k-1am2', d('2026-09-22'), d('2026-09-22'))[0];
    assert.ok(td);
    assert.throws(
      () => takeRollCall(context, td, { absent: [{ pupilId: 'p06', justified: false }], late: [] }),
      /not on this roll call/,
    );
    assert.throws(
      () => takeRollCall(context, td, { absent: [{ pupilId: 'p01', justified: false }], late: ['p01'] }),
      /twice/,
    );
  });

  it("keeps a pupil who left on the list until the director's confirmation is recorded", async () => {
    const book = await openBook(primaryEvents());
    const [unit] = rollCallUnits(contextOf(book), 'k-5apb', d('2026-10-15'), d('2026-10-15'));
    assert.ok(unit);
    assert.equal(
      pupilsFor(contextOf(book), unit).some((pupil) => pupil.id === 'q06'),
      true,
    );
    const marked = takeRollCall(contextOf(book), unit, { absent: [{ pupilId: 'q06', justified: false }], late: [] });
    assert.equal(marked.kind, 'roll-call.taken');

    await book.record(d('2026-10-20'), Q06_LEFT);
    const left = book.state.pupils.get('q06');
    assert.ok(left);
    assert.equal(left.movements.length, 1, 'the confirmation replaces the movement it confirms');
    assert.equal(isEnrolled(left, d('2026-10-13')), true);
    assert.equal(isEnrolled(left, d('2026-10-14')), false);
    assert.equal(
      pupilsFor(contextOf(book), unit).some((pupil) => pupil.id === 'q06'),
      false,
    );
  });

  // The pupil's name is fixed later, by a pupil record that holds only a
  // later return.
  it('keeps movements recorded on their own when the pupil is set again', async () => {
    const book = await openBook(primaryEvents());
    const out = { day: d('2026-10-20'), kind: 'out', reason: 'Transfer', confirmed: true } as const;
    await book.record(d('2026-10-20'), { kind: 'pupil.moved', pupilId: 'q01', movement: out });
    await book.record(d('2026-10-21'), { kind: 'pupil.moved', pupilId: 'q01', movement: out });
    const q01 = book.state.pupils.get('q01');
    assert.ok(q01);
    const back = { day: d('2026-10-27'), kind: 'in', reason: 'Back' } as const;
    await book.record(d('2026-10-22'), {
      kind: 'pupil.set',
      pupil: { ...q01, latinName: 'Selma Haddad', movements: [back] },
    });
    const fixed = book.state.pupils.get('q01');
    assert.ok(fixed);
    assert.equal(fixed.latinName, 'Selma Haddad');
    assert.deepEqual(fixed.movements, [out, back]);
    assert.equal(isEnrolled(fixed, d('2026-10-25')), false);
    assert.equal(isEnrolled(fixed, d('2026-10-27')), true);
  });

  it('follows pupils who arrive or leave during the month', async () => {
    const book = await openBook(primaryEvents());
    await book.record(d('2026-10-20'), Q06_LEFT);
    const context = contextOf(book);
    const arriving = book.state.pupils.get('q05');
    const leaving = book.state.pupils.get('q06');
    assert.ok(arriving && leaving);
    assert.equal(isEnrolled(arriving, d('2026-10-10')), false);
    assert.equal(isEnrolled(arriving, d('2026-10-11')), true);
    assert.equal(isEnrolled(leaving, d('2026-10-13')), true);
    assert.equal(isEnrolled(leaving, d('2026-10-14')), false);

    const october = countMonth(context, 'k-5apb', '2026-10', { ...DEFAULT_COUNTING, untaken: 'present' });
    assert.equal(october.units, 28);
    const possible = new Map(october.pupils.map((count) => [count.pupilId, count.possible]));
    assert.equal(possible.get('q01'), 28);
    assert.equal(possible.get('q05'), 20);
    assert.equal(possible.get('q06'), 13);
  });
});
