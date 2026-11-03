// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A school exam's cut room (#601, answer 632): every key holder finds the same
// room and decider's seed for an exam, subject and grade in an epoch, and
// another for another; a room is handed to a setter on their own channel with
// its decider's key, signed by a key holder, never by the joined device, and on
// no other channel, a key holder keeping only a room whose key and decider its
// own school key derives; and the room keeps its first chart the decider
// signed, the decider none of its setters, then the cuts its setters signed and
// the decisions the decider signed, each naming the room and an item of the
// chart, nothing before the chart counting; and it takes the largest chart a
// reader accepts. Every school, class and teacher is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SealedBatch } from '../src/batches.ts';
import {
  channelRooms,
  handedKey,
  keyText,
  makeJoinCode,
  roomKey,
  sealJoined,
  sealRoom,
  signRoom,
} from '../src/index.ts';
import {
  addHolder,
  CHART_MOST,
  deciderSeed,
  isHeldRoom,
  isExamChart,
  startKeyring,
  type ExamRoom,
} from '../src/index.ts';
import { certified, madeUpKey, madeUpRoom, WORLD } from './exam-kit.ts';
import { keySigner } from './key-signers.ts';
import { device, random, SCHOOL } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';

const NAME = { exam: 'term-1', subject: 'arabic', grade: '4am' };

describe('a school exam’s cut room', () => {
  it('is the same room for every key holder, and another for another subject or epoch', async () => {
    const [director, deputy] = [await device(), await device()];
    const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
    const both = await addHolder(opened, deputy.holder, director.holder.id, director.crypto);
    const key = await roomKey(opened, 0, NAME, director.crypto);
    assert.deepEqual(await roomKey(both, 0, NAME, deputy.crypto), key);
    assert.notDeepEqual(await roomKey(opened, 0, { ...NAME, subject: 'math' }, director.crypto), key);
    assert.notDeepEqual(await roomKey(opened, 0, { ...NAME, exam: 'term-2' }, director.crypto), key);
    const seed = await deciderSeed(opened, 0, NAME, director.crypto);
    assert.deepEqual(await deciderSeed(both, 0, NAME, deputy.crypto), seed);
    assert.notDeepEqual(seed, key);
    assert.notDeepEqual(await deciderSeed(opened, 0, { ...NAME, grade: '3am' }, director.crypto), seed);
  });

  it('is handed to a setter on their own channel by a key holder, never by the setter', async () => {
    const director = await device();
    const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
    const code = await makeJoinCode(opened, WORLD, 'a'.repeat(32), 1, director.crypto);
    const other = await makeJoinCode(opened, WORLD, 'b'.repeat(32), 1, director.crypto);
    const ca = keySigner();
    const [holder, setter] = [await certified(ca), await certified(ca)];
    const joined = { device: setter.certificate.subject, certificate: setter.certificate };
    const batches: SealedBatch[] = [...(await sealJoined(code, joined, cipher, mac, 0)).batches];
    const key = await roomKey(opened, 0, NAME, director.crypto);
    const room: ExamRoom = {
      world: WORLD,
      school: SCHOOL,
      assignment: code.assignment,
      issue: 1,
      ...NAME,
      epoch: 0,
      key: keyText(key),
      decider: holder.certificate.publicKey,
    };
    for (const by of [setter, holder]) {
      const signed = await signRoom(room, by.certificate, by.signer);
      batches.push(...(await sealRoom(code, signed, batches.length, cipher, mac)).batches);
    }
    const read = await channelRooms(code, batches, { key: ca.publicKey, checker: ca }, joined, cipher, mac);
    assert.deepEqual(read, [room]);
    assert.deepEqual(handedKey(read[0]!), key);
    const signed = await signRoom(room, holder.certificate, holder.signer);
    await assert.rejects(sealRoom(other, signed, 0, cipher, mac), RangeError);
    await assert.rejects(signRoom({ ...room, key: 'short' }, holder.certificate, holder.signer), RangeError);
    await assert.rejects(signRoom({ ...room, decider: 'none' }, holder.certificate, holder.signer), RangeError);
    const publicOf = (seed: Uint8Array) => madeUpKey(String.fromCharCode(65 + (seed[0]! % 26)));
    const decider = publicOf(await deciderSeed(opened, 0, NAME, director.crypto));
    const held = { ...room, decider };
    assert.equal(await isHeldRoom(held, opened, director.crypto, publicOf), true);
    assert.equal(await isHeldRoom(room, opened, director.crypto, publicOf), false);
    assert.equal(await isHeldRoom({ ...held, key: keyText(random(32)) }, opened, director.crypto, publicOf), false);
    assert.equal(await isHeldRoom({ ...held, epoch: 1 }, opened, director.crypto, publicOf), false);
    for (const one of [held, { ...held, key: keyText(random(32)) }]) {
      const put = await signRoom(one, setter.certificate, setter.signer);
      batches.push(...(await sealRoom(code, put, batches.length, cipher, mac)).batches);
    }
    const all = await channelRooms(code, batches, { key: ca.publicKey, checker: ca }, null, cipher, mac);
    const kept = [];
    for (const one of all) if (await isHeldRoom(one, opened, director.crypto, publicOf)) kept.push(one);
    assert.deepEqual([all.length, kept], [4, [held]]);
  });

  it('keeps its first chart the decider signed, then its setters’ cuts and the decider’s decisions', async () => {
    const { decider, first, second, stranger, chart, put, cut, read } = await madeUpRoom();
    await put('cut', cut('u2'), first);
    assert.equal((await read()).chart, null);
    await put('chart', { ...chart, items: ['u1'], classes: [] }, first);
    await put('chart', { ...chart, items: ['u1'], classes: [] }, stranger);
    await put('chart', chart, decider);
    await put('chart', { ...chart, items: ['u1'], classes: [] }, decider);
    await put('cut', cut('u2.w1'), first);
    await put('cut', cut('u1'), stranger);
    await put('cut', cut('u1'), decider);
    await put('cut', { ...cut('u1'), subject: 'math' }, second);
    await put('cut', cut('u9'), second);
    await put('decision', cut(null), first);
    await put('decision', cut('u1'), stranger);
    await put('decision', cut('u1.w2'), decider);
    await put('cut', cut(null), second);
    const records = await read();
    assert.deepEqual(records.chart?.value, chart);
    const kinds = records.cuts.map(({ kind, record }) => [kind, record.value.item, record.certificate.publicKey]);
    assert.deepEqual(kinds, [
      ['cut', 'u2.w1', first.certificate.publicKey],
      ['decision', 'u1.w2', decider.certificate.publicKey],
      ['cut', null, second.certificate.publicKey],
    ]);
    await assert.rejects(put('chart', { ...chart, items: ['u1', 'u1'] }, decider), RangeError);
  });

  it('refuses a chart the decider signed when the decider is one of its setters', async () => {
    const { decider, chart, put, read } = await madeUpRoom();
    const [one] = chart.setters;
    await put('chart', { ...chart, setters: [{ ...one!, key: decider.certificate.publicKey }] }, decider);
    assert.equal((await read()).chart, null);
  });

  it('takes the largest chart a reader accepts', async () => {
    const { decider, chart, put, read } = await madeUpRoom();
    const items = Array.from(
      { length: CHART_MOST.items },
      (_, at) => `${String(at).padStart(4, '0')}${'x'.repeat(60)}`,
    );
    const name = (at: number) => `${'م'.repeat(76)}${String(at).padStart(4, '0')}`;
    const classes = Array.from({ length: CHART_MOST.classes }, (_, at) => ({
      name: name(at),
      position: items[at]!,
      forecast: items.at(-1)!,
    }));
    const setters = Array.from({ length: CHART_MOST.setters }, (_, at) => ({
      assignment: at.toString(16).padStart(32, '0'),
      name: name(at),
      key: madeUpKey(String.fromCharCode(65 + (at % 26)), at >= 26 ? 'Q' : 'A'),
    }));
    const largest = { ...chart, items, classes, setters };
    assert.equal(isExamChart(largest), true);
    await put('chart', largest, decider);
    assert.deepEqual((await read()).chart?.value, largest);
  });
});
