// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Issue's session on the director's device in a demo world (#570, answers
// 596 and 597), against a made-up demo server with the server's own relay and
// CA: the first opening starts the school's keyring on a space the device
// drew, keeps it in the world's store and creates the space, while no request
// carries the private half; opening again, or twice at once, keeps one key; a
// held key that does not read or open here says so and starts no other; each
// teacher's assignment is worked out from the space; a code's issue counts up,
// a key gets a four-digit number and no code, two issues at once go one after
// the other, and a code's text is the same each time it is worked out; a
// teacher who joins on a code is read back with the day of their certificate,
// and an untouched space or a key has none; a busy server says so. Every
// world, school and teacher is made up.

import {
  assignmentId,
  eventOf,
  joinedKey,
  keptIssues,
  readJoinCode,
  type DemoTeacher,
  type Entry,
  type SchoolCalendar,
  type SchoolHeld,
} from '@minhajna/core';
import { FakeStorage } from '../jest/fake-storage';
import { codeOf, DemoServer, nodeKit as kit } from '../jest/world-server';
import { assignmentsOf, codeText, holdSchool, issueFor, joinedDays } from '../src/director/issue-session';
import { newDevicePair } from '../src/demo/world-key-crypto';
import { startWorld } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { joinSchool } from '../src/school/school-join-session';
import { openRecordBook } from '../src/storage/history';

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const calendar: SchoolCalendar = read.calendar;
const server = new DemoServer();

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

const teacher = (id: string): DemoTeacher => ({
  id,
  subject: 'math',
  classIds: [],
  name: 'Made-up',
  latinName: 'Made-up',
  sex: 'f',
});

/** A started world, and a device with a store of its own in it. */
async function world() {
  const started = await startWorld('national', calendar, kit, server.send);
  const device = async () => ({
    world: started.keys.world,
    date: started.date,
    book: await openRecordBook(new FakeStorage().asSpec()),
  });
  return { id: started.keys.world, date: started.date, here: await device(), device };
}

const helds = (entries: readonly Entry[]) => entries.filter((one) => eventOf(one)?.kind === 'school.held').length;

test('the first opening starts the school key on a drawn space, kept in the store, and creates the space', async () => {
  const { id, here } = await world();
  const desk = await holdSchool(here, kit, server.send);
  const held: SchoolHeld = desk.held;
  expect(held.school).toMatch(/^[A-Za-z0-9_-]{22}$/u);
  expect(held.ring.holders).toEqual([{ id: held.device, publicKey: held.publicKey }]);
  expect(desk.opened.keys).toHaveLength(1);
  expect(await server.relay.spaces.batchesAfter(id, held.school, 0, 10)).toEqual([]);
  const sent = JSON.stringify(server.seen);
  expect(sent).not.toContain(held.pkcs8);
  const again = await holdSchool(here, kit, server.send);
  expect(again.held).toEqual(held);
  expect(again.opened.keys).toEqual(desk.opened.keys);
  expect(helds(here.book.entries)).toBe(1);
});

test('two openings at once keep one key', async () => {
  const { here } = await world();
  const [one, two] = await Promise.all([holdSchool(here, kit, server.send), holdSchool(here, kit, server.send)]);
  expect(two.held).toEqual(one.held);
  expect(helds(here.book.entries)).toBe(1);
});

test('a held key that does not open here says so and starts no other', async () => {
  const { here } = await world();
  const { held } = await holdSchool(here, kit, server.send);
  const other = await newDevicePair(kit);
  await here.book.record(here.date, { kind: 'school.held', held: { ...held, pkcs8: other.pkcs8 } });
  expect(await codeOf(holdSchool(here, kit, server.send))).toBe('E_SCHOOL_KEY');
  jest.spyOn(kit, 'agree').mockRejectedValueOnce(new Error('made-up failure'));
  expect(await codeOf(holdSchool(here, kit, server.send))).toBe('E_WORLD_KIT');
  expect(helds(here.book.entries)).toBe(2);
});

test('a held key that no longer reads starts no other', async () => {
  const { here, date, device } = await world();
  const { held } = await holdSchool(here, kit, server.send);
  const other = await device();
  await other.book.record(date, { kind: 'school.held', held: { ...held, ring: {} as never } });
  expect(await codeOf(holdSchool(other, kit, server.send))).toBe('E_SCHOOL_KEY');
  expect(helds(other.book.entries)).toBe(1);
});

test('two issues at once go one after the other, each as asked', async () => {
  const { here } = await world();
  const desk = await holdSchool(here, kit, server.send);
  const [assignment] = (await assignmentsOf(desk, [teacher('teacher-1')], kit)).values();
  const [code, key] = await Promise.all([
    issueFor(here, desk, assignment, 'phone', kit),
    issueFor(here, desk, assignment, 'key', kit),
  ]);
  expect(code).toMatchObject({ issue: 1, access: 'phone', keyNumber: null });
  expect(key).toMatchObject({ issue: 2, access: 'key' });
  jest.spyOn(here.book, 'record').mockRejectedValueOnce(new Error('made-up failure'));
  await expect(issueFor(here, desk, assignment, 'phone', kit)).rejects.toThrow('made-up failure');
  expect(await issueFor(here, desk, assignment, 'phone', kit)).toMatchObject({ issue: 3 });
});

test('each teacher’s assignment comes from the space, and issues count up with a key’s number', async () => {
  const { id, here } = await world();
  const desk = await holdSchool(here, kit, server.send);
  const assignments = await assignmentsOf(desk, [teacher('teacher-1'), teacher('teacher-2')], kit);
  const first = assignments.get('teacher-1')!;
  expect(first).toBe(await assignmentId(desk.held.school, 'teacher-1', kit.mac));
  expect(assignments.get('teacher-2')).not.toBe(first);
  const one = await issueFor(here, desk, first, 'phone', kit);
  expect(one).toMatchObject({ school: desk.held.school, assignment: first, issue: 1, epoch: 0, keyNumber: null });
  const text = await codeText(id, desk, one);
  expect(await codeText(id, desk, one)).toBe(text);
  expect(readJoinCode(text)).toMatchObject({ world: id, school: desk.held.school, assignment: first, issue: 1 });
  const two = await issueFor(here, desk, first, 'key', kit);
  expect(two).toMatchObject({ issue: 2, access: 'key' });
  expect(two.keyNumber).toMatch(/^\d{4}$/u);
  await expect(codeText(id, desk, two)).rejects.toThrow(RangeError);
  expect(keptIssues(here.book.entries, desk.held.school).get(first)).toEqual(two);
  expect(JSON.stringify(server.seen)).not.toContain(first);
});

test('a teacher who joins on a code is read back with their certificate’s day, and a new space has none', async () => {
  const { id, here, device } = await world();
  const desk = await holdSchool(here, kit, server.send);
  const assignments = await assignmentsOf(desk, [teacher('teacher-1'), teacher('teacher-2')], kit);
  const [joining, waiting] = [assignments.get('teacher-1')!, assignments.get('teacher-2')!];
  const issues = [await issueFor(here, desk, joining, 'phone', kit), await issueFor(here, desk, waiting, 'phone', kit)];
  expect(await joinedDays(id, desk, issues, kit, server.send)).toEqual(new Map());
  const phone = await device();
  const joined = await joinSchool(phone, await codeText(id, desk, issues[0]), kit, server.send);
  const days = await joinedDays(id, desk, issues, kit, server.send);
  expect(days).toEqual(new Map([[joinedKey(joining, 1), joined.certificate.issued]]));
  const replaced = await issueFor(here, desk, joining, 'phone', kit);
  const key = await issueFor(here, desk, waiting, 'key', kit);
  expect(await joinedDays(id, desk, [replaced, key], kit, server.send)).toEqual(new Map());
});

test('a busy server says so', async () => {
  const { id, here } = await world();
  const desk = await holdSchool(here, kit, server.send);
  server.busy = true;
  expect(await codeOf(holdSchool(here, kit, server.send))).toBe('E_WORLD_BUSY');
  expect(await codeOf(joinedDays(id, desk, [], kit, server.send))).toBe('E_WORLD_BUSY');
});
