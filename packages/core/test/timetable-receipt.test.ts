// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teacher's receipt of a version on their channel (#579, answer 607): the
// joined device's receipt of a version sent there before it counts, the first
// of each version kept, and one that came before its version is left out; a
// receipt of a version no other key sent, one signed by another device or by
// the joined key under another subject, and one naming another channel are left
// out, and none counts while no device has joined; a receipt of another world's
// certificate, or of a key other than the certificate's, is never signed; and a
// receipt is never read as another format's record. Every world, school and
// teacher is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  certificateRequest,
  channelProposals,
  channelReceipts,
  isTimetableReceipt,
  issueCertificate,
  makeJoinCode,
  newId,
  parseDay,
  sealJoined,
  sealPart,
  sealTimetableRecord,
  signPart,
  signReceipt,
  startKeyring,
  type Certificate,
  type KeySigner,
  type SealedBatch,
  type TimetablePart,
  type TimetableReceipt,
} from '../src/index.ts';
import { keySigner } from './key-signers.ts';
import { device, random, SCHOOL } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';

const WORLD = 'K7QF4';

async function certified(ca: KeySigner, world = WORLD, signer = keySigner()) {
  const request = await certificateRequest(world, newId(random), signer);
  const certificate: Certificate = await issueCertificate(request, parseDay('2026-12-01'), newId(random), ca);
  return { signer, certificate };
}

async function setting() {
  const director = await device();
  const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
  const code = await makeJoinCode(opened, WORLD, newId(random), 1, director.crypto);
  const other = await makeJoinCode(opened, WORLD, newId(random), 1, director.crypto);
  const ca = keySigner();
  const [head, teacher, stranger] = [await certified(ca), await certified(ca), await certified(ca)];
  const joined = { device: teacher.certificate.subject, certificate: teacher.certificate };
  const batches: SealedBatch[] = [];
  const part = (version: number): TimetablePart => ({
    world: WORLD,
    school: SCHOOL,
    schoolName: 'متوسطة المختلقة',
    assignment: code.assignment,
    issue: code.issue,
    teacher: 'مختلق',
    version,
    from: parseDay('2026-12-06'),
    once: false,
    sessions: [],
    bells: [],
  });
  const send = async (version: number, by = head) => {
    const signed = await signPart(part(version), by.certificate, by.signer);
    batches.push(...(await sealPart(code, signed, batches.length, cipher, mac)).batches);
  };
  const receipt = (version: number, day = '2026-12-03'): TimetableReceipt => ({
    world: WORLD,
    school: SCHOOL,
    assignment: code.assignment,
    issue: code.issue,
    version,
    day: parseDay(day),
  });
  const put = async (one: TimetableReceipt, by = teacher) =>
    batches.push(
      ...(
        await sealTimetableRecord(code, await signReceipt(one, by.certificate, by.signer), batches.length, cipher, mac)
      ).batches,
    );
  const join = async () => batches.push(...(await sealJoined(code, joined, cipher, mac, batches.length)).batches);
  const read = (who: typeof joined | null = joined) =>
    channelReceipts(code, batches, { key: ca.publicKey, checker: ca }, who, cipher, mac);
  return { code, other, ca, head, teacher, stranger, joined, batches, send, receipt, put, join, read };
}

describe('a teacher’s receipt of a version', () => {
  it('counts the joined device’s receipt of a version sent there, the first of each kept', async () => {
    const { send, receipt, put, join, read } = await setting();
    await join();
    await send(1);
    await send(2);
    await put(receipt(1));
    await put(receipt(1, '2026-12-04'));
    await put(receipt(2, '2026-12-05'));
    const found = await read();
    assert.deepEqual(
      found.map((one) => [one.value.version, one.value.day]),
      [
        [1, '2026-12-03'],
        [2, '2026-12-05'],
      ],
    );
    assert.deepEqual(await read(null), []);
  });

  it('leaves out a version only the joined key sent, and another device’s or another channel’s receipt', async () => {
    const { ca, other, teacher, stranger, send, receipt, put, join, read } = await setting();
    await join();
    await put(receipt(1));
    await send(2, teacher);
    await put(receipt(2));
    await send(3);
    await put(receipt(3), stranger);
    const twin = await certified(ca, WORLD, teacher.signer);
    await put(receipt(3), twin);
    await assert.rejects(put({ ...receipt(3), assignment: other.assignment }), RangeError);
    assert.deepEqual(await read(), []);
  });

  it('leaves out a receipt that came before its version, and counts it sent again after', async () => {
    const { send, receipt, put, join, read } = await setting();
    await join();
    await put(receipt(5));
    await send(5);
    assert.deepEqual(await read(), []);
    await put(receipt(5, '2026-12-04'));
    assert.deepEqual(
      (await read()).map((one) => [one.value.version, one.value.day]),
      [[5, '2026-12-04']],
    );
  });

  it('is never signed for another world or key, nor read as another format', async () => {
    const { ca, teacher, stranger, send, receipt, put, join, read, code, batches } = await setting();
    const elsewhere = await certified(ca, 'Q2WX9', teacher.signer);
    await assert.rejects(signReceipt(receipt(1), elsewhere.certificate, teacher.signer), RangeError);
    await assert.rejects(signReceipt(receipt(1), stranger.certificate, teacher.signer), RangeError);
    await assert.rejects(
      signReceipt({ ...receipt(1), day: '2026-02-30' as never }, teacher.certificate, teacher.signer),
      RangeError,
    );
    assert.equal(isTimetableReceipt({ ...receipt(1), extra: true }), false);
    await join();
    await send(1);
    await put(receipt(1));
    const ca2 = { key: ca.publicKey, checker: ca };
    const joined = { device: teacher.certificate.subject, certificate: teacher.certificate };
    assert.deepEqual(await channelProposals(code, batches, ca2, joined, cipher, mac), []);
    assert.equal((await read()).length, 1);
  });
});
