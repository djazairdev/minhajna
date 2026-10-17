// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Exact, synthetic workload checks; these are not device performance tests.

import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import {
  current,
  eventOf,
  isDay,
  isWithin,
  makeContext,
  parsePlanPack,
  pupilsFor,
  rollCallUnits,
  sessionsBetween,
  type Context,
  type RecordBook,
} from '../src/index.ts';
import { makeDemoYear, type DemoYear } from '@minhajna/core/test-support/demo-year';
import { demoReference, reopenDemo } from './demo-year-support.ts';
import { deps } from './support.ts';

const expected = {
  cem: { events: 396, bytes: 260621, sessions: 161, units: 161, setup: 50, details: 16, tests: 5 },
  primary: { events: 554, bytes: 368469, sessions: 256, units: 225, setup: 49, details: 25, tests: 8 },
};

for (const level of ['cem', 'primary'] as const) {
  describe(`The full demo year: ${level}`, () => {
    let fixture: DemoYear;
    let book: RecordBook;
    let context: Context;
    before(async () => {
      fixture = await makeDemoYear(demoReference(), deps, level);
      book = await reopenDemo(fixture);
      context = makeContext(fixture.reference, book.state);
    });

    it('has a fixed event count and compact UTF-8 JSON byte count', () => {
      assert.equal(fixture.entries.length, expected[level].events);
      assert.equal(Buffer.byteLength(JSON.stringify(fixture.entries), 'utf8'), expected[level].bytes);
      assert.equal(book.state.sessions.size, expected[level].sessions);
      assert.equal(book.state.rollCalls.size, expected[level].units);
      const counts = (kind: string): number => fixture.entries.filter((entry) => entry.kind === kind).length;
      assert.equal(counts('session.recorded'), expected[level].sessions + 8);
      assert.equal(counts('roll-call.taken'), expected[level].units + 8);
      assert.equal(counts('session.noted'), 8);
      assert.equal(
        fixture.entries.length,
        expected[level].setup + expected[level].sessions + expected[level].units + 24,
      );
    });

    it('uses 45 synthetic identities, Arabic and Latin names, and both CEM groups', () => {
      const pupils = [...book.state.pupils.values()];
      assert.equal(pupils.length, 45);
      assert.equal(new Set(pupils.map((pupil) => pupil.id)).size, 45);
      assert.equal(new Set(pupils.map((pupil) => pupil.registration)).size, 45);
      assert.ok(pupils.every((pupil) => /[\u0600-\u06ff]/u.test(pupil.name) && pupil.latinName));
      assert.ok(new Set(pupils.map((pupil) => pupil.name)).size < pupils.length);
      if (level === 'cem') {
        assert.equal(pupils.filter((pupil) => pupil.groups.includes('g-1')).length, 23);
        assert.equal(pupils.filter((pupil) => pupil.groups.includes('g-2')).length, 22);
        assert.ok(pupils.some((pupil) => pupil.name.length > 30));
        assert.ok(pupils.some((pupil) => /[أإؤئء]/u.test(pupil.name)));
      }
    });

    it('confirms every teaching session, and none on a holiday or exam', () => {
      const { from, to } = fixture.reference.year;
      const sessions = sessionsBetween(context, from, to);
      const ordinary = sessions.filter((session) => session.calendar === null);
      assert.equal(ordinary.length, expected[level].sessions);
      assert.deepEqual(
        [...book.state.sessions.keys()],
        ordinary.map((session) => session.key),
      );
      assert.ok(sessions.some((session) => session.calendar === 'holiday'));
      assert.ok(sessions.some((session) => session.calendar === 'exam'));
      for (const session of ordinary) {
        const record = current(book.state.sessions.get(session.key));
        assert.equal(record?.outcome, 'done');
        assert.ok(record.coverage.length > 0);
      }
      for (const session of sessions.filter((session) => session.calendar !== null)) {
        assert.equal(book.state.sessions.has(session.key), false);
      }
      assert.equal(ordinary[0]?.day, '2026-09-21');
      assert.equal(ordinary.at(-1)?.day, '2027-07-08');
    });

    it('takes every required roll call with eligible, non-duplicated marks', () => {
      const { from, to } = fixture.reference.year;
      const units = rollCallUnits(context, fixture.classId, from, to);
      assert.deepEqual(
        [...book.state.rollCalls.keys()],
        units.map((unit) => unit.key),
      );
      assert.ok(units.every((unit) => unit.key.startsWith(level === 'cem' ? 'session:' : 'half-day:')));
      assert.equal(
        units.some((unit) => unit.sessions.length > 1),
        level === 'primary',
      );
      for (const unit of units) {
        const eligible = new Set(pupilsFor(context, unit).map((pupil) => pupil.id));
        for (const version of book.state.rollCalls.get(unit.key) ?? []) {
          const marked = [...version.value.absent.map((absence) => absence.pupilId), ...version.value.late];
          assert.ok(marked.every((id) => eligible.has(id)));
          assert.equal(new Set(marked).size, marked.length);
        }
      }
      const rollCalls = [...book.state.rollCalls.values()].map((versions) => current(versions));
      assert.ok(rollCalls.some((rollCall) => rollCall?.absent.some((absence) => absence.justified)));
      assert.ok(rollCalls.some((rollCall) => rollCall?.absent.some((absence) => !absence.justified)));
      assert.ok(rollCalls.some((rollCall) => rollCall !== null && rollCall.late.length > 0));
      assert.ok(rollCalls.some((rollCall) => rollCall?.absent.length === 0 && rollCall.late.length === 0));
    });

    it('keeps lesson details and separate private reasons for later-day corrections', () => {
      const sessions = [...book.state.sessions.values()];
      assert.equal(
        sessions.filter((versions) => versions[0]?.value.homework !== undefined).length,
        expected[level].details,
      );
      assert.equal(sessions.filter((versions) => versions[0]?.value.test !== undefined).length, expected[level].tests);
      const corrections = sessions.filter((versions) => versions.length === 2);
      assert.equal(corrections.length, 8);
      for (const versions of corrections) {
        const [original, corrected] = versions;
        assert.ok(original !== undefined && corrected !== undefined);
        assert.ok(corrected.day > original.day);
        assert.equal(original.day, original.value.session.day);
        assert.deepEqual(corrected.value.coverage, original.value.coverage);
        assert.equal(corrected.value.factual, 'Corrected invented lesson detail.');
        assert.equal('reason' in corrected.value, false);
        assert.equal(
          book.state.notes.get(corrected.value.session.key)?.reasonText,
          'Synthetic correction: detail reviewed.',
        );
      }
      const rollCorrections = [...book.state.rollCalls.values()].filter((versions) => versions.length === 2);
      assert.equal(rollCorrections.length, 8);
      for (const versions of rollCorrections) {
        const [original, corrected] = versions;
        assert.ok(original !== undefined && corrected !== undefined && corrected.day > original.day);
        assert.equal(corrected.reason, 'Synthetic correction: roll call reviewed.');
      }
      for (const entry of fixture.entries.filter((entry) => entry.kind === 'session.noted'))
        assert.equal(entry.layer, 'private');
    });

    it('keeps only dates inside the requested year and uses a valid example pack', () => {
      const { from, to } = fixture.reference.year;
      assert.equal(fixture.entries[0]?.day, from);
      assert.equal(fixture.entries.at(-1)?.day, to);
      for (const [index, entry] of fixture.entries.entries()) {
        assert.equal(isDay(entry.day) && isWithin(entry.day, from, to), true);
        assert.ok(index === 0 || entry.day >= (fixture.entries[index - 1]?.day ?? from));
        const event = eventOf(entry);
        if (event?.kind === 'session.recorded' && event.record.homework !== undefined) {
          assert.ok(isWithin(event.record.homework.due, from, to));
        }
      }
      assert.equal(fixture.reference.packs.size, 1);
      for (const pack of fixture.reference.packs.values()) {
        assert.equal(pack.status, 'example');
        assert.equal(parsePlanPack(pack).ok, true);
      }
    });
  });
}
