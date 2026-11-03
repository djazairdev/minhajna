// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The uses of an inspector's grant (#594, answer 622): the key of a week's
// uses that the inspector's device gets with the week's key is the one a
// holder of the school key derives for the week's teacher, and another week's
// or course's differs; a use sealed on that week's stream reads back with the
// teacher's key, a record repeated once, a use with a forged proof beside the
// genuine one, which alone checks against the school's record of the grant, a
// stray record or one under another key left out; a use not of its shape is
// refused, and no use key is given for a course that is no ID, a day that is
// none, or an epoch the keyring lacks. Every school, course and device here is
// made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkUse,
  grantUseKey,
  inspectorFingerprint,
  makeGrant,
  newId,
  openGrant,
  openGrantUses,
  parseDay,
  readGrantUse,
  sealGrantUse,
  startKeyring,
  usePlace,
  useGrant,
  GRANT_USE,
  GRANT_USE_BATCHES,
  type OpenedGrant,
} from '../src/index.ts';
import { sealRecord } from '../src/sealed-stream.ts';
import { device, random, SCHOOL } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';

const [first, second] = [parseDay('2026-11-01'), parseDay('2026-11-08')];
const [during, later] = [parseDay('2026-11-10'), parseDay('2026-11-12')];

async function granted() {
  const [director, inspector] = [await device(), await device()];
  const school = await startKeyring(SCHOOL, director.holder, director.crypto, random);
  const [course, other] = [newId(random), newId(random)];
  const terms = {
    id: newId(random),
    inspector: inspector.holder,
    fingerprint: await inspectorFingerprint(inspector.holder.publicKey, inspector.crypto),
    weeks: [
      { course, week: first, epoch: 0 },
      { course, week: second, epoch: 0 },
      { course: other, week: first, epoch: 0 },
    ],
    from: parseDay('2026-11-02'),
    until: parseDay('2026-11-20'),
  };
  const grant = await makeGrant(school, terms, director.holder.id, director.crypto);
  const opened = (await openGrant(grant, during, inspector.holder.id, inspector.crypto)) as OpenedGrant;
  const take = async (which: string, week = first, day = during) =>
    (await useGrant(opened, which, week, day, inspector.crypto))!;
  return { director, school, course, other, grant, take };
}

describe('the uses of a grant', () => {
  it('go on the week’s stream under the key its teacher gets, a forged one beside the genuine', async () => {
    const { director, school, course, other, grant, take } = await granted();
    const used = await take(course);
    const teachers = await grantUseKey(school, grant, course, first, director.crypto);
    assert.deepEqual(used.useKey, teachers);
    assert.notDeepEqual((await take(other)).useKey, teachers);
    const again = await take(course, second);
    assert.notDeepEqual(again.useKey, teachers);
    assert.deepEqual(again.useKey, await grantUseKey(school, grant, course, second, director.crypto));
    const place = await usePlace(teachers, mac);
    const tomorrow = await take(course, first, later);
    const forged = { ...tomorrow.use, proof: 'f'.repeat(64) };
    const batches = [];
    for (const one of [used.use, used.use, forged, tomorrow.use]) {
      batches.push(...(await sealGrantUse(place, one, batches.length, cipher)));
    }
    const raw = async (value: object) =>
      batches.push(...(await sealRecord(place, value, batches.length, GRANT_USE_BATCHES, cipher)));
    await raw({ format: 'something else' });
    await raw({ format: GRANT_USE, ...used.use, note: 'x' });
    const read = await openGrantUses(place, batches, cipher);
    assert.deepEqual(read, [used.use, forged, tomorrow.use]);
    const checked = [];
    for (const one of read) checked.push(await checkUse(school, grant, one, director.crypto));
    assert.deepEqual(checked, [true, false, true]);
    assert.deepEqual(await openGrantUses(await usePlace(again.useKey, mac), batches, cipher), []);
  });

  it('refuses a use not of its shape, and a use key for no week or a missing epoch', async () => {
    const { director, school, course, grant, take } = await granted();
    const { use } = await take(course);
    assert.deepEqual(readGrantUse({ ...use }), use);
    const broken = [
      { ...use, note: 'hello' },
      { ...use, format: GRANT_USE },
      { ...use, grant: 'not-an-id' },
      { ...use, week: '2026-13-01' },
      { ...use, epoch: -1 },
      { ...use, proof: 'ab' },
    ];
    for (const one of broken) assert.equal(readGrantUse(one), null, JSON.stringify(one));
    const place = await usePlace(await grantUseKey(school, grant, course, first, director.crypto), mac);
    assert.throws(() => sealGrantUse(place, { ...use, proof: 'ab' }, 0, cipher), RangeError);
    await assert.rejects(grantUseKey(school, grant, 'not-an-id', first, director.crypto), RangeError);
    await assert.rejects(grantUseKey(school, grant, course, '2026-13-01' as never, director.crypto), RangeError);
    for (const epoch of [1, -1, 0.5]) {
      const moved = { ...grant, log: { ...grant.log, epoch } };
      await assert.rejects(grantUseKey(school, moved, course, first, director.crypto), RangeError);
    }
  });
});
