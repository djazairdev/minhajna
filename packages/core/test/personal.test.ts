// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher card's personal fields never leave the device: no sync to the
// teacher's other devices, no export, no route to anyone else. Only the
// documents made on the device print them (#26, PRD §3.2, §5.6).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { forRoute, layerOf, mayTravel, OWN_ROUTES, recordsForRoute, ROUTES, type OutboundRoute } from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';

const NAME = 'A made-up teacher name that must never leave the device';

describe("the teacher card's personal fields", () => {
  it('are in the device layer, which only the documents take', () => {
    assert.equal(layerOf({ kind: 'teacher.personal.set', personal: { name: NAME } }), 'device');
    assert.deepEqual(
      ROUTES.filter((route) => mayTravel('device', route)),
      ['documents'],
    );
  });

  it('reach no route out of the device, and stay off the teacher’s own sync and export', async () => {
    const book = await openBook(cemEvents());
    await book.record(d('2026-09-20'), { kind: 'teacher.personal.set', personal: { name: NAME } });
    assert.deepEqual(book.state.personal, { name: NAME });
    for (const route of OWN_ROUTES) assert.doesNotMatch(JSON.stringify(forRoute(book.entries, route)), /must never/);
    const outbound = ROUTES.filter(
      (route): route is OutboundRoute => !(OWN_ROUTES as readonly string[]).includes(route),
    );
    for (const route of outbound) {
      const text = JSON.stringify(recordsForRoute(book.state, route));
      if (route === 'documents') assert.match(text, /must never/, route);
      else assert.doesNotMatch(text, /must never/, route);
    }
  });

  it('keep the printed card apart, which travels like the lesson record', async () => {
    const book = await openBook(cemEvents());
    assert.deepEqual(book.state.teacher, { rank: 'Example rank' });
    assert.equal(layerOf({ kind: 'teacher.set', card: { rank: 'Example rank' } }), 'lesson-record');
    assert.match(JSON.stringify(recordsForRoute(book.state, 'school-space')), /Example rank/);
  });
});
