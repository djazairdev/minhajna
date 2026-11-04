// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// An exam committee's cut above the school (#604, answers 33, 631 and 638):
// with no vote nothing is proposed or adopted; the item most seats name is
// proposed, the one named first when they tie; the first majority adopts, an
// item or no cut, and that is final; a seat's highest version counts, the lower
// text at a tie, so an older vote put again never wins; a vote dated outside
// its days does not count; only a vote is signed, under a key for its seat and
// committee; a vote not signed by the seat it names, naming another committee,
// an item off the plan, or malformed in any way does not read, and stops no
// other from reading; and the server's stream names nothing in clear. Every
// world and committee is made up.

import assert from 'node:assert/strict';
import { createPrivateKey, generateKeyPairSync, sign as nodeSign } from 'node:crypto';
import { describe, it } from 'node:test';
import type { SealedBatch } from '../src/batches.ts';
import {
  canonicalJson,
  COMMITTEE_SEATS,
  COMMITTEE_VOTE,
  committeePlace,
  committeeSeats,
  committeeState,
  NATIONAL_COMMITTEE,
  parseDay,
  readVotes,
  sealVote,
  seatSeed,
  signVote,
  toHex,
  type CommitteeName,
  type CommitteeVote,
  type SignedVote,
  type WorldMac,
  type WorldSigner,
} from '../src/index.ts';
import { cipher, mac } from './world-crypto.ts';
import { keySigner } from './key-signers.ts';

const { verify } = keySigner();
const sign: WorldSigner = (pkcs8, text) => {
  const key = createPrivateKey({ key: Buffer.from(pkcs8, 'base64'), format: 'der', type: 'pkcs8' });
  return Promise.resolve(nodeSign('sha256', Buffer.from(text, 'utf8'), key).toString('base64'));
};
const newPair = () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    spki: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
    pkcs8: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
  };
};

const WORLD = 'K7QF4';
const name: CommitteeName = { world: WORLD, scope: 'dir-1', exam: 'mock', subject: 'math', grade: '4am' };
const days = { from: parseDay('2030-04-25'), to: parseDay('2030-05-07') };
const on = parseDay('2030-04-28');
const vote = (seat: number, item: string | null, version = 0, day = on): CommitteeVote => ({
  ...name,
  seat,
  item,
  day,
  version,
});
const state = (...votes: CommitteeVote[]) =>
  committeeState(
    votes.map((one) => ({ vote: one })),
    COMMITTEE_SEATS.directorate,
    days,
  );

describe('an exam committee’s cut', () => {
  it('proposes the item most seats name, the one named first when they tie', () => {
    assert.deepEqual([state().proposed, state().adopted, state().majority], [null, null, 2]);
    assert.deepEqual(state(vote(0, 'u6')).proposed, { item: 'u6', seats: [0] });
    assert.deepEqual(state(vote(0, 'u6'), vote(1, 'u5')).proposed, { item: 'u6', seats: [0] });
    assert.deepEqual(state(vote(0, null)).proposed, null);
    assert.deepEqual(state(vote(0, null), vote(1, 'u5')).proposed, { item: 'u5', seats: [1] });
    assert.deepEqual(state(vote(0, 'u6'), vote(0, 'u5', 1)).proposed, { item: 'u5', seats: [0] });
    const early = vote(0, 'u6', 0, parseDay('2030-04-24'));
    assert.deepEqual(state(early, vote(1, 'u5'), vote(2, 'u6')).proposed, { item: 'u5', seats: [1] });
    const older = [vote(0, null, 1), vote(0, 'u6'), vote(1, 'u5'), vote(2, 'u6')];
    assert.deepEqual(state(...older).proposed, { item: 'u5', seats: [1] });
  });

  it('adopts at the first majority, an item or no cut, and that is final', () => {
    const adopted = state(vote(0, 'u6'), vote(1, 'u6', 0, parseDay('2030-04-29')), vote(2, 'u5'), vote(0, 'u5', 1));
    assert.deepEqual(adopted.adopted, { item: 'u6', seats: [0, 1], day: parseDay('2030-04-29') });
    assert.equal(adopted.proposed, null);
    assert.deepEqual(state(vote(0, null), vote(1, null)).adopted, { item: null, seats: [0, 1], day: on });
    const backdated = state(vote(0, 'u6', 0, parseDay('2030-04-29')), vote(1, 'u6'));
    assert.deepEqual(backdated.adopted?.day, parseDay('2030-04-29'));
    const beyond = state(vote(3, 'u6'), vote(4, 'u6'));
    assert.deepEqual([beyond.adopted, beyond.votes.size], [null, 0]);
    assert.deepEqual(
      [committeeSeats({ scope: 'dir-1' }), committeeSeats({ scope: NATIONAL_COMMITTEE })],
      [COMMITTEE_SEATS.directorate, COMMITTEE_SEATS.national],
    );
    const five = (...votes: CommitteeVote[]) =>
      committeeState(
        votes.map((one) => ({ vote: one })),
        COMMITTEE_SEATS.national,
        days,
      );
    const two = five(vote(0, 'u6'), vote(1, 'u6'));
    assert.deepEqual([two.adopted, two.proposed?.seats, two.majority], [null, [0, 1], 3]);
    assert.deepEqual(five(vote(0, 'u6'), vote(1, 'u6'), vote(4, 'u6')).adopted?.seats, [0, 1, 4]);
    assert.deepEqual(five(vote(0, 'u6'), vote(1, 'u5'), vote(2, 'u5')).proposed, { item: 'u5', seats: [1, 2] });
    assert.deepEqual(five(vote(0, 'u6'), vote(0, 'u5', 1), vote(1, 'u6')).proposed, { item: 'u6', seats: [1] });
  });

  it('counts a seat’s highest version, the lower text at a tie, and only votes dated within its days', () => {
    assert.deepEqual(state(vote(0, 'u6', 1), vote(0, 'u5', 0)).votes.get(0)?.item, 'u6');
    assert.deepEqual(state(vote(0, 'u6'), vote(0, 'u5', 1), vote(1, 'u6')).adopted, null);
    assert.equal(state(vote(0, 'u6'), vote(0, 'u5')).votes.get(0)?.item, 'u5');
    assert.equal(state(vote(0, 'u5'), vote(0, 'u6')).votes.get(0)?.item, 'u5');
    const early = vote(0, 'u6', 0, parseDay('2030-04-24'));
    const late = vote(1, 'u6', 0, parseDay('2030-05-08'));
    const out = state(early, late);
    assert.deepEqual([out.votes.size, out.proposed], [0, null]);
    assert.equal(state(vote(0, 'u6', 0, days.from), vote(1, 'u6', 0, days.to)).adopted?.item, 'u6');
  });

  it('signs a vote only, and derives a key for each seat and committee', async () => {
    const pair = newPair();
    await assert.rejects(signVote({ ...vote(0, 'u6'), seat: -1 }, pair.pkcs8, sign), RangeError);
    await assert.rejects(signVote({ ...vote(0, 'u6'), item: 'not an item' }, pair.pkcs8, sign), RangeError);
    await assert.rejects(signVote({ ...vote(0, 'u6'), seat: 0.5 }, pair.pkcs8, sign), RangeError);
    await assert.rejects(signVote({ ...vote(0, 'u6'), version: -1 }, pair.pkcs8, sign), RangeError);
    const sealing = new Uint8Array(32).fill(7);
    const seed = toHex(await seatSeed(sealing, name, 0, mac));
    const others: CommitteeName[] = [
      { ...name, scope: 'dir-2' },
      { ...name, exam: 'other' },
      { ...name, subject: 'arabic' },
      { ...name, grade: '3am' },
    ];
    for (const other of others) assert.notEqual(seed, toHex(await seatSeed(sealing, other, 0, mac)));
    assert.notEqual(seed, toHex(await seatSeed(sealing, name, 1, mac)));
    const asked: string[] = [];
    const recording: WorldMac = (key, data) => {
      asked.push(new TextDecoder().decode(data));
      return mac(key, data);
    };
    await seatSeed(sealing, name, 0, recording);
    await committeePlace(sealing, name, recording);
    assert.deepEqual(
      asked.slice(0, 2),
      ['seat-0', 'room'].map((purpose) => `minhajna/committee/${purpose}\ndir-1\nmock\nmath\n4am`),
    );
    await assert.rejects(seatSeed(sealing, name, -1, mac), RangeError);
    await assert.rejects(seatSeed(sealing, name, 0.5, mac), RangeError);
    await assert.rejects(seatSeed(sealing, { ...name, scope: 'nowhere' }, 0, mac), RangeError);
    await assert.rejects(seatSeed(sealing, { ...name, world: 'nowhere!' }, 0, mac), RangeError);
    for (const field of ['exam', 'subject', 'grade'])
      await assert.rejects(committeePlace(sealing, { ...name, [field]: 'a\nb' }, mac), RangeError);
  });

  it('reads only well-formed votes signed by the seat they name, of this committee, under its key', async () => {
    const sealing = new Uint8Array(32).fill(7);
    const [one, two, three] = [newPair(), newPair(), newPair()];
    const seats = [one.spki, two.spki, three.spki];
    const room = { name, seats, items: new Set(['item-marker-six', 'item-marker-five']) };
    const place = await committeePlace(sealing, name, mac);
    const batches: SealedBatch[] = [];
    const raw = async (value: unknown) =>
      batches.push(...(await sealVote(place, value as never, batches.length, cipher)));
    const put = async (value: CommitteeVote, pkcs8: string) => raw(await signVote(value, pkcs8, sign));
    const marked = 'item-marker-six';
    await put(vote(0, marked), one.pkcs8);
    await put(vote(1, marked), one.pkcs8);
    const others: CommitteeName[] = [
      { ...name, world: 'B7QF4' },
      { ...name, scope: 'dir-2' },
      { ...name, exam: 'other' },
      { ...name, subject: 'arabic' },
      { ...name, grade: '3am' },
    ];
    for (const other of others) await put({ ...vote(2, marked), ...other }, three.pkcs8);
    await put(vote(2, 'not-on-the-plan'), three.pkcs8);
    const signed = async (text: string) =>
      raw({ text, signature: await sign(three.pkcs8, `${COMMITTEE_VOTE}\n${text}`) });
    const good = canonicalJson(vote(2, marked));
    await signed('é');
    await signed(good.replace('"seat":2', '"seat":1e999'));
    await signed(good.replace('"version":0', '"version":1e999'));
    await signed(canonicalJson({ ...vote(2, marked), more: 1 }));
    await signed(` ${good}`);
    await signed(canonicalJson({ ...vote(2, marked), day: [on] }));
    await signed(canonicalJson({ ...vote(2, marked), day: '2030-02-30' }));
    await signed(canonicalJson({ ...vote(2, marked), version: 0.5 }));
    await raw({ text: good, signature: await sign(three.pkcs8, good) });
    for (const value of [null, [], 'text']) await raw(value);
    await put(vote(2, marked), three.pkcs8);
    const flipped = batches[batches.length - 1];
    if (!flipped) throw new Error('A made-up batch is missing');
    const bytes = flipped.bytes.slice();
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1;
    batches[batches.length - 1] = { number: flipped.number, bytes };
    await put(vote(2, 'item-marker-five', 1), three.pkcs8);
    await put(vote(2, marked, 0), three.pkcs8);
    const read = await readVotes(place, batches, room, verify, cipher);
    assert.deepEqual(
      read.map(({ vote: each }) => [each.seat, each.item, each.version]),
      [
        [0, marked, 0],
        [2, 'item-marker-five', 1],
        [2, marked, 0],
      ],
    );
    assert.equal(committeeState(read, 3, days).votes.get(2)?.item, 'item-marker-five');
    const refusing = () => Promise.reject(new Error('A made-up refusal'));
    const trusting: SignedVote[] = [
      await signVote({ ...vote(2, marked), seat: 3 }, three.pkcs8, sign),
      { text: good, signature: 1 as never },
    ];
    const lone: SealedBatch[] = [];
    for (const one of trusting) lone.push(...(await sealVote(place, one, lone.length, cipher)));
    assert.deepEqual(await readVotes(place, lone, room, () => Promise.resolve(true), cipher), []);
    assert.deepEqual(await readVotes(place, batches, room, refusing, cipher), []);
    const other = await committeePlace(new Uint8Array(32).fill(8), name, mac);
    assert.notEqual(other.stream, place.stream);
    assert.deepEqual(await readVotes(other, batches, room, verify, cipher), []);
    const clear = batches.map((each) => new TextDecoder().decode(each.bytes)).join('');
    assert.equal(/item-marker|committee-vote/u.test(clear + place.stream), false);
  });

  it('reads a national committee of five, each in its own place', async () => {
    const sealing = new Uint8Array(32).fill(7);
    const national: CommitteeName = { ...name, scope: NATIONAL_COMMITTEE };
    const pairs = Array.from({ length: COMMITTEE_SEATS.national }, newPair);
    const room = { name: national, seats: pairs.map(({ spki }) => spki), items: new Set(['u6']) };
    const place = await committeePlace(sealing, national, mac);
    assert.notEqual(place.stream, (await committeePlace(sealing, name, mac)).stream);
    const batches: SealedBatch[] = [];
    for (const seat of [0, 2, 4]) {
      const signed = await signVote({ ...vote(seat, 'u6'), ...national }, pairs[seat]?.pkcs8 ?? '', sign);
      batches.push(...(await sealVote(place, signed, batches.length, cipher)));
    }
    const read = await readVotes(place, batches, room, verify, cipher);
    const stands = committeeState(read, committeeSeats(national), days);
    assert.deepEqual(stands.adopted, { item: 'u6', seats: [0, 2, 4], day: on });
  });
});
