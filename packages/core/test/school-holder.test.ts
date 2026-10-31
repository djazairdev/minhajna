// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A new device waiting to hold the school key (#571, answer 600): its wait is
// kept in the world's store until it holds a school's key or gives up, read
// only as it made it, a later one starting again, and never leaves the device,
// by any route or in an export. Every school and device is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  archiveOf,
  archiveText,
  keptWaiting,
  mayTravelAs,
  newHolderSecret,
  newId,
  readSchoolWaiting,
  recordKey,
  ROUTES,
  startKeyring,
  type ArchiveOptions,
} from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';
import { device, random, SCHOOL } from './school-devices.ts';

const PKCS8 = 'TWFkZS11cCBwcml2YXRlIGhhbGYgb2YgYW4gYWdyZWVtZW50IGtleQ==';
const options: ArchiveOptions = {
  made: d('2026-10-24'),
  app: '0.7.0',
  country: 'dz',
  calendarRelease: '2026.1',
  privateNotes: true,
  bundledPacks: [],
};

describe('a device waiting to hold the school key', () => {
  it('keeps its wait until it holds a key or gives up, and never lets it leave', async () => {
    const one = await device();
    const waiting = {
      device: one.holder.id,
      publicKey: one.holder.publicKey,
      pkcs8: PKCS8,
      secret: newHolderSecret(random),
    };
    assert.deepEqual(readSchoolWaiting(waiting, 32), waiting);
    for (const wrong of [
      { ...waiting, secret: 'short' },
      { ...waiting, publicKey: 'ab' },
      { ...waiting, pkcs8: 'not base64!' },
      { ...waiting, device: 'not-an-id' },
      { ...waiting, extra: 1 },
      null,
    ]) {
      assert.equal(readSchoolWaiting(wrong, 32), null);
    }
    assert.deepEqual(
      ROUTES.filter((route) => mayTravelAs('device', 'school.waiting', route)),
      [],
    );
    assert.equal(recordKey({ kind: 'school.waiting', waiting }), 'school-waiting');
    const book = await openBook(cemEvents());
    assert.equal(keptWaiting(book.entries, 32), null);
    await book.record(d('2026-10-20'), { kind: 'school.waiting', waiting });
    assert.deepEqual(keptWaiting(book.entries, 32), waiting);
    const archive = archiveText(archiveOf(book.entries, book.state, options));
    for (const secret of [PKCS8, waiting.secret, waiting.device]) assert.equal(archive.includes(secret), false);
    await book.record(d('2026-10-20'), { kind: 'school.waiting', waiting: null });
    assert.equal(keptWaiting(book.entries, 32), null);
    const again = { ...waiting, secret: newHolderSecret(random), device: newId(random) };
    await book.record(d('2026-10-21'), { kind: 'school.waiting', waiting: again });
    assert.deepEqual(keptWaiting(book.entries, 32), again);
    const ring = await startKeyring(SCHOOL, one.holder, one.crypto, random);
    const held = {
      school: SCHOOL,
      device: one.holder.id,
      publicKey: one.holder.publicKey,
      pkcs8: PKCS8,
      ring: ring.ring,
    };
    await book.record(d('2026-10-21'), { kind: 'school.held', held });
    assert.equal(keptWaiting(book.entries, 32), null);
    await book.record(d('2026-10-22'), { kind: 'school.waiting', waiting });
    assert.deepEqual(keptWaiting(book.entries, 32), waiting);
    await book.record(d('2026-10-22'), { kind: 'school.waiting', waiting: { ...waiting, secret: 'unreadable' } });
    assert.equal(keptWaiting(book.entries, 32), null);
  });
});
