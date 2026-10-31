// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school keyring's edges between two devices of a national demo world
// (#571, answer 600), against a made-up demo server: a change that lands
// between following the stream and proposing is made again on top; keyrings are
// put after junk on the stream, even a stream of junk alone, and a keyring the
// stream never took is dropped for the one it took; a stream that never lets a
// change in gives up; an admission that was not written is written when the
// device is added again; a wait given up is refused; a recovery whose maker is
// gone is said; and a removed device issues nothing, while the director issues
// again every code not yet scanned under the old epoch, after a recovery
// renewed alone too. Every world, school and device is made up.

import {
  addHolder,
  addRecovery,
  keptIssues,
  keysFacts,
  keyringStream,
  latestHeld,
  makeRecoveryParts,
  readHolderQr,
  removeHolder,
  toBase64Url,
  type SchoolCalendar,
} from '@minhajna/core';
import { FakeStorage } from '../jest/fake-storage';
import { DemoServer, nodeKit } from '../jest/world-server';
import { recoveryDevice } from '../src/demo/recovery-device';
import { startWorld, type Send } from '../src/demo/world-session';
import { giveUp, keepAdmitted, readDrop, waitToHold } from '../src/director/holder-wait';
import { addDevice } from '../src/director/holders-session';
import { assignmentsOf, holdSchool, issueFor, type IssueDesk } from '../src/director/issue-session';
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

async function world() {
  const started = await startWorld('national', calendar, nodeKit, server.send);
  const device = async () => ({
    world: started.keys.world,
    date: started.date,
    book: await openRecordBook(new FakeStorage().asSpec()),
  });
  return { director: await device(), deputy: await device(), device };
}

type Device = Awaited<ReturnType<typeof world>>['director'];

async function added(director: Device, deputy: Device) {
  const desk = await holdSchool(director, nodeKit, server.send);
  const waiting = await waitToHold(deputy, nodeKit, server.send);
  await addDevice(director, desk, readHolderQr(waiting.code)!, nodeKit, server.send);
  const admitted = await readDrop(deputy, waiting.waiting, nodeKit, server.send);
  if (admitted === null || admitted === 'contested') throw new Error('The deputy was not admitted');
  return (await keepAdmitted(deputy, waiting.waiting, admitted, nodeKit, server.send)).desk;
}

test('a change that lands between following and proposing is made again on top', async () => {
  const { director, deputy, device } = await world();
  const deputyDesk = await added(director, deputy);
  const directorDesk = await holdSchool(director, nodeKit, server.send);
  const third = await waitToHold(await device(), nodeKit, server.send);
  let racing = true;
  const send: Send = async (request) => {
    const answer = await server.send(request);
    if (racing && request.method === 'GET' && request.path.includes(`/spaces/${directorDesk.held.school}/`)) {
      racing = false;
      const { holder } = readHolderQr(third.code)!;
      await proposeChanges(deputy, deputyDesk, nodeKit, server.send, async (opened) => [
        await addHolder(opened, holder, deputyDesk.held.device, deputyDesk.crypto),
      ]);
    }
    return answer;
  };
  await makeRecovery(director, directorDesk, nodeKit, 'make', send);
  expect(racing).toBe(false);
  const one = (await followSchool(director, directorDesk, nodeKit, server.send)).desk;
  const two = (await followSchool(deputy, deputyDesk, nodeKit, server.send)).desk;
  expect(two.opened.ring.tag).toBe(one.opened.ring.tag);
  const facts = await keysFacts(two.opened.ring, two.held.device, two.crypto);
  expect([facts.devices.length, facts.recoveries.length]).toEqual([3, 1]);
});

test('keyrings go after junk, a keyring the stream never took is dropped, and a closed stream gives up', async () => {
  const { director, deputy, device } = await world();
  const deputyDesk = await added(director, deputy);
  const directorDesk = (
    await followSchool(director, await holdSchool(director, nodeKit, server.send), nodeKit, server.send)
  ).desk;
  const local = await addRecovery(
    directorDesk.opened,
    makeRecoveryParts(nodeKit.random),
    directorDesk.held.device,
    directorDesk.crypto,
    recoveryDevice(nodeKit),
  );
  await director.book.record(director.date, { kind: 'school.held', held: { ...directorDesk.held, ring: local.ring } });
  const school = directorDesk.held.school;
  const stream = await keyringStream(school, nodeKit.mac);
  const path = `/worlds/${director.world}/spaces/${school}/batches`;
  const there = await server.relay.spaces.batchesAfter(director.world, school, 0, 100);
  const first = there.filter((one) => one.stream === stream).length;
  const junk = toBase64Url(nodeKit.random(4124));
  expect((await server.send({ method: 'POST', path, body: { stream, first, batches: [junk] } })).status).toBe(201);
  const third = readHolderQr((await waitToHold(await device(), nodeKit, server.send)).code)!;
  await proposeChanges(deputy, deputyDesk, nodeKit, server.send, async (opened) => [
    await addHolder(opened, third.holder, deputyDesk.held.device, deputyDesk.crypto),
  ]);
  const followed = (await followSchool(director, directorDesk, nodeKit, server.send)).desk;
  expect(followed.opened.ring.tag).not.toBe(local.ring.tag);
  expect(latestHeld(director.book.entries, 65)?.ring.tag).toBe(followed.opened.ring.tag);
  const facts = await keysFacts(followed.opened.ring, followed.held.device, followed.crypto);
  expect([facts.devices.length, facts.recoveries.length]).toEqual([3, 0]);
  const closed: Send = (request) =>
    request.method === 'POST' && request.path === path
      ? Promise.resolve({ status: 409, body: null, retryAfter: null })
      : server.send(request);
  await expect(makeRecovery(director, followed, nodeKit, 'make', closed)).rejects.toMatchObject({
    code: 'E_KEYRING_CHANGED',
  });
  expect(latestHeld(director.book.entries, 65)?.ring.tag).toBe(followed.opened.ring.tag);
});

test('an admission not written is written when added again, and a wait given up is refused', async () => {
  const { director, deputy } = await world();
  const junkFirst: Send = async (request) => {
    const answer = await server.send(request);
    const school = /\/spaces\/([^/]+)$/u.exec(request.path)?.[1];
    if (request.method === 'PUT' && school !== undefined) {
      const stream = await keyringStream(school, nodeKit.mac);
      const body = { stream, first: 0, batches: [toBase64Url(nodeKit.random(4124))] };
      await server.send({ method: 'POST', path: `${request.path}/batches`, body });
    }
    return answer;
  };
  const desk = await holdSchool(director, nodeKit, junkFirst);
  const there = await server.relay.spaces.batchesAfter(director.world, desk.held.school, 0, 10);
  expect(there.map((one) => one.number)).toEqual([0, 1]);
  const waiting = await waitToHold(deputy, nodeKit, server.send);
  const scanned = readHolderQr(waiting.code)!;
  const broken: Send = (request) =>
    request.method === 'POST' && !request.path.includes(desk.held.school)
      ? Promise.resolve({ status: 500, body: null, retryAfter: null })
      : server.send(request);
  await expect(addDevice(director, desk, scanned, nodeKit, broken)).rejects.toBeDefined();
  expect(await readDrop(deputy, waiting.waiting, nodeKit, server.send)).toBeNull();
  await addDevice(director, desk, scanned, nodeKit, server.send);
  const admitted = await readDrop(deputy, waiting.waiting, nodeKit, server.send);
  expect(admitted).not.toBeNull();
  if (admitted === null || admitted === 'contested') return;
  await giveUp(deputy);
  await expect(keepAdmitted(deputy, waiting.waiting, admitted, nodeKit, server.send)).rejects.toMatchObject({
    code: 'E_SCHOOL_WAITING',
  });
  await expect(readDrop(deputy, waiting.waiting, nodeKit, server.send)).rejects.toMatchObject({
    code: 'E_SCHOOL_WAITING',
  });
});

test('a maker gone is said, a removed device issues nothing, and old codes are issued again', async () => {
  const { director, deputy } = await world();
  const deputyDesk = await added(director, deputy);
  let directorDesk: IssueDesk = await holdSchool(director, nodeKit, server.send);
  await makeRecovery(deputy, deputyDesk, nodeKit, 'make', server.send);
  directorDesk = (await followSchool(director, directorDesk, nodeKit, server.send)).desk;
  const teacher = { id: 'teacher-1' } as Parameters<typeof assignmentsOf>[1][number];
  const [assignment] = (await assignmentsOf(directorDesk, [teacher], nodeKit)).values();
  const issued = await issueFor(director, directorDesk, assignment, 'phone', nodeKit, server.send);
  expect(issued.kept).toMatchObject({ issue: 1, epoch: 0 });
  await proposeChanges(director, issued.desk, nodeKit, server.send, async (opened) => [
    await removeHolder(opened, deputyDesk.held.device, directorDesk.held.device, directorDesk.crypto, nodeKit.random),
  ]);
  expect((await followSchool(director, issued.desk, nodeKit, server.send)).orphaned).toBe(true);
  await expect(holdSchool(deputy, nodeKit, server.send)).rejects.toMatchObject({ code: 'E_KEY_REMOVED' });
  expect((await holdSchool(director, nodeKit, server.send)).reissued).toBe(1);
  expect(keptIssues(director.book.entries, directorDesk.held.school).get(assignment)).toMatchObject({
    issue: 2,
    epoch: 1,
  });
  expect((await holdSchool(director, nodeKit, server.send)).reissued).toBe(0);
});

test('renewing the recovery alone issues again the codes not yet scanned', async () => {
  const { director } = await world();
  const desk = await holdSchool(director, nodeKit, server.send);
  const teacher = { id: 'teacher-2' } as Parameters<typeof assignmentsOf>[1][number];
  const [assignment] = (await assignmentsOf(desk, [teacher], nodeKit)).values();
  await makeRecovery(director, desk, nodeKit, 'make', server.send);
  const issued = await issueFor(director, desk, assignment, 'phone', nodeKit, server.send);
  expect(issued.kept.epoch).toBe(0);
  await makeRecovery(director, issued.desk, nodeKit, 'renew', server.send);
  const again = await issueFor(director, issued.desk, assignment, 'key', nodeKit, server.send);
  expect(again.reissued).toBe(1);
  expect(again.kept).toMatchObject({ issue: 3, epoch: 1, access: 'key' });
});
