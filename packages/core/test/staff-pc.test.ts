// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Signing in on a staffroom PC (#572, answer 602): the PC's QR code carries its
// public key and one-time secret and refuses anything else; a session names its
// world, school and teacher, in any language but with no hidden characters,
// with different joining codes of that world and one school; the phone's answer
// in the PC's drop space opens only with the PC's own key and in its world,
// with the check the phone shows, which a retry of the same sealed answer
// keeps, so a session photographed and sealed alone shows another; two that
// differ are refused, records of another shape are skipped, and a drop space
// whose first answers hold none counts as contested; a security key's session
// waits in a place named by its PRF output and its world, the latest one there
// counts, and a wrong output or another world finds nothing. Every world,
// school, teacher and key is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  certificateRequest,
  issueCertificate,
  joinCodeText,
  keyedCipher,
  keyPlace,
  makeJoinCode,
  newHolderSecret,
  newId,
  parseDay,
  pcAnswerBatches,
  pcDrop,
  pcQr,
  PC_ANSWER_FORMAT,
  PC_ANSWERS_OPENED,
  PC_SESSION_JOINS,
  isPcSession,
  readKeySession,
  readPcAnswer,
  readPcQr,
  sealBatches,
  sealKeySession,
  sealPcAnswer,
  startKeyring,
  SYNC_BATCH_BYTES,
  type KeyCrypto,
  type PcRequest,
  type PcSession,
  type SealedBatch,
} from '../src/index.ts';
import { ascii, fromHex } from '../src/school-key-shape.ts';
import { asciiJson } from '../src/sealed-stream.ts';
import { keySigner } from './key-signers.ts';
import { device, random, SCHOOL } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';

const WORLD = 'K7QF4';
const BYTES = 32;

/** A session of two joining codes of the made-up school, with Arabic names. */
async function session(world = WORLD, school = SCHOOL): Promise<PcSession> {
  const director = await device();
  const opened = await startKeyring(school, director.holder, director.crypto, random);
  const code = async () => joinCodeText(await makeJoinCode(opened, world, newId(random), 1, director.crypto));
  return { world, schoolName: 'متوسطة الياسمين', teacher: 'بن يحيى سعاد 𝔸', joins: [await code(), await code()] };
}

/** A record sealed in a PC's drop space as anyone with its secret could. */
async function dropped(secret: string, record: unknown, first: number): Promise<SealedBatch[]> {
  const sealer = keyedCipher(await mac(fromHex(secret), ascii('minhajna/pc-drop/seal')), cipher);
  const { stream } = await pcDrop(secret, mac);
  return sealBatches(sealer, stream, first, ascii(JSON.stringify(record)), SYNC_BATCH_BYTES);
}

/** A session sealed to a PC and put in its drop space from `first`, with its check. */
async function answered(request: PcRequest, one: PcSession, first: number, key: KeyCrypto) {
  const sealed = await sealPcAnswer(request, one, key, mac);
  return { ...sealed, ...(await pcAnswerBatches(sealed, first, cipher, mac)) };
}

async function pc() {
  const one = await device();
  return { ...one, request: { publicKey: one.holder.publicKey, secret: newHolderSecret(random) } };
}

describe('a staffroom PC’s sign-in', () => {
  it('reads its QR code back, and refuses one of another kind, length or shape', async () => {
    const { request } = await pc();
    assert.deepEqual(readPcQr(pcQr(request), BYTES), request);
    assert.equal(readPcQr(pcQr(request), BYTES + 1), null);
    assert.equal(readPcQr(pcQr(request).replace('minhajna-pc:1:', 'minhajna-pc:2:'), BYTES), null);
    assert.equal(readPcQr(`${pcQr(request)}:more`, BYTES), null);
    assert.equal(readPcQr(pcQr({ ...request, secret: 'not-a-secret' }), BYTES), null);
    assert.equal(readPcQr(pcQr({ ...request, publicKey: request.publicKey.toUpperCase() }), BYTES), null);
  });

  it('takes a session in any language, of one world and one school, and nothing else', async () => {
    const one = await session();
    assert.equal(isPcSession(one), true);
    assert.equal((JSON.parse(asciiJson(one)) as PcSession).teacher, one.teacher);
    assert.match(asciiJson(one), /^[\x20-\x7e]*$/u);
    const other = await session(WORLD, 'another-made-up-school');
    const elsewhere = await session('M3TR8');
    for (const wrong of [
      { ...one, extra: true },
      { ...one, teacher: ' ' },
      { ...one, schoolName: 'a\u0007b' },
      { ...one, teacher: 'x'.repeat(121) },
      { ...one, teacher: 'سعاد\u202e' },
      { ...one, schoolName: 'a\u200bb' },
      { ...one, teacher: 'a\ud800b' },
      { ...one, joins: [one.joins[0], one.joins[0]] },
      { ...one, joins: [] },
      { ...one, joins: Array.from({ length: PC_SESSION_JOINS + 1 }, () => one.joins[0]) },
      { ...one, joins: [one.joins[0], other.joins[0]] },
      { ...one, joins: elsewhere.joins },
      { ...one, joins: ['minhajna-join:1:nothing'] },
      { ...one, world: 'not a world' },
      { ...one, signing: { pkcs8: 'zz', certificate: {} } },
      null,
      [one],
    ]) {
      assert.equal(isPcSession(wrong), false);
    }
  });

  it('opens the answer with the PC’s key only, with the phone’s check, and refuses two that differ', async () => {
    const { request, crypto } = await pc();
    const one = await session();
    const answer = await answered(request, one, 0, crypto);
    assert.match(answer.check, /^[0-9a-f]{8}$/u);
    assert.deepEqual(await pcDrop(request.secret, mac), { space: answer.space, stream: answer.stream });
    const read = (batches: readonly SealedBatch[], key = crypto, world = WORLD) =>
      readPcAnswer(request.secret, world, batches, key, cipher, mac);
    assert.deepEqual(await read(answer.batches), { session: one, check: answer.check });
    assert.equal(await read(answer.batches, crypto, 'M3TR8'), null);
    const stranger = await device();
    assert.equal(await read(answer.batches, stranger.crypto), null);
    const retried = await pcAnswerBatches(answer, answer.batches.length, cipher, mac);
    assert.deepEqual(await read([...answer.batches, ...retried.batches]), { session: one, check: answer.check });
    const again = await answered(request, one, answer.batches.length, crypto);
    assert.notEqual(again.check, answer.check);
    const both = [...answer.batches, ...again.batches];
    assert.deepEqual(await read(both), { session: one, check: answer.check });
    const forged = await answered(request, await session(), both.length, stranger.crypto);
    assert.equal(await read([...both, ...forged.batches]), 'contested');
    const alone = await read(forged.batches);
    assert.ok(alone !== null && alone !== 'contested');
    assert.equal(alone.check, forged.check);
    assert.notEqual(alone.check, answer.check);
    await assert.rejects(sealPcAnswer(request, { ...one, teacher: '' }, crypto, mac), /Not a session/);
    const short = { ...request, publicKey: 'ab' };
    await assert.rejects(answered(short, one, 0, crypto), /public key/);
  });

  it('skips records of another shape, opens only so many answers, and finds nothing under another secret', async () => {
    const { request, crypto } = await pc();
    const junk = [
      await dropped(request.secret, { format: PC_ANSWER_FORMAT, sealed: 'not base64!' }, 0),
      await dropped(request.secret, { format: PC_ANSWER_FORMAT, sealed: 'AAAA', extra: 1 }, 1),
      await dropped(request.secret, { format: 'minhajna/other/1', sealed: 'AAAA' }, 2),
      await dropped(request.secret, 'just text', 3),
    ].flat();
    const answer = await answered(request, await session(), 4, crypto);
    const found = await readPcAnswer(request.secret, WORLD, [...junk, ...answer.batches], crypto, cipher, mac);
    assert.ok(found !== null && found !== 'contested' && isPcSession(found.session));
    const spam = await Promise.all(
      Array.from({ length: PC_ANSWERS_OPENED }, (_, at) =>
        dropped(request.secret, { format: PC_ANSWER_FORMAT, sealed: 'AAAA' }, at),
      ),
    );
    const late = await answered(request, await session(), PC_ANSWERS_OPENED, crypto);
    assert.equal(
      await readPcAnswer(request.secret, WORLD, [...spam.flat(), ...late.batches], crypto, cipher, mac),
      'contested',
    );
    assert.equal(await readPcAnswer(newHolderSecret(random), WORLD, answer.batches, crypto, cipher, mac), null);
    await assert.rejects(pcDrop('short', mac), /one-time secret/);
  });

  it('keeps a security key’s session where its PRF output finds it in its world, the latest one counting', async () => {
    const prf = random(32);
    const ca = keySigner();
    const subject = newId(random);
    const request = await certificateRequest(WORLD, subject, keySigner());
    const certificate = await issueCertificate(request, parseDay('2026-12-01'), newId(random), ca);
    const first = { ...(await session()), signing: { pkcs8: 'MIGHAgEA'.repeat(17), certificate } };
    const kept = await sealKeySession(prf, first, 0, cipher, mac);
    assert.deepEqual(await keyPlace(prf, WORLD, mac), { space: kept.space, stream: kept.stream });
    assert.deepEqual(await readKeySession(prf, WORLD, kept.batches, cipher, mac), first);
    const second = await session();
    const later = await sealKeySession(prf, second, kept.batches.length, cipher, mac);
    assert.deepEqual(await readKeySession(prf, WORLD, [...kept.batches, ...later.batches], cipher, mac), second);
    assert.equal(await readKeySession(random(32), WORLD, kept.batches, cipher, mac), null);
    const elsewhere = await sealKeySession(prf, await session('M3TR8'), 0, cipher, mac);
    assert.notEqual(elsewhere.space, kept.space);
    assert.equal(await readKeySession(prf, WORLD, elsewhere.batches, cipher, mac), null);
    assert.notDeepEqual(await keyPlace(random(32), WORLD, mac), await keyPlace(prf, WORLD, mac));
    await assert.rejects(keyPlace(random(16), WORLD, mac), /PRF output/);
    await assert.rejects(keyPlace(prf, 'nowhere', mac), /Not a world/);
    await assert.rejects(sealKeySession(prf, { ...second, joins: [] }, 0, cipher, mac), /Not a session/);
  });
});
