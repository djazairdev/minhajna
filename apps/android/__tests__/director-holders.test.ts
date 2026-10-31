// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school key between two devices of a national demo world (#571, answer
// 600), against a made-up demo server: the director's keyrings go on the
// school's stream the first time it is followed; a second device waits with
// its code, the same after the page closes, and starts nothing on D-Issue; the
// director adds it from the code, and it reads its keyring from the drop
// space, with the fingerprint the director sees, keeps it and follows the
// stream; the recovery made on one is adopted by the other; two changes at
// once both land, the second made again on top; removing the device that made
// the recovery renews it with new parts; and the removed device is told so.
// Every world, school and device is made up.

import { addHolder, keysFacts, readHolderQr, type SchoolCalendar } from '@minhajna/core';
import { FakeStorage } from '../jest/fake-storage';
import { DemoServer, nodeKit } from '../jest/world-server';
import { startWorld, type Send } from '../src/demo/world-session';
import { keepAdmitted, readDrop, waitToHold } from '../src/director/holder-wait';
import { addDevice, removeHolderDevice } from '../src/director/holders-session';
import { holdSchool } from '../src/director/issue-session';
import { followSchool, proposeChanges } from '../src/director/keyring-session';
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

/** A started world, and two devices in it, each with a store of its own. */
async function world() {
  const started = await startWorld('national', calendar, nodeKit, server.send);
  const device = async () => ({
    world: started.keys.world,
    date: started.date,
    book: await openRecordBook(new FakeStorage().asSpec()),
  });
  return { director: await device(), deputy: await device() };
}

/** The deputy added as a holder from its code, and the desk it then holds. */
async function added(director: Awaited<ReturnType<typeof world>>['director'], deputy: typeof director) {
  const desk = await holdSchool(director, nodeKit, server.send);
  const waiting = await waitToHold(deputy, nodeKit, server.send);
  const { fingerprint } = await addDevice(director, desk, readHolderQr(waiting.code)!, nodeKit, server.send);
  const admitted = await readDrop(deputy, waiting.waiting, nodeKit, server.send);
  if (admitted === null || admitted === 'contested') throw new Error('The deputy was not admitted');
  expect(admitted.fingerprint).toBe(fingerprint);
  return (await keepAdmitted(deputy, waiting.waiting, admitted, nodeKit, server.send)).desk;
}

test('a second device waits with its code, is added, and follows the school’s keyring', async () => {
  const { director, deputy } = await world();
  const desk = await holdSchool(director, nodeKit, server.send);
  const waiting = await waitToHold(deputy, nodeKit, server.send);
  expect((await waitToHold(deputy, nodeKit, server.send)).code).toBe(waiting.code);
  expect(waiting.fingerprint).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/u);
  await expect(holdSchool(deputy, nodeKit, server.send)).rejects.toMatchObject({ code: 'E_SCHOOL_WAITING' });
  expect(await readDrop(deputy, waiting.waiting, nodeKit, server.send)).toBeNull();
  await addDevice(director, desk, readHolderQr(waiting.code)!, nodeKit, server.send);
  const admitted = await readDrop(deputy, waiting.waiting, nodeKit, server.send);
  expect(admitted).not.toBeNull();
  if (admitted === null || admitted === 'contested') return;
  const kept = await keepAdmitted(deputy, waiting.waiting, admitted, nodeKit, server.send);
  expect(kept.desk.held.school).toBe(desk.held.school);
  await expect(waitToHold(deputy, nodeKit, server.send)).rejects.toMatchObject({ code: 'E_SCHOOL_HELD' });
  const own = await holdSchool(deputy, nodeKit, server.send);
  const facts = await keysFacts(own.opened.ring, own.held.device, own.crypto);
  expect(facts.devices).toHaveLength(2);
  const again = await followSchool(director, await holdSchool(director, nodeKit, server.send), nodeKit, server.send);
  expect(again.desk.opened.ring.tag).toBe(own.opened.ring.tag);
});

test('a recovery made on one is adopted by the other, and two changes at once both land', async () => {
  const { director, deputy } = await world();
  const deputyDesk = await added(director, deputy);
  const directorDesk = await holdSchool(director, nodeKit, server.send);
  const third = await waitToHold(
    { ...deputy, book: await openRecordBook(new FakeStorage().asSpec()) },
    nodeKit,
    server.send,
  );
  let racing = true;
  const send: Send = async (request) => {
    if (racing && request.method === 'POST' && request.path.endsWith('/batches')) {
      racing = false;
      const { holder } = readHolderQr(third.code)!;
      await proposeChanges(deputy, deputyDesk, nodeKit, server.send, async (opened) => [
        await addHolder(opened, holder, deputyDesk.held.device, deputyDesk.crypto),
      ]);
    }
    return server.send(request);
  };
  await makeRecovery(director, directorDesk, nodeKit, 'make', send);
  expect(racing).toBe(false);
  const one = await followSchool(director, directorDesk, nodeKit, server.send);
  const two = await followSchool(deputy, deputyDesk, nodeKit, server.send);
  expect(two.desk.opened.ring.tag).toBe(one.desk.opened.ring.tag);
  const facts = await keysFacts(two.desk.opened.ring, two.desk.held.device, two.desk.crypto);
  expect(facts.recoveries).toHaveLength(1);
  expect(facts.devices).toHaveLength(3);
  expect(two.orphaned).toBe(false);
});

test('removing the device that made the recovery renews it, and the removed device is told', async () => {
  const { director, deputy } = await world();
  const deputyDesk = await added(director, deputy);
  const directorDesk = await holdSchool(director, nodeKit, server.send);
  await makeRecovery(deputy, deputyDesk, nodeKit, 'make', server.send);
  const removed = await removeHolderDevice(director, directorDesk, deputyDesk.held.device, nodeKit, server.send);
  expect(removed.parts).not.toBeNull();
  const after = await followSchool(director, directorDesk, nodeKit, server.send);
  const facts = await keysFacts(after.desk.opened.ring, after.desk.held.device, after.desk.crypto);
  expect(facts.devices).toHaveLength(1);
  expect(facts.recoveries).toHaveLength(1);
  expect(after.orphaned).toBe(false);
  await expect(followSchool(deputy, deputyDesk, nodeKit, server.send)).rejects.toMatchObject({ code: 'E_KEY_REMOVED' });
  await expect(
    removeHolderDevice(director, after.desk, after.desk.held.device, nodeKit, server.send),
  ).rejects.toMatchObject({ code: 'E_REMOVE_SELF' });
  await expect(
    removeHolderDevice(director, after.desk, deputyDesk.held.device, nodeKit, server.send),
  ).rejects.toMatchObject({ code: 'E_KEYRING_CHANGED' });
});
