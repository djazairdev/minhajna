// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's joining code and the teacher's channel (#564, answer 581): every
// device that holds the school key makes the same code for an assignment and
// issue, and a different one for any other; the QR reads back only as written;
// the teacher's device tells the school it joined on the channel, and the
// school reads the device and its certificate back; the first record that holds
// is the channel's, so whoever else holds the code cannot replace it, junk
// ahead of it does not hold it back, and neither a record of another code,
// world or device, nor one sealed under the key that names the stream, or what
// else the channel carries, counts or hides it. The server sees batches of one
// size under a stream named by a MAC, and nothing named. Every world, school,
// device and certificate is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addHolder,
  canonicalJson,
  certificateRequest,
  channelSealing,
  channelStream,
  issueCertificate,
  joinCodeText,
  keyedCipher,
  makeJoinCode,
  newId,
  openKeyring,
  parseDay,
  readJoinCode,
  readJoined,
  removeHolder,
  sealBatches,
  sealJoined,
  startKeyring,
  SYNC_BATCH_BYTES,
  type JoinCode,
  type Joined,
  type KeySigner,
} from '../src/index.ts';
import { fromHex } from '../src/school-key-shape.ts';
import { keySigner } from './key-signers.ts';
import { device, opened as openedOf, random, SCHOOL } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';

const WORLD = 'K7QF4';
const DAY = parseDay('2026-12-01');

async function school() {
  const director = await device();
  return { director, opened: await startKeyring(SCHOOL, director.holder, director.crypto, random) };
}

async function joined(ca: KeySigner, world = WORLD): Promise<Joined> {
  const subject = newId(random);
  const request = await certificateRequest(world, subject, keySigner());
  return { device: subject, certificate: await issueCertificate(request, DAY, newId(random), ca) };
}

describe('the school’s joining code', () => {
  it('is the same on every device of the school, and another for any other assignment, issue or epoch', async () => {
    const { director, opened } = await school();
    const assignment = newId(random);
    const code = await makeJoinCode(opened, WORLD, assignment, 1, director.crypto);
    assert.deepEqual([code.world, code.school, code.epoch, code.issue], [WORLD, SCHOOL, 0, 1]);
    const deputy = await device();
    const added = await addHolder(opened, deputy.holder, director.holder.id, director.crypto);
    const held = openedOf(await openKeyring(added.ring, deputy.holder.id, deputy.crypto));
    assert.deepEqual(await makeJoinCode(held, WORLD, assignment, 1, deputy.crypto), code);
    const removed = await removeHolder(added, deputy.holder.id, director.holder.id, director.crypto, random);
    const others = [
      await makeJoinCode(opened, WORLD, newId(random), 1, director.crypto),
      await makeJoinCode(opened, WORLD, assignment, 2, director.crypto),
      await makeJoinCode(removed, WORLD, assignment, 1, director.crypto),
      await makeJoinCode((await school()).opened, WORLD, assignment, 1, director.crypto),
    ];
    assert.equal(new Set([code.key, ...others.map((one) => one.key)]).size, 5);
    assert.equal(others[2]!.epoch, 1);
    assert.deepEqual(await makeJoinCode(removed, WORLD, assignment, 1, director.crypto, 0), code);
    for (const [world, issue] of [
      ['K7QF', 1],
      [WORLD, 0],
      [WORLD, 1.5],
      [WORLD, 1_000_000_000],
    ] as const) {
      await assert.rejects(makeJoinCode(opened, world, assignment, issue, director.crypto), /joining code/);
    }
    await assert.rejects(makeJoinCode(opened, WORLD, assignment, 1, director.crypto, 1_000_000_000), /joining code/);
  });

  it('reads back from its QR only as a school’s device wrote it', async () => {
    const { director, opened } = await school();
    const code = await makeJoinCode(opened, WORLD, newId(random), 3, director.crypto);
    const text = joinCodeText(code);
    assert.deepEqual(readJoinCode(text), code);
    for (const changed of [
      text.replace('minhajna-join:1:', 'minhajna-join:2:'),
      `${text}:extra`,
      text.replace(`:${code.issue}:`, ':0:'),
      text.replace(`:${code.issue}:`, ':03:'),
      text.replace(`:${code.epoch}:`, ':-1:'),
      text.replace(code.key, code.key.toUpperCase()),
      text.replace(code.key, code.key.slice(2)),
      text.replace(WORLD, 'K7QF44'),
      text.replace(WORLD, 'k7qf4'),
      text.replace(SCHOOL, 'short'),
      text.slice(0, -1),
    ]) {
      assert.equal(readJoinCode(changed), null, changed);
    }
  });
});

describe('the teacher’s channel to the school', () => {
  const ca = keySigner();
  const reading = (code: JoinCode, batches: Parameters<typeof readJoined>[1]) =>
    readJoined(code, batches, { key: ca.publicKey, checker: ca }, cipher, mac);

  it('tells the school which device joined, with its certificate, and shows the server nothing named', async () => {
    const { director, opened } = await school();
    const assignment = newId(random);
    const code = await makeJoinCode(opened, WORLD, assignment, 1, director.crypto);
    const scanned = readJoinCode(joinCodeText(code))!;
    const teacher = await joined(ca);
    const { stream, batches } = await sealJoined(scanned, teacher, cipher, mac);
    assert.match(stream, /^[0-9a-f]{32}$/u);
    assert.equal(stream, await channelStream(code, mac));
    assert.deepEqual(
      batches.map((one) => [one.number, one.bytes.length]),
      [[0, SYNC_BATCH_BYTES + 28]],
    );
    const seen = Buffer.from(batches[0]!.bytes).toString('latin1');
    for (const named of [assignment, teacher.device, SCHOOL, WORLD]) assert.equal(seen.includes(named), false);
    assert.deepEqual(await reading(code, batches), teacher);
    assert.equal(await reading(await makeJoinCode(opened, WORLD, assignment, 2, director.crypto), batches), null);
    assert.equal(await reading(code, []), null);
  });

  it('keeps the first record that holds, so whoever else holds the code cannot replace it', async () => {
    const { director, opened } = await school();
    const code = await makeJoinCode(opened, WORLD, newId(random), 1, director.crypto);
    const [teacher, impostor] = [await joined(ca), await joined(ca)];
    const first = (await sealJoined(code, teacher, cipher, mac)).batches[0]!;
    const later = (await sealJoined(code, impostor, cipher, mac, 1)).batches[0]!;
    assert.equal(later.number, 1);
    assert.deepEqual(await reading(code, [later]), impostor);
    assert.deepEqual(await reading(code, [first, later]), teacher);
    assert.deepEqual(await reading(code, [later, first]), teacher);
    const ahead = (await sealJoined(code, impostor, cipher, mac)).batches[0]!;
    const behind = (await sealJoined(code, teacher, cipher, mac, 1)).batches[0]!;
    assert.deepEqual(await reading(code, [behind, ahead]), impostor);
    const junk = { number: 0, bytes: new Uint8Array(SYNC_BATCH_BYTES + 28) };
    assert.deepEqual(await reading(code, [junk, behind]), teacher);
    await assert.rejects(sealJoined(code, teacher, cipher, mac, -1), /numbered from 0/);
  });

  it('counts no record of another code, world, CA or device, and nothing else on the channel hides one', async () => {
    const { director, opened } = await school();
    const code = await makeJoinCode(opened, WORLD, newId(random), 1, director.crypto);
    const stream = await channelStream(code, mac);
    const sealer = keyedCipher(await channelSealing(code, mac), cipher);
    const teacher = await joined(ca);
    const { world, school: named, assignment, issue } = code;
    const record = { format: 'minhajna/joined/1', world, school: named, assignment, issue, ...teacher };
    const raw = async (value: unknown, number: number, under = sealer) =>
      sealBatches(under, stream, number, Buffer.from(canonicalJson(value)), SYNC_BATCH_BYTES);
    const byStreamKey = await raw(record, 0, keyedCipher(fromHex(code.key), cipher));
    assert.equal(await reading(code, byStreamKey), null);
    const bad = [
      ...(await raw({ ...record, issue: 2 }, 0)),
      ...(await raw({ ...record, device: newId(random) }, 1)),
      ...(await raw({ ...record, extra: 1 }, 2)),
      ...(await raw({ ...record, ...(await joined(keySigner())) }, 3)),
      ...(await raw({ ...record, certificate: (await joined(ca, 'ABCDE')).certificate }, 4)),
      ...(await raw({ notes: 'x'.repeat(SYNC_BATCH_BYTES) }, 5)),
      { number: 7, bytes: new Uint8Array(SYNC_BATCH_BYTES + 28) },
      ...(await sealJoined(await makeJoinCode(opened, WORLD, newId(random), 1, director.crypto), teacher, cipher, mac))
        .batches,
    ];
    assert.equal(await reading(code, bad), null);
    assert.deepEqual(await reading(code, [...bad, ...(await raw(record, 9))]), teacher);
    await assert.rejects(sealJoined(code, { ...teacher, device: newId(random) }, cipher, mac), /own certificate/);
    await assert.rejects(sealJoined(code, await joined(ca, 'ABCDE'), cipher, mac), /another world/);
  });
});
