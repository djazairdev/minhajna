// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LAYERS,
  ROUTES,
  awaitingBetween,
  confirmSessions,
  forRoute,
  layerOf,
  mayTravel,
  mayTravelAs,
  recordsForRoute,
  rollCallUnits,
  takeRollCall,
  type OutboundRoute,
  type OwnRoute,
  type Route,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const PRIVATE_NOTE = 'A made-up private note that must never leave the device';

const OUTBOUND: readonly OutboundRoute[] = [
  'seating-plan-printout',
  'documents',
  'statement',
  'handover',
  'handover-direct',
  'school-space',
];

describe('record layers', () => {
  it('lets the private layer reach only the teacher, and a seating plan its printout', () => {
    const allowed = ROUTES.filter((route) => mayTravel('private', route));
    assert.deepEqual(allowed, ['own-devices', 'full-export']);
    assert.equal(mayTravelAs('private', 'seating.set', 'seating-plan-printout'), true);
    for (const kind of ['session.noted', 'calendar.set']) {
      assert.equal(mayTravelAs('private', kind, 'seating-plan-printout'), false, kind);
    }
  });

  it('keeps pupil records out of statements and handovers without pupils', () => {
    for (const route of ['statement', 'handover'] satisfies Route[]) {
      assert.equal(mayTravel('pupil-records', route), false, route);
    }
    assert.equal(mayTravel('pupil-records', 'handover-direct'), true);
  });

  it('has no route to insights or totals, which carry only figures formed later', () => {
    assert.deepEqual(
      ROUTES.filter((route) => mayTravel('totals', route)),
      [],
    );
    for (const name of ['insights', 'totals']) {
      assert.equal(
        ROUTES.some((route) => route === name),
        false,
        name,
      );
      for (const layer of LAYERS) assert.equal(mayTravel(layer, name as Route), false, `${layer} to ${name}`);
    }
  });

  it('gives every event its layer', () => {
    assert.equal(layerOf({ kind: 'session.noted', note: { sessionKey: 'k', note: 'n' } }), 'private');
    assert.equal(
      layerOf({ kind: 'seating.set', plan: { classId: 'k', groupId: 'g', rows: 1, columns: 1, seats: [] } }),
      'private',
    );
    const base = {
      id: 'x',
      from: d('2026-11-02'),
      to: d('2026-11-02'),
      effect: 'marker',
      name: {},
      source: '',
      confidence: 'announced',
    } as const;
    assert.equal(layerOf({ kind: 'calendar.set', entry: { ...base, layer: 'teacher' } }), 'private');
    assert.equal(
      layerOf({ kind: 'calendar.set', entry: { ...base, layer: 'school', schoolId: 's' } }),
      'lesson-record',
    );
  });

  it('never lets a private note reach a statement', async () => {
    const book = await openBook(cemEvents());
    const context = contextOf(book);
    const [session] = awaitingBetween(context, d('2026-09-20'), d('2026-09-20'));
    assert.ok(session);
    await book.recordAll(
      d('2026-09-20'),
      confirmSessions(context, [
        { session, choice: { outcome: 'not-held' }, privateReason: 'teacher-absent', privateNote: PRIVATE_NOTE },
      ]),
    );

    assert.match(JSON.stringify(forRoute(book.entries, 'own-devices')), /must never leave/);
    for (const route of OUTBOUND) {
      const travelling = JSON.stringify(recordsForRoute(book.state, route));
      assert.doesNotMatch(travelling, /must never leave/, route);
      assert.doesNotMatch(travelling, /teacher-absent/, route);
    }
    const statement = recordsForRoute(book.state, 'statement');
    assert.ok(statement.some((record) => record.kind === 'session.recorded'));
  });

  it('takes only the seating plan, the pupils and their class on the printout', async () => {
    const book = await openBook(cemEvents());
    const [session] = awaitingBetween(contextOf(book), d('2026-09-20'), d('2026-09-20'));
    const [unit] = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-20'));
    assert.ok(session && unit);
    await book.recordAll(d('2026-09-20'), [
      ...confirmSessions(contextOf(book), [{ session, choice: { outcome: 'not-held' }, privateNote: PRIVATE_NOTE }]),
      takeRollCall(contextOf(book), unit, { absent: [{ pupilId: 'p01', justified: false }], late: ['p02'] }),
      {
        kind: 'pupil.moved',
        pupilId: 'p02',
        movement: { day: d('2026-09-20'), kind: 'out', reason: 'Transfer', confirmed: true },
      },
      {
        kind: 'calendar.set',
        entry: {
          id: 'own',
          layer: 'teacher',
          from: d('2026-10-04'),
          to: d('2026-10-04'),
          effect: 'marker',
          name: { en: 'Made-up private meeting' },
          source: 'teacher',
          confidence: 'announced',
        },
      },
      {
        kind: 'seating.set',
        plan: {
          classId: 'k-1am2',
          groupId: 'g-all',
          rows: 1,
          columns: 2,
          seats: [{ row: 1, column: 1, pupilId: 'p01' }],
        },
      },
    ]);

    const printout = recordsForRoute(book.state, 'seating-plan-printout');
    assert.deepEqual([...new Set(printout.map((record) => record.kind))], ['class.set', 'pupil.set', 'seating.set']);
    assert.equal(mayTravel('pupil-records', 'seating-plan-printout'), false);
    assert.doesNotMatch(JSON.stringify(printout), /must never leave|private meeting/);
  });

  // Tuesday is confirmed a month late, and nobody it is sent to can tell.
  // The teacher's own routes keep the whole history, and only they take
  // entries.
  it('sends records, never history entries, on every route that leaves the teacher', async () => {
    const book = await openBook(cemEvents());
    const [sunday, monday, tuesday, wednesday] = awaitingBetween(contextOf(book), d('2026-09-20'), d('2026-09-23'));
    assert.ok(sunday && monday && tuesday && wednesday);
    await book.recordAll(
      d('2026-09-20'),
      confirmSessions(contextOf(book), [{ session: sunday, privateNote: PRIVATE_NOTE }]),
    );
    await book.recordAll(d('2026-09-21'), confirmSessions(contextOf(book), [{ session: monday }]));
    await book.recordAll(d('2026-09-23'), confirmSessions(contextOf(book), [{ session: wednesday }]));
    await book.recordAll(d('2026-10-22'), confirmSessions(contextOf(book), [{ session: tuesday }]));

    for (const route of OUTBOUND) {
      const records = recordsForRoute(book.state, route);
      const text = JSON.stringify(records);
      assert.doesNotMatch(text, /2026-10-22/, route);
      assert.doesNotMatch(text, /"(seq|hash|previous|digest|salt)"/, route);
      for (const record of records) assert.equal('id' in record || 'day' in record, false, route);
    }
    const days = recordsForRoute(book.state, 'school-space').flatMap((record) =>
      record.kind === 'session.recorded' ? [record.record.session.day] : [],
    );
    assert.deepEqual(days, ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23']);

    assert.deepEqual(
      forRoute(book.entries, 'full-export'),
      book.entries.filter((entry) => entry.layer !== 'device'),
    );
    const outbound: Route = 'school-space';
    assert.throws(() => forRoute(book.entries, outbound as OwnRoute), /own routes/);
  });
});
