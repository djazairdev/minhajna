// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teacher's timetable package as a file (#580, answer 608): a part saved as a
// file reads back inside its own world, also with a byte order mark and a line
// break a sharing app added; real mode refuses it for naming a world, and so
// does another world, with the school it names; a file changed after signing,
// or unsigned, fails the signature; a file too long fails its size; a file not
// of the format, not JSON, with a field of its own beyond the format's, not
// canonical, or whose part is not canonical or carries more than a part fails
// the format; and a signer another CA certified fails the certification. Every
// world, school and teacher is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canonicalJson,
  certificateRequest,
  issueCertificate,
  newId,
  packageFile,
  PACKAGE_FILE_MOST,
  parseDay,
  readPackageFile,
  signPart,
  type KeySigner,
  type TimetablePart,
} from '../src/index.ts';
import { keySigner } from './key-signers.ts';
import { random, SCHOOL } from './school-devices.ts';

const WORLD = 'K7QF4';

async function signed(ca: KeySigner, change: Partial<TimetablePart> = {}) {
  const signer = keySigner();
  const request = await certificateRequest(WORLD, newId(random), signer);
  const certificate = await issueCertificate(request, parseDay('2026-12-01'), newId(random), ca);
  const part: TimetablePart = {
    world: WORLD,
    school: SCHOOL,
    schoolName: 'متوسطة المختلقة',
    assignment: 'a'.repeat(32),
    issue: 1,
    teacher: 'مختلق',
    version: 1,
    from: parseDay('2026-12-06'),
    once: false,
    sessions: [],
    bells: [[480, 540]],
    ...change,
  };
  return signPart(part, certificate, signer);
}

describe('a timetable package file', () => {
  const ca = keySigner();
  const inside = { checker: ca, world: { id: WORLD, ca: ca.publicKey } };

  it('reads back inside its world, and is refused in real mode and in another world', async () => {
    const file = packageFile(await signed(ca));
    const read = await readPackageFile(file, inside);
    assert.equal(read.ok, true);
    assert.equal((await readPackageFile(`\uFEFF${file}\r\n`, inside)).ok, true);
    assert.equal(read.ok && read.part.schoolName, 'متوسطة المختلقة');
    const school = 'متوسطة المختلقة';
    assert.deepEqual(await readPackageFile(file, { checker: ca, world: null }), { ok: false, failed: 'world', school });
    const other = { checker: ca, world: { id: 'Q2M9X', ca: ca.publicKey } };
    assert.deepEqual(await readPackageFile(file, other), { ok: false, failed: 'world', school });
  });

  it('refuses a file changed after signing, or unsigned', async () => {
    const value = JSON.parse(packageFile(await signed(ca))) as { text: string; signature: string };
    const part = JSON.parse(value.text) as TimetablePart;
    const changed = { ...value, text: canonicalJson({ ...part, version: 2 }) };
    const school = 'متوسطة المختلقة';
    for (const one of [changed, { ...value, signature: '' }]) {
      assert.deepEqual(await readPackageFile(canonicalJson(one), inside), { ok: false, failed: 'signature', school });
    }
  });

  it('refuses a file not of the format', async () => {
    const value = JSON.parse(packageFile(await signed(ca))) as { text: string };
    const files = [
      'not JSON',
      canonicalJson({ ...value, format: 'minhajna/timetable-part/1' }),
      canonicalJson({ ...value, text: JSON.stringify(JSON.parse(value.text), null, 1) }),
      canonicalJson({ ...value, text: canonicalJson({ ...JSON.parse(value.text), pupils: [] }) }),
      canonicalJson({ ...value, pupils: [] }),
      JSON.stringify(value, null, 1),
    ];
    for (const file of files) {
      assert.deepEqual(await readPackageFile(file, inside), { ok: false, failed: 'format', school: null });
    }
    const large = ' '.repeat(PACKAGE_FILE_MOST + 1);
    assert.deepEqual(await readPackageFile(large, inside), { ok: false, failed: 'size', school: null });
  });

  it('refuses a signer another CA certified', async () => {
    const file = packageFile(await signed(keySigner()));
    assert.deepEqual(await readPackageFile(file, inside), {
      ok: false,
      failed: 'certified',
      school: 'متوسطة المختلقة',
    });
  });
});
