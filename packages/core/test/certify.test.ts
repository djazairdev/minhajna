// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Teachers' signing keys and the demo's stand-in CA (#554): a device asks
// for its key to be certified, proving it holds the key; the world's
// stand-in CA issues a certificate marked as a stand-in's, good in that
// world only; and a signed week checks against the world's CA key, refused
// when its text, its signature or its certificate was changed, or when it
// is moved to another world with the same key's certificate there. Ed25519 is
// Node's (key-signers.ts). Every world, device and week is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  certificateRequest,
  checkCertificate,
  checkRequest,
  checkSignedWeek,
  issueCertificate,
  newId,
  parseDay,
  signWeek,
  type SignedWeek,
} from '../src/index.ts';
import { keySigner } from './key-signers.ts';
import { random } from './school-devices.ts';

const WORLD = 'K7QF4';
const DAY = parseDay('2026-12-01');
const WEEK = JSON.stringify({ course: 'made-up course', week: '2026-11-29', lesson: 'درس مختلق' });

async function certified() {
  const [ca, teacher] = [keySigner(), keySigner()];
  const subject = newId(random);
  const request = await certificateRequest(WORLD, subject, teacher);
  const certificate = await issueCertificate(request, DAY, newId(random), ca);
  return { ca, teacher, subject, request, certificate };
}

describe('the stand-in CA', () => {
  it('certifies a key only for the device that proves it holds it', async () => {
    const { ca, teacher, subject, request, certificate } = await certified();
    assert.equal(await checkRequest(request, ca), true);
    const other = keySigner();
    for (const changed of [
      { ...request, subject: newId(random) },
      { ...request, publicKey: other.publicKey },
      { ...request, world: 'ABCDE' },
      { ...request, extra: 1 },
      { ...request, world: 'abcde' },
      null,
    ]) {
      assert.equal(await checkRequest(changed, ca), false, JSON.stringify(changed));
      await assert.rejects(issueCertificate(changed as typeof request, DAY, newId(random), ca), /certifies/);
    }
    assert.deepEqual(
      [certificate.standIn, certificate.subject, certificate.publicKey],
      [true, subject, teacher.publicKey],
    );
    assert.equal(certificate.issued, DAY);
    await assert.rejects(certificateRequest('K7QF', subject, teacher), /names a world/);
  });

  it('issues a certificate good in its own world, under its own key', async () => {
    const { ca, certificate } = await certified();
    assert.equal(await checkCertificate(certificate, WORLD, ca.publicKey, ca), true);
    assert.equal(await checkCertificate(certificate, 'ABCDE', ca.publicKey, ca), false);
    assert.equal(await checkCertificate(certificate, WORLD, keySigner().publicKey, ca), false);
    for (const changed of [
      { ...certificate, issued: parseDay('2026-12-02') },
      { ...certificate, standIn: false },
      { ...certificate, serial: newId(random) },
      { ...certificate, publicKey: keySigner().publicKey },
    ]) {
      assert.equal(await checkCertificate(changed, WORLD, ca.publicKey, ca), false, JSON.stringify(changed));
    }
  });

  it('checks a signed week against the world’s CA key', async () => {
    const { ca, teacher, certificate } = await certified();
    const signed = await signWeek(WEEK, certificate, teacher);
    const check = (value: unknown, key = ca.publicKey) => checkSignedWeek(value, WORLD, key, ca);
    assert.deepEqual(await check(signed), signed);
    assert.equal(((await check(signed)) as SignedWeek).certificate.standIn, true);
    assert.equal(await check({ ...signed, text: WEEK.replace('مختلق', 'آخر') }), 'forged');
    assert.equal(
      await check({ ...signed, signature: signed.signature.replace(/^./u, (one) => (one === '0' ? '1' : '0')) }),
      'forged',
    );
    assert.equal(await check(signed, keySigner().publicKey), 'uncertified');
    assert.equal(await check({ ...signed, extra: 1 }), 'forged');
    assert.equal(await check({ ...signed, text: '\ud800' }), 'forged');

    const thief = keySigner();
    const copied = {
      ...signed,
      signature: (await signWeek(WEEK, { ...certificate, publicKey: thief.publicKey }, thief)).signature,
    };
    assert.equal(await check(copied), 'forged');
    const other = await certified();
    assert.equal(await check({ ...signed, certificate: other.certificate }), 'uncertified');
    await assert.rejects(signWeek(WEEK, certificate, thief), /another key/);

    const elsewhere = await certificateRequest('ABCDE', certificate.subject, teacher);
    const moved = await issueCertificate(elsewhere, DAY, newId(random), ca);
    const there = (value: unknown) => checkSignedWeek(value, 'ABCDE', ca.publicKey, ca);
    assert.equal(await there({ ...signed, certificate: moved }), 'forged');
    assert.notEqual(await there(await signWeek(WEEK, moved, teacher)), 'forged');
    await assert.rejects(signWeek('\ud800', certificate, teacher), /whole characters/);
  });
});
