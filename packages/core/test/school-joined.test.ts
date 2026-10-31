// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a demo world's store keeps of the schools joined there (#564, answer
// 581): for each code, the device's ID, its signing key and its certificate,
// in the device layer, so no archive holds them; of each code the first that
// reads counts, and one that does not read is ignored. Every world, school,
// key and certificate is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  archiveOf,
  archiveText,
  certificateRequest,
  issueCertificate,
  joinCodeText,
  keptJoins,
  layerOf,
  makeJoinCode,
  newId,
  parseDay,
  readSchoolJoined,
  recordKey,
  startKeyring,
  type ArchiveOptions,
  type SchoolJoined,
} from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';
import { keySigner } from './key-signers.ts';
import { device, random, SCHOOL } from './school-devices.ts';

const WORLD = 'K7QF4';
const PKCS8 = 'TWFkZS11cCBwcml2YXRlIGhhbGYgb2YgYSBzaWduaW5nIGtleQ==';
const options: ArchiveOptions = {
  made: d('2026-10-24'),
  app: '0.7.0',
  country: 'dz',
  calendarRelease: '2026.1',
  privateNotes: true,
  bundledPacks: [],
};

async function joined(issue = 1, world = WORLD): Promise<SchoolJoined> {
  const director = await device();
  const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
  const code = joinCodeText(await makeJoinCode(opened, WORLD, newId(random), issue, director.crypto));
  const subject = newId(random);
  const request = await certificateRequest(world, subject, keySigner());
  const certificate = await issueCertificate(request, parseDay('2026-12-01'), newId(random), keySigner());
  return { code, device: subject, pkcs8: PKCS8, certificate };
}

describe('the schools a world’s store joined', () => {
  it('keeps the first that reads for each code, as the channel does, in the device layer only', async () => {
    const book = await openBook(cemEvents());
    assert.deepEqual(keptJoins(book.entries), []);
    const [first, other] = [await joined(), await joined(2)];
    assert.equal(layerOf({ kind: 'school.joined', joined: first }), 'device');
    const key = recordKey({ kind: 'school.joined', joined: first });
    assert.equal(key, recordKey({ kind: 'school.joined', joined: { ...first, device: newId(random) } }));
    assert.equal(key.includes(first.code.split(':').at(-1)!), false);
    await book.record(d('2026-10-20'), { kind: 'school.joined', joined: first });
    await book.record(d('2026-10-20'), { kind: 'school.joined', joined: other });
    const again = { ...first, pkcs8: `${PKCS8.slice(0, -4)}AAA=` };
    await book.record(d('2026-10-21'), { kind: 'school.joined', joined: again });
    await book.record(d('2026-10-22'), { kind: 'school.joined', joined: { ...first, device: newId(random) } });
    assert.deepEqual(keptJoins(book.entries), [first, other]);
    const archive = archiveText(archiveOf(book.entries, book.state, options));
    for (const secret of [first.code, PKCS8, first.device]) assert.equal(archive.includes(secret), false);
  });

  it('reads only a code as scanned, the device its certificate names, in the code’s world', async () => {
    const one = await joined();
    assert.deepEqual(readSchoolJoined(one), one);
    for (const changed of [
      null,
      [one],
      { ...one, extra: 1 },
      { ...one, code: one.code.toUpperCase() },
      { ...one, device: newId(random) },
      { ...one, device: 'not an id' },
      { ...one, pkcs8: 'not base64!' },
      { ...one, pkcs8: 'A'.repeat(500) },
      { ...one, certificate: { ...one.certificate, standIn: false } },
      await joined(1, 'ABCDE'),
    ]) {
      assert.equal(readSchoolJoined(changed), null, JSON.stringify(changed));
    }
  });
});
