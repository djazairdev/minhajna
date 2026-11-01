// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A directorate's space (#593, answer 621): its ID the same on every device of
// a world, another for another world or directorate, and refused for a name
// that is not one; a school's listing and an inspector's key sealed on their
// own streams of it and read back, another world's and what is not of their
// shape left out, the latest listing of a school winning, each written by its
// builder; the inspector's key a typed fingerprint names found however it is
// cased, spaced or dashed, with the first device posted for it, a copy under
// another ID changing nothing, and none for another key or nothing typed; and
// the key pair an inspector's device keeps read from the world's store, the
// first that reads, under its own key. Every world, school and device here is
// made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  directorateSpace,
  inspectorByFingerprint,
  inspectorFingerprint,
  inspectorKey,
  inspectorKeyPlace,
  keptInspectorDevice,
  listedSchools,
  listingPlace,
  openDirectorateRecords,
  readInspectorDevice,
  readInspectorKey,
  readSchoolListed,
  recordKey,
  schoolListing,
  sealDirectorateRecord,
  INSPECTOR_KEY,
  SCHOOL_LISTED,
} from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';
import { device } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';

const WORLD = 'K7QF4';
const listing = (seed: string, space: string, world = WORLD) => schoolListing(world, seed, space);

describe('a directorate’s space', () => {
  it('is the same on every device of a world, and another for another world or directorate', async () => {
    const space = await directorateSpace(WORLD, 'directorate-1', mac);
    assert.match(space, /^[A-Za-z0-9_-]{22}$/u);
    assert.equal(await directorateSpace(WORLD, 'directorate-1', mac), space);
    const others = [
      await directorateSpace('M3XP7', 'directorate-1', mac),
      await directorateSpace(WORLD, 'directorate-2', mac),
    ];
    assert.ok(others.every((one) => one !== space));
    const wrong: readonly (readonly [string, string])[] = [
      ['not a world', 'directorate-1'],
      [WORLD, 'Directorate 1'],
      [WORLD, ''],
    ];
    for (const [world, directorate] of wrong) {
      await assert.rejects(directorateSpace(world, directorate, mac), RangeError);
    }
  });

  it('carries listings, the latest of a school winning, past another world’s and what does not read', async () => {
    const space = await directorateSpace(WORLD, 'directorate-1', mac);
    const place = await listingPlace(space, mac);
    assert.deepEqual(listing('school-2', 'made-up-space-number-one'), {
      format: SCHOOL_LISTED,
      world: WORLD,
      seed: 'school-2',
      space: 'made-up-space-number-one',
    });
    assert.notDeepEqual(place, await inspectorKeyPlace(space, mac));
    const records = [
      listing('school-2', 'made-up-space-number-one'),
      listing('school-3', 'made-up-space-number-two', 'M3XP7'),
      { ...listing('school-4', 'made-up-space-number-three'), extra: true },
      listing('school-2', 'made-up-space-number-four'),
      listing('school-5', 'short'),
    ];
    const batches = [];
    for (const one of records) batches.push(...(await sealDirectorateRecord(place, one, batches.length, cipher)));
    const read = await openDirectorateRecords(place, batches, cipher);
    assert.deepEqual([...listedSchools(read, WORLD)], [['school-2', 'made-up-space-number-four']]);
    assert.deepEqual(
      readSchoolListed(listing('school-2', 'made-up-space-number-one')),
      listing('school-2', 'made-up-space-number-one'),
    );
    for (const value of [
      null,
      [],
      listing('school', 'made-up-space-number-one'),
      { ...listing('school-2', 'made-up-space-number-one'), format: 'other' },
    ]) {
      assert.equal(readSchoolListed(value), null);
    }
  });

  it('finds the one inspector’s key a typed fingerprint names, however it is spaced', async () => {
    const [first, second] = [await device(), await device()];
    const posted = (holder: unknown, world = WORLD) => ({ format: INSPECTOR_KEY, world, holder });
    const records = [posted(first.holder), posted(second.holder, 'M3XP7'), posted({ id: 'x' })];
    const print = await inspectorFingerprint(first.holder.publicKey, first.crypto);
    const crypto = first.crypto;
    const spaced = [
      print.toUpperCase(),
      print.replace(/-/gu, ' '),
      print.replace(/-/gu, ''),
      print.replace(/-/gu, '\u2011'),
    ];
    for (const typed of [print, ...spaced, print.replace(/-/gu, '\u00a0')]) {
      assert.deepEqual(await inspectorByFingerprint(records, WORLD, typed, crypto), first.holder);
    }
    const theirs = await inspectorFingerprint(second.holder.publicKey, crypto);
    assert.equal(await inspectorByFingerprint(records, WORLD, theirs, crypto), null);
    assert.equal(await inspectorByFingerprint(records, WORLD, ' - ', crypto), null);
    const twin = { id: second.holder.id, publicKey: first.holder.publicKey };
    assert.deepEqual(await inspectorByFingerprint([...records, posted(twin)], WORLD, print, crypto), first.holder);
    assert.deepEqual(await inspectorByFingerprint([posted(twin), ...records], WORLD, print, crypto), twin);
    assert.equal(readInspectorKey({ ...posted(first.holder), extra: 1 }, crypto.publicKeyBytes), null);
    assert.deepEqual(inspectorKey(WORLD, { ...first.holder }), posted(first.holder));
  });

  it('reads the key pair an inspector’s device keeps in the world’s store, the first that reads', async () => {
    const book = await openBook(cemEvents());
    const { holder, crypto } = await device();
    const kept = { device: holder.id, publicKey: holder.publicKey, pkcs8: 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49' };
    assert.equal(keptInspectorDevice(book.entries, crypto.publicKeyBytes), null);
    await book.record(d('2027-01-05'), { kind: 'inspector.device', inspector: { ...kept, device: 'not-an-id' } });
    await book.record(d('2027-01-05'), { kind: 'inspector.device', inspector: kept });
    await book.record(d('2027-01-06'), { kind: 'inspector.device', inspector: { ...kept, pkcs8: 'QUJDRA==' } });
    assert.deepEqual(keptInspectorDevice(book.entries, crypto.publicKeyBytes), kept);
    for (const publicKey of ['ab', holder.publicKey.toUpperCase()]) {
      assert.equal(readInspectorDevice({ ...kept, publicKey }, crypto.publicKeyBytes), null);
    }
    assert.equal(recordKey({ kind: 'inspector.device', inspector: kept }), `inspector-device:${holder.id}`);
  });
});
