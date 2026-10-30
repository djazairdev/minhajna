// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The timetable key (#552): a preparer's device opens the school's timetables
// and assignments and no pupil record, lesson record or confirmation status;
// only a holder of the school key gives or takes it, and a change a preparer
// makes, whoever it names, is refused by the school's devices and the other
// preparers, also with a device removed from the school key; every preparer
// can be removed; it follows the school key's devices, dropping a device
// before its removal; and the school's recovery opens it. Every school,
// device and record is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  acceptTimetableChange,
  addHolder,
  addPreparer,
  addRecovery,
  admission,
  admitPreparer,
  followSchool,
  holderQr,
  latestEpoch,
  makeRecoveryParts,
  newHolderSecret,
  openKeyring,
  pendingDrops,
  preparersOf,
  purposeKey,
  readHolderQr,
  recoverKeyring,
  recoverTimetableKey,
  removeHolder,
  removePreparer,
  startKeyring,
  startTimetableKey,
  timetableKey,
  type HeldTimetable,
  type OpenedKeyring,
  type Recovered,
  type TimetablePurpose,
} from '../src/index.ts';
import { grantOf, preparerSecret, vouchOf } from '../src/timetable-change.ts';
import { device, opened, opensRecord, random, recoveryDevice, SCHOOL, sealRecord } from './school-devices.ts';

const SPACE = 'made-up-timetable-space-of-the-demo';
type Device = Awaited<ReturnType<typeof device>>;

const holdsIt = (one: HeldTimetable, who: Device) => one.opened.ring.holders.some((h) => h.id === who.holder.id);

function held(result: HeldTimetable | string): HeldTimetable {
  assert.notEqual(typeof result, 'string', typeof result === 'string' ? result : '');
  return result as HeldTimetable;
}

/** A preparer added by `by`, and its device's first keyring, opened by its admission. */
async function prepare(table: HeldTimetable, school: OpenedKeyring, by: Device) {
  const preparer = await device();
  const secret = newHolderSecret(random);
  const scanned = readHolderQr(holderQr(preparer.holder, secret))!;
  const step = await addPreparer(table, school, scanned.holder, by.holder.id, by.crypto);
  const admitted = await admission(step.change.ring, secret, by.crypto);
  const mine = held(await admitPreparer(step.change, admitted, preparer.holder.id, secret, preparer.crypto));
  return { preparer, step, mine };
}

async function school() {
  const [director, deputy] = [await device(), await device()];
  const one = await startKeyring(SCHOOL, director.holder, director.crypto, random);
  const two = await addHolder(one, deputy.holder, director.holder.id, director.crypto);
  const started = await startTimetableKey(two, SPACE, director.holder.id, director.crypto, random);
  const table = started.at(-1)!;
  return { director, deputy, two, started, table, ...(await prepare(table, two, deputy)) };
}

describe('the timetable key', () => {
  it('opens timetables and assignments, and no pupil record, lesson record or confirmation status', async () => {
    const { director, preparer, two, started, step, mine } = await school();
    assert.equal(started.length, 2);
    assert.deepEqual(preparersOf(step), [preparer.holder]);
    assert.equal(mine.secret, await preparerSecret(two, 0, preparer.holder.id, director.crypto));
    for (const purpose of ['timetables', 'assignments'] as const) {
      const sealed = await sealRecord(await timetableKey(step.opened, 0, purpose, director.crypto));
      assert.equal(await opensRecord(await timetableKey(mine.opened, 0, purpose, preparer.crypto), sealed), true);
    }

    assert.equal(await openKeyring(two.ring, preparer.holder.id, preparer.crypto), 'removed');
    const keys = [...mine.opened.keys];
    for (const purpose of ['timetables', 'assignments'] as const) {
      keys.push(await timetableKey(mine.opened, 0, purpose, preparer.crypto));
    }
    for (const purpose of ['pupil-records', 'lesson-records', 'confirmations']) {
      const record = await sealRecord(await purposeKey(two, 0, purpose, director.crypto));
      for (const key of [...keys, await purposeKey(mine.opened, 0, purpose, preparer.crypto)]) {
        assert.equal(await opensRecord(key, record), false, purpose);
      }
    }
    await assert.rejects(timetableKey(mine.opened, 0, 'records' as TimetablePurpose, preparer.crypto), /only/);
    await assert.rejects(startTimetableKey(two, SCHOOL, director.holder.id, director.crypto, random), /own/);
    await assert.rejects(startTimetableKey(two, SPACE, preparer.holder.id, director.crypto, random), /Only a holder/);
  });

  it('refuses a change a preparer makes, whoever it names, at the school and at the other preparers', async () => {
    const { director, deputy, preparer, two, table, step, mine } = await school();
    const second = await prepare(step, two, director);
    const atSchool = (from: HeldTimetable, change: unknown) =>
      acceptTimetableChange(from, change, two, director.holder.id, director.crypto);
    const asPreparer = (from: HeldTimetable, change: unknown, who = preparer) =>
      acceptTimetableChange(from, change, null, who.holder.id, who.crypto);
    const next = held(await atSchool(table, step.change));
    assert.deepEqual(held(await atSchool(next, second.step.change)).opened.keys, second.step.opened.keys);
    const theirs = held(await asPreparer(mine, second.step.change));

    const puppet = await device();
    const passed = await addHolder(theirs.opened, puppet.holder, director.holder.id, preparer.crypto);
    const forged = { ...second.step.change, ring: passed.ring };
    assert.equal(await atSchool(second.step, forged), 'forked');
    assert.equal(await asPreparer(second.mine, forged, second.preparer), 'forked');
    assert.equal(await asPreparer(second.mine, { ...forged, vouched: {} }, second.preparer), 'forked');
    for (const shape of [{ ...forged, extra: 1 }, { ...forged, epoch: -1 }, { ...forged, preparers: ['a'] }, null]) {
      assert.equal(await atSchool(second.step, shape), 'forged');
    }
    await assert.rejects(addPreparer(theirs, two, puppet.holder, preparer.holder.id, preparer.crypto), /Only a holder/);

    const planted = await addPreparer(second.step, two, puppet.holder, deputy.holder.id, deputy.crypto);
    const bare = held(await atSchool(second.step, { ...planted.change, renewed: {} }));
    const unplanted = await removePreparer(bare, two, puppet.holder.id, director.holder.id, director.crypto, random);
    assert.deepEqual(held(await atSchool(bare, unplanted.change)).opened.keys, unplanted.opened.keys);

    const remove = (id: string) => removePreparer(second.step, two, id, deputy.holder.id, deputy.crypto, random);
    await assert.rejects(remove(deputy.holder.id), /Not a preparer/);
    const taken = await remove(preparer.holder.id);
    assert.deepEqual(held(await atSchool(second.step, taken.change)).opened.keys, taken.opened.keys);
    assert.equal(await asPreparer(theirs, taken.change), 'removed');
    assert.deepEqual(preparersOf(taken), [second.preparer.holder]);
    const epoch = latestEpoch(taken.opened);
    const sealed = await sealRecord(await timetableKey(taken.opened, epoch, 'timetables', deputy.crypto));
    for (const [index] of theirs.opened.keys.entries()) {
      const key = await timetableKey(theirs.opened, index, 'timetables', preparer.crypto);
      assert.equal(await opensRecord(key, sealed), false);
    }
  });

  it('drops a device before its removal from the school key, so that it cannot vouch with a preparer', async () => {
    const { director, deputy, preparer, two, table, step, mine } = await school();
    const second = await prepare(step, two, director);
    const phone = await device();
    const three = await addHolder(two, phone.holder, director.holder.id, director.crypto);
    const drop = { drop: [deputy.holder.id] };
    const first = await followSchool(second.step, three, director.holder.id, director.crypto, random, drop);
    assert.equal(first.length, 2);
    const dropped = first.at(-1)!;
    const ids = [director, preparer, second.preparer, phone].map((one) => one.holder.id);
    assert.deepEqual(
      dropped.opened.ring.holders.map((one) => one.id),
      ids,
    );
    assert.equal(await openKeyring(dropped.opened.ring, deputy.holder.id, deputy.crypto), 'removed');
    assert.deepEqual(first[0]!.change.dropped, [deputy.holder.id]);
    assert.deepEqual(await followSchool(dropped, three, phone.holder.id, phone.crypto, random), []);
    const restored = { restore: [deputy.holder.id] };
    const back = await followSchool(dropped, three, phone.holder.id, phone.crypto, random, restored);
    assert.deepEqual(back.length, 1);
    assert.equal(holdsIt(back[0]!, deputy), true);
    assert.deepEqual(back[0]!.change.dropped, []);

    const four = await removeHolder(three, deputy.holder.id, director.holder.id, director.crypto, random);
    const after = await followSchool(dropped, four, director.holder.id, director.crypto, random);
    assert.equal(after.length, 1);
    const last = after[0]!;
    assert.deepEqual(last.opened.ring.holders, dropped.opened.ring.holders);
    assert.equal(last.opened.keys.length, dropped.opened.keys.length + 1);
    assert.deepEqual(opened(await openKeyring(last.opened.ring, phone.holder.id, phone.crypto)).keys, last.opened.keys);
    assert.deepEqual(await followSchool(last, four, director.holder.id, director.crypto, random), []);
    await assert.rejects(
      followSchool(last, four, director.holder.id, director.crypto, random, { drop: [director.holder.id] }),
      /drop itself/,
    );

    const asPreparer = (from: HeldTimetable, change: unknown, who: Device) =>
      acceptTimetableChange(from, change, null, who.holder.id, who.crypto);
    let theirs = held(await asPreparer(mine, second.step.change, preparer));
    let others = second.mine;
    for (const { change } of [...first, last]) {
      theirs = held(await asPreparer(theirs, change, preparer));
      others = held(await asPreparer(others, change, second.preparer));
    }
    assert.deepEqual(theirs.opened.keys, last.opened.keys);
    assert.equal(theirs.secret, await preparerSecret(four, 1, preparer.holder.id, director.crypto));

    const passed = await addHolder(theirs.opened, (await device()).holder, director.holder.id, preparer.crypto);
    const colluded = { ring: passed.ring, epoch: 0, preparers: last.change.preparers, dropped: [], renewed: {} };
    const other = second.preparer.holder.id;
    const old = await preparerSecret(two, 0, other, deputy.crypto);
    const vouched = { [other]: await vouchOf(old, theirs.opened, colluded, other, preparer.crypto) };
    const change = { ...colluded, grant: await grantOf(two, colluded, deputy.crypto), vouched };
    const read = (from: HeldTimetable, one: unknown, school: OpenedKeyring) =>
      acceptTimetableChange(from, one, school, director.holder.id, director.crypto);
    assert.equal(await read(last, change, four), 'forked');
    assert.equal(await asPreparer(others, change, second.preparer), 'forked');

    let caught = held(await read(table, step.change, three));
    for (const one of [second.step, ...first]) caught = held(await read(caught, one.change, three));
    assert.equal(await read(caught, last.change, three), 'behind');
    caught = held(await read(caught, last.change, four));
    assert.deepEqual(caught.opened.keys, last.opened.keys);
    await assert.rejects(followSchool(second.step, four, deputy.holder.id, deputy.crypto, random), /Only a holder/);
  });

  it('names a drop that changes no holder until a restore undoes it, and keeps the recovery', async () => {
    const director = await device();
    const late = await device();
    const one = await startKeyring(SCHOOL, director.holder, director.crypto, random);
    const two = await addRecovery(one, makeRecoveryParts(random), director.holder.id, director.crypto, recoveryDevice);
    const table = (await startTimetableKey(two, SPACE, director.holder.id, director.crypto, random)).at(-1)!;
    const three = await addHolder(two, late.holder, director.holder.id, director.crypto);
    const follow = (from: HeldTimetable, options = {}) =>
      followSchool(from, three, director.holder.id, director.crypto, random, options);
    const [named] = await follow(table, { drop: [late.holder.id] });
    assert.deepEqual(named!.change.dropped, [late.holder.id]);
    assert.deepEqual(named!.opened.ring.holders, table.opened.ring.holders);
    assert.deepEqual(pendingDrops(named!, three.ring), [late.holder.id]);
    assert.deepEqual(await follow(named!), []);
    const [back] = await follow(named!, { restore: [late.holder.id] });
    assert.equal(holdsIt(back!, late), true);
    assert.deepEqual(pendingDrops(back!, three.ring), []);
    await assert.rejects(follow(table, { drop: [two.ring.holders[1]!.id] }), /recovery stays/);
  });

  it('opens with the school’s recovery when every device is lost', async () => {
    const director = await device();
    const one = await startKeyring(SCHOOL, director.holder, director.crypto, random);
    const parts = makeRecoveryParts(random);
    const two = await addRecovery(one, parts, director.holder.id, director.crypto, recoveryDevice);
    const started = await startTimetableKey(two, SPACE, director.holder.id, director.crypto, random);
    const rings = [one.ring, two.ring];
    const back = (await recoverKeyring(SCHOOL, rings, parts, director.crypto, recoveryDevice)) as Recovered;
    assert.notEqual(typeof back, 'string');
    const space = [null, ...started.map((step) => step.change)];
    const table = held(await recoverTimetableKey(back.opened, back.recovery, space));
    assert.deepEqual(table.opened.keys, started.at(-1)!.opened.keys);
    const others = [{ ...started[1]!.change, grant: '0'.repeat(64) }];
    assert.equal(await recoverTimetableKey(back.opened, back.recovery, others), 'wrong');
  });
});
