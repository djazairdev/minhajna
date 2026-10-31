// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Keys' changes on the director's device (#571, answers 557, 558 and 599),
// against a made-up demo server: two makings at once go one after the other,
// the second renewing the first, and only its parts recover the keyring; and
// renewing when two holders look like recoveries leaves one, the new; and a
// choice the keyring no longer matches is refused. Every
// world, school and device is made up.

import {
  addHolder,
  addRecovery,
  eventOf,
  keysFacts,
  latestHeld,
  makeRecoveryParts,
  recoverKeyring,
  recoveryHolder,
  type Entry,
  type SchoolCalendar,
} from '@minhajna/core';
import { FakeStorage } from '../jest/fake-storage';
import { DemoServer, nodeKit } from '../jest/world-server';
import { recoveryDevice } from '../src/demo/recovery-device';
import { startWorld } from '../src/demo/world-session';
import { holdSchool } from '../src/director/issue-session';
import { makeRecovery } from '../src/director/keys-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { openRecordBook } from '../src/storage/history';

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const calendar: SchoolCalendar = read.calendar;
const server = new DemoServer();

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

const rings = (entries: readonly Entry[]) => [
  null,
  ...entries.flatMap((one) => {
    const event = eventOf(one);
    return event?.kind === 'school.held' ? [event.held.ring] : [];
  }),
];

/** A started world, the director's own store, and the school key held in it. */
async function director() {
  const started = await startWorld('national', calendar, nodeKit, server.send);
  const open = {
    world: started.keys.world,
    date: started.date,
    book: await openRecordBook(new FakeStorage().asSpec()),
  };
  return { open, desk: await holdSchool(open, nodeKit, server.send) };
}

async function recoveries(open: Awaited<ReturnType<typeof director>>['open']) {
  const held = latestHeld(open.book.entries, 65)!;
  const desk = await holdSchool(open, nodeKit, server.send);
  return (await keysFacts(held.ring, held.device, desk.crypto)).recoveries;
}

test('two makings at once go one after the other, and only the second recovers the keyring', async () => {
  const { open, desk } = await director();
  const [one, two] = await Promise.all([
    makeRecovery(open, desk, nodeKit, 'make'),
    makeRecovery(open, desk, nodeKit, 'renew'),
  ]);
  expect(one.parts).not.toEqual(two.parts);
  expect(one.fingerprint).not.toBe(two.fingerprint);
  expect(await recoveries(open)).toHaveLength(1);
  const held = latestHeld(open.book.entries, 65)!;
  const device = recoveryDevice(nodeKit);
  const all = rings(open.book.entries);
  expect(typeof (await recoverKeyring(held.school, all, two.parts, desk.crypto, device))).toBe('object');
  expect(await recoverKeyring(held.school, all, one.parts, desk.crypto, device)).toBe('replaced');
});

test('renewing when two holders look like recoveries leaves one, the new', async () => {
  const { open, desk } = await director();
  const device = recoveryDevice(nodeKit);
  const first = await addRecovery(
    desk.opened,
    makeRecoveryParts(nodeKit.random),
    desk.held.device,
    desk.crypto,
    device,
  );
  const school = desk.opened.ring.school;
  const other = await recoveryHolder(school, makeRecoveryParts(nodeKit.random), desk.held.device, desk.crypto, device);
  const second = await addHolder(first, other.holder, desk.held.device, desk.crypto);
  for (const change of [first, second]) {
    await open.book.record(open.date, { kind: 'school.held', held: { ...desk.held, ring: change.ring } });
  }
  expect(await recoveries(open)).toHaveLength(2);
  const made = await makeRecovery(open, await holdSchool(open, nodeKit, server.send), nodeKit, 'renew');
  expect(await recoveries(open)).toHaveLength(1);
  const held = latestHeld(open.book.entries, 65)!;
  const recovered = await recoverKeyring(held.school, rings(open.book.entries), made.parts, desk.crypto, device);
  expect(typeof recovered).toBe('object');
});

test('a choice the keyring no longer matches is refused', async () => {
  const { open, desk } = await director();
  await expect(makeRecovery(open, desk, nodeKit, 'renew')).rejects.toMatchObject({ code: 'E_KEYRING_CHANGED' });
  await makeRecovery(open, desk, nodeKit, 'make');
  const before = rings(open.book.entries).length;
  await expect(makeRecovery(open, desk, nodeKit, 'make')).rejects.toMatchObject({ code: 'E_KEYRING_CHANGED' });
  expect(rings(open.book.entries)).toHaveLength(before);
});
