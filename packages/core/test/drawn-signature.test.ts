// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The drawn signature (#236, answer 411): strokes kept as whole points in
// the signature's box, with repeats left out, dots kept and no timing;
// anything else refused, also when a history holds it; the card's other
// fields kept when one changes; used only while turned on; and never sent
// with the record, only printed on the teacher's own documents.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isSignature,
  layerOf,
  mayTravelAs,
  OWN_ROUTES,
  personalWith,
  recordsForRoute,
  SIGNATURE_HEIGHT,
  SIGNATURE_MAX,
  SIGNATURE_WIDTH,
  signatureInUse,
  signatureOf,
  type Signature,
} from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';

const drawn: Signature = { width: SIGNATURE_WIDTH, height: SIGNATURE_HEIGHT, path: 'M 10 20 L 30 40 M 50 60 L 70 80' };

describe('The drawn signature', () => {
  it('keeps the strokes as whole points in its box, without repeats, and a dot as a line of no length', () => {
    const signature = signatureOf(
      [
        [
          { x: 0, y: 0 },
          { x: 10.4, y: 5.2 },
          { x: 10.4, y: 5.2 },
          { x: 400, y: 20 },
        ],
        [{ x: 150.6, y: 99.9 }],
      ],
      { width: 300, height: 100 },
    );
    assert.deepEqual(signature, { width: 600, height: 200, path: 'M 0 0 L 21 10 L 600 40 M 301 200 L 301 200' });
  });

  it('is nothing when nothing was drawn, the box has no size, or the path would be too long', () => {
    assert.equal(signatureOf([[{ x: 1, y: 1 }]], { width: 0, height: 0 }), null);
    assert.equal(signatureOf([[], []], { width: 300, height: 100 }), null);
    const long = Array.from({ length: SIGNATURE_MAX / 6 }, (_, index) => ({ x: index % 300, y: index % 100 }));
    assert.equal(signatureOf([long], { width: 300, height: 100 }), null);
  });

  it('refuses anything but moves and lines of whole points in the box', () => {
    assert.equal(isSignature(drawn), true);
    for (const path of ['', 'L 1 1', 'M 1 1 C 2 2', 'M 1.5 1', 'M 601 1', 'M 1 201', 'M 1 1 L 2', 'M -1 1']) {
      assert.equal(isSignature({ ...drawn, path }), false, path);
    }
    assert.equal(isSignature({ ...drawn, width: 300 }), false);
    assert.equal(isSignature({ ...drawn, times: [1, 2] }), false);
    assert.equal(isSignature({ ...drawn, path: `M 1 1${' L 2 2'.repeat(SIGNATURE_MAX / 6)}` }), false);
    assert.equal(isSignature(null), false);
  });

  it('keeps the card’s other fields when one changes', () => {
    const named = personalWith(null, { name: ' بن يحيى سعاد ' });
    assert.deepEqual(named, { name: 'بن يحيى سعاد' });
    const signed = personalWith(named, { signature: drawn });
    assert.deepEqual(signed, { name: 'بن يحيى سعاد', signature: drawn });
    const on = personalWith(signed, { signatureOn: true });
    assert.deepEqual(personalWith(on, { name: '' }), { signature: drawn, signatureOn: true });
    assert.deepEqual(personalWith(on, { signature: null }), { name: 'بن يحيى سعاد', signatureOn: true });
  });

  it('is used only while drawn and turned on', () => {
    assert.equal(signatureInUse(null), null);
    assert.equal(signatureInUse({ signature: drawn }), null);
    assert.equal(signatureInUse({ signatureOn: true }), null);
    assert.equal(signatureInUse({ signature: drawn, signatureOn: true }), drawn);
  });

  it('reads as no signature when the history holds something else', async () => {
    const book = await openBook(cemEvents());
    await book.record(d('2026-09-14'), {
      kind: 'teacher.personal.set',
      personal: { name: 'بن يحيى سعاد', signature: { ...drawn, path: 'M 1 1 C 2 2 3 3' }, signatureOn: true },
    });
    assert.deepEqual(book.state.personal, { name: 'بن يحيى سعاد', signatureOn: true });
    assert.equal(signatureInUse(book.state.personal), null);
  });

  it('keeps nothing but the name, the signature and the switch from a history', async () => {
    const book = await openBook(cemEvents());
    const personal = { signature: { ...drawn, speed: [3, 4] }, signatureOn: true, pressure: 1 };
    await book.record(d('2026-09-14'), { kind: 'teacher.personal.set', personal } as never);
    assert.deepEqual(book.state.personal, { signatureOn: true });
    await book.record(d('2026-09-14'), {
      kind: 'teacher.personal.set',
      personal: { name: 'بن يحيى سعاد', signature: drawn, pressure: 1 } as never,
    });
    assert.deepEqual(book.state.personal, { name: 'بن يحيى سعاد', signature: drawn });
  });

  it('never leaves the phone: only the teacher’s own documents take it', async () => {
    const book = await openBook(cemEvents());
    await book.record(d('2026-09-14'), {
      kind: 'teacher.personal.set',
      personal: { signature: drawn, signatureOn: true },
    });
    const carries = (route: Parameters<typeof recordsForRoute>[1]) =>
      recordsForRoute(book.state, route).some((record) => record.kind === 'teacher.personal.set');
    assert.equal(carries('documents'), true);
    for (const route of ['statement', 'handover', 'handover-direct', 'school-space'] as const)
      assert.equal(carries(route), false, route);
    const event = { kind: 'teacher.personal.set', personal: { signature: drawn } } as const;
    for (const route of OWN_ROUTES) assert.equal(mayTravelAs(layerOf(event), event.kind, route), false, route);
  });
});
