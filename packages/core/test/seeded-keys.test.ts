// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A seeded world's keys record (#548, answer 625): it reads back exactly as
// written for its own world, sealed on the national space under a place the
// world's sealing key names, a seeded world's in under half its most batches
// and one far larger refused; one with anything else, or naming a school, a
// space, a device or a teacher twice, does not read and is never sealed; and of
// the records at the place the first that reads counts. Every key is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  openSeededKeys,
  readSeededKeys,
  sealSeededKeys,
  SEEDED_KEYS_BATCHES,
  SEEDED_KEYS_FORMAT,
  seededKeysPlace,
  type SeededKeys,
} from '../src/index.ts';
import { sealRecord } from '../src/sealed-stream.ts';
import { random } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';

const WORLD = 'K7QF4';
const hex = () => Buffer.from(random(16)).toString('hex');
const pkcs8 = () => Buffer.from(random(138)).toString('base64');
const SPACES = ['c2Nob29sLW9uZS1vZi10aGUtZGVtbw', 'c2Nob29sLXR3by1vZi10aGUtZGVtbw'];

function keys(world = WORLD): SeededKeys {
  return {
    format: SEEDED_KEYS_FORMAT,
    world,
    schools: SPACES.map((space, at) => ({
      seed: `school-${at + 1}`,
      space,
      device: hex(),
      agreement: pkcs8(),
      teachers: [1, 2].map((one) => ({ seed: `teacher-${at * 2 + one}`, device: hex(), signing: pkcs8() })),
    })),
  };
}

describe('a seeded world’s keys', () => {
  it('read back exactly for their world, and nothing else does', () => {
    const made = keys();
    assert.deepEqual(readSeededKeys(JSON.parse(JSON.stringify(made)), WORLD), made);
    const [one, two] = made.schools as [SeededKeys['schools'][number], SeededKeys['schools'][number]];
    const teacher = one.teachers[0]!;
    for (const bad of [
      { ...made, world: 'ABCDE' },
      { ...made, format: 'minhajna/seeded-keys/2' },
      { ...made, extra: 1 },
      { ...made, schools: [{ ...one, extra: 1 }, two] },
      { ...made, schools: [{ ...one, teachers: [{ ...teacher, extra: 1 }] }, two] },
      { ...made, schools: [{ ...one, seed: 'School 1' }, two] },
      { ...made, schools: [{ ...one, space: 'short' }, two] },
      { ...made, schools: [{ ...one, device: 'not a device' }, two] },
      { ...made, schools: [{ ...one, agreement: 'not base64!' }, two] },
      { ...made, schools: [{ ...one, teachers: [{ ...teacher, signing: '' }] }, two] },
      { ...made, schools: [{ ...one, teachers: 'none' }, two] },
      { ...made, schools: [one, { ...two, seed: one.seed }] },
      { ...made, schools: [one, { ...two, space: one.space }] },
      { ...made, schools: [one, { ...two, device: teacher.device }] },
      { ...made, schools: [one, { ...two, teachers: [{ ...two.teachers[0]!, seed: teacher.seed }] }] },
      null,
      [made],
    ]) {
      assert.equal(readSeededKeys(bad, WORLD), null, JSON.stringify(bad));
    }
    assert.equal(readSeededKeys(made, 'not a world'), null);
  });

  it('open from the world’s place alone, the first that reads counting, and seal only when they read', async () => {
    const sealing = random(32);
    const place = await seededKeysPlace(sealing, mac);
    const first = keys();
    const junk = await sealRecord(place, { format: SEEDED_KEYS_FORMAT, world: WORLD }, 0, SEEDED_KEYS_BATCHES, cipher);
    const batches = [...junk, ...(await sealSeededKeys(place, first, junk.length, cipher))];
    const later = await sealSeededKeys(place, keys(), batches.length, cipher);
    const all = [...batches, ...later];
    assert.deepEqual(await openSeededKeys(place, all, WORLD, cipher), first);
    assert.equal(await openSeededKeys(place, all, 'ABCDE', cipher), null);
    assert.equal(await openSeededKeys(await seededKeysPlace(random(32), mac), all, WORLD, cipher), null);
    assert.equal(await openSeededKeys(place, [], WORLD, cipher), null);
    const twice = { ...first, schools: [first.schools[0]!, first.schools[0]!] };
    await assert.rejects(sealSeededKeys(place, twice, 0, cipher), RangeError);
    const many = (count: number) => ({
      ...first,
      schools: [
        {
          ...first.schools[0]!,
          teachers: Array.from({ length: count }, (_, at) => ({
            seed: `teacher-${at + 1}`,
            device: hex(),
            signing: pkcs8(),
          })),
        },
      ],
    });
    assert.ok((await sealSeededKeys(place, many(492), 0, cipher)).length <= SEEDED_KEYS_BATCHES / 2);
    await assert.rejects(sealSeededKeys(place, many(1600), 0, cipher), RangeError);
  });
});
