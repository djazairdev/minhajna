// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Grants for inspectors (#553): an inspector's device opens the signed
// weeks a grant names, course by course, only between its dates by the
// world's date, with an entry for the teacher's access log each time that
// the school's devices check, and nothing else: no other week, no pupil
// record, no confirmation status. The server can neither move a grant's
// dates nor give it to another device, and a key that does not match the
// fingerprint confirmed gets no grant. Every school, course, device and
// record is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addHolder,
  checkUse,
  grantEnded,
  inspectorFingerprint,
  makeGrant,
  newId,
  openGrant,
  parseDay,
  purposeKey,
  signedWeekKey,
  startKeyring,
  useGrant,
  type GrantTerms,
  type OpenedGrant,
} from '../src/index.ts';
import { device, opensRecord, random, SCHOOL, sealRecord } from './school-devices.ts';

const [first, second] = [parseDay('2026-11-01'), parseDay('2026-11-08')];
const [from, during, until] = [parseDay('2026-11-02'), parseDay('2026-11-10'), parseDay('2026-11-20')];

async function school() {
  const [director, deputy, inspector] = [await device(), await device(), await device()];
  const one = await startKeyring(SCHOOL, director.holder, director.crypto, random);
  const two = await addHolder(one, deputy.holder, director.holder.id, director.crypto);
  const [course, other] = [newId(random), newId(random)];
  const fingerprint = await inspectorFingerprint(inspector.holder.publicKey, inspector.crypto);
  const terms: GrantTerms = {
    id: newId(random),
    inspector: inspector.holder,
    fingerprint,
    weeks: [{ course, week: first, epoch: 0 }],
    from,
    until,
  };
  const grant = await makeGrant(two, terms, deputy.holder.id, deputy.crypto);
  return { director, deputy, inspector, two, course, other, terms, grant };
}

describe('a grant to an inspector', () => {
  it('opens the signed weeks it names between its dates, with an entry for the teacher’s access log', async () => {
    const { director, inspector, two, course, other, terms, grant } = await school();
    const open = (day = during) => openGrant(grant, day, inspector.holder.id, inspector.crypto);
    assert.equal(await open(parseDay('2026-11-01')), 'not-yet');
    assert.equal(await open(parseDay('2026-11-21')), 'ended');
    assert.equal(grantEnded(grant, until), false);
    assert.equal(grantEnded(grant, parseDay('2026-11-21')), true);
    const opened = (await open()) as OpenedGrant;
    assert.notEqual(typeof opened, 'string');

    const archived = await sealRecord(await signedWeekKey(two, 0, course, first, inspector.crypto));
    const use = (course: string, week = first, day = during) => useGrant(opened, course, week, day, inspector.crypto);
    const used = (await use(course))!;
    assert.equal(await opensRecord(used.key, archived), true);
    const { proof, ...entry } = used.use;
    assert.deepEqual(entry, {
      grant: terms.id,
      inspector: inspector.holder.id,
      course,
      week: first,
      epoch: 0,
      day: during,
    });
    assert.equal(await checkUse(two, grant, used.use, director.crypto), true);
    const after = parseDay('2026-11-21');
    for (const changed of [
      { day: after },
      { week: second },
      { proof: '0'.repeat(64) },
      { epoch: 1 },
      { course: other },
    ]) {
      assert.equal(await checkUse(two, grant, { ...used.use, ...changed }, director.crypto), false, proof);
    }
    assert.equal(await use(course, second), null);
    assert.equal(await use(other), null);
    assert.equal(await use(course, first, parseDay('2026-11-21')), null);
    assert.equal(Object.keys(opened).join(), 'grant');

    const notNamed = [
      await signedWeekKey(two, 0, course, second, inspector.crypto),
      await signedWeekKey(two, 0, other, first, inspector.crypto),
      await purposeKey(two, 0, 'pupil-records', inspector.crypto),
      await purposeKey(two, 0, 'confirmations', inspector.crypto),
      await purposeKey(two, 0, 'lesson-records', inspector.crypto),
    ];
    for (const key of notNamed) assert.equal(await opensRecord(used.key, await sealRecord(key)), false);
  });

  it('takes an access log entry only from its own inspector, even with another grant over the same week', async () => {
    const { director, deputy, two, course, terms, grant } = await school();
    const other = await device();
    const typed = (await inspectorFingerprint(other.holder.publicKey, other.crypto)).replace(/-/gu, '').toUpperCase();
    const second = await makeGrant(
      two,
      { ...terms, id: newId(random), inspector: other.holder, fingerprint: typed },
      deputy.holder.id,
      deputy.crypto,
    );
    const theirs = (await openGrant(second, during, other.holder.id, other.crypto)) as OpenedGrant;
    const used = (await useGrant(theirs, course, first, during, other.crypto))!;
    assert.equal(await checkUse(two, second, used.use, director.crypto), true);
    const blamed = { ...used.use, grant: grant.id, inspector: grant.inspector.id };
    assert.equal(await checkUse(two, grant, blamed, director.crypto), false);
    assert.equal(await checkUse(two, second, { ...used.use, day: parseDay('2026-11-01') }, director.crypto), false);
  });

  it('opens only on its inspector’s device, with the dates and weeks it was made with', async () => {
    const { director, deputy, inspector, grant } = await school();
    assert.equal(await openGrant(grant, during, director.holder.id, director.crypto), 'forged');
    const moved = { ...grant, inspector: deputy.holder };
    const relabelled = { ...grant, inspector: { ...grant.inspector, publicKey: deputy.holder.publicKey } };
    assert.equal(await openGrant(relabelled, during, inspector.holder.id, inspector.crypto), 'forged');
    assert.equal(await openGrant(moved, during, deputy.holder.id, deputy.crypto), 'forged');
    const open = (changed: unknown, day = during) => openGrant(changed, day, inspector.holder.id, inspector.crypto);
    const later = parseDay('2026-12-01');
    assert.equal(await open({ ...grant, until: parseDay('2026-12-31') }, later), 'forged');
    assert.equal(await open({ ...grant, by: director.holder.id }), 'forged');
    assert.equal(await open({ ...grant, log: { ...grant.log, epoch: 1 } }), 'forged');
    const week = grant.weeks[0]!;
    assert.equal(await open({ ...grant, weeks: [{ ...week, week: parseDay('2026-11-15') }] }), 'forged');
    for (const changed of [{ ...grant, extra: 1 }, { ...grant, weeks: [] }, { ...grant, weeks: [week, week] }, null]) {
      assert.equal(await open(changed), 'forged');
    }
  });

  it('is made only by a holder of the school key, between two days, naming each week once', async () => {
    const { deputy, inspector, two, terms } = await school();
    const make = (changed: Partial<GrantTerms>, by = deputy.holder.id) =>
      makeGrant(two, { ...terms, ...changed }, by, deputy.crypto);
    await assert.rejects(make({}, inspector.holder.id), /Only a holder/);
    await assert.rejects(make({ from: until, until: from }), /between two days/);
    await assert.rejects(make({ weeks: [...terms.weeks, ...terms.weeks] }), /each signed week once/);
    await assert.rejects(make({ weeks: [{ ...terms.weeks[0]!, epoch: 1 }] }), /each signed week once/);
    await assert.rejects(make({ weeks: [] }), /each signed week once/);
    await assert.rejects(make({ id: 'made up' }), /to a device/);
    const server = await device();
    await assert.rejects(make({ inspector: server.holder }), /fingerprint/);
    assert.match(terms.fingerprint, /^[0-9a-f]{4}(?:-[0-9a-f]{4}){3}$/u);
  });
});
