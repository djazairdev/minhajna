// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reopening, isolation and portability of the shared load fixture.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as core from '../src/index.ts';
import { makeDemoYear } from '@minhajna/core/test-support/demo-year';
import { demoReference, reopenDemo } from './demo-year-support.ts';
import { deps } from './support.ts';

describe('Reusing the full-year load fixture', () => {
  it('reopens a verified history for each level and can append a new correction', async () => {
    for (const level of ['cem', 'primary'] as const) {
      const fixture = await makeDemoYear(demoReference(), deps, level);
      assert.deepEqual(await core.verifyHistory(deps.digest, fixture.entries), []);
      const book = await reopenDemo(fixture);
      assert.deepEqual(book.entries, fixture.entries);
      const context = core.makeContext(fixture.reference, book.state);
      const today = core.todayView(context, fixture.reference.year.to);
      assert.equal(today.awaitingEarlier, 0);
      assert.ok(today.sessions.length > 0);
      assert.ok(today.sessions.every((item) => item.status === 'recorded' && !item.packMissing));
      const session = today.sessions[0]?.session;
      assert.ok(session !== undefined);
      await book.recordAll(
        fixture.reference.year.to,
        core.confirmSessions(context, [
          {
            session,
            details: { factual: 'Another synthetic correction after reopen.' },
            reason: 'Test append.',
          },
        ]),
      );
      assert.equal(book.entries.length, fixture.entries.length + 2);
      assert.deepEqual(await core.verifyHistory(deps.digest, book.entries), []);
      assert.equal(fixture.entries.length, level === 'cem' ? 396 : 554);
    }
  });

  it('generates fresh histories with repeatable payloads and sizes without mutating the reference', async () => {
    const reference = demoReference();
    const first = await makeDemoYear(reference, deps);
    const second = await makeDemoYear(reference, deps);
    assert.equal(reference.packs.size, 0);
    assert.equal(reference.year.from, '2026-09-21');
    assert.notStrictEqual(first.entries, second.entries);
    assert.notStrictEqual(first.entries[0], second.entries[0]);
    assert.notEqual(first.entries[0]?.id, second.entries[0]?.id);
    assert.deepEqual(first.entries.map(core.eventOf), second.entries.map(core.eventOf));
    assert.equal(Buffer.byteLength(JSON.stringify(first.entries)), Buffer.byteLength(JSON.stringify(second.entries)));
    assert.deepEqual(first.reference.packs, second.reference.packs);
  });

  it('honours an additional synthetic school closure rather than filling it with records', async () => {
    const reference = demoReference();
    const day = core.parseDay('2026-09-22');
    const fixture = await makeDemoYear(
      {
        ...reference,
        calendar: [
          ...reference.calendar,
          {
            id: 'demo-closure',
            layer: 'school',
            schoolId: 's-cem',
            from: day,
            to: day,
            effect: 'closure',
            name: { en: 'Synthetic closure' },
            source: 'Invented for tests',
            confidence: 'announced',
          },
        ],
      },
      deps,
    );
    const book = await reopenDemo(fixture);
    assert.ok([...book.state.sessions.values()].every((versions) => versions[0]?.value.session.day !== day));
    assert.ok([...book.state.rollCalls.values()].every((versions) => versions[0]?.value.day !== day));
  });

  it('rejects the shorter unit-test calendar instead of silently making less than a year', async () => {
    const reference = demoReference();
    await assert.rejects(
      makeDemoYear({ ...reference, year: { ...reference.year, to: core.parseDay('2027-06-10') } }, deps),
      RangeError,
    );
  });

  it('does not export the generator through the production core entry', () => {
    assert.equal('makeDemoYear' in core, false);
    assert.equal('demoSetup' in core, false);
  });
});
