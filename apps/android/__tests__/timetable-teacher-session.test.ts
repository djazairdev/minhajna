// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's timetable from the school on their phone (#579, answer 607),
// against a made-up demo server: before any part the channel holds none; the
// first version comes whole and, before its first day, is the first to come; a
// later one says what it changes from the one before, and a one-day part what
// it changes on its day alone, with that day's sessions alone, from the
// standing part in force then; confirming a version's receipt puts it on the
// channel, read back with the world's date; the week's hours count a session of
// week A or B half; and a device that is not the one that joined is refused.
// Every world, school and teacher is made up.

import { addDays } from '@minhajna/core';
import { BELLS, school, sendParts, server, session, setting } from '../jest/timetable-send';
import { codeOf, nodeKit as kit } from '../jest/world-server';
import { leaveWorldNetwork } from '../src/network/world-network';
import { partFrom } from '../src/timetable/send-session';
import {
  confirmReceipt,
  firstToCome,
  hoursOf,
  inForce,
  readTeacherChannel,
  receivedVersions,
  sessionsOf,
} from '../src/timetable/teacher-session';

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

const FIRST = [session('بلعيد محمد', 1, 600), session('بلعيد محمد', 2, 540), session('Salhi Zahia', 0, 480)];
const MOVED = [session('بلعيد محمد', 1, 540), ...FIRST.slice(1)];

test('the teacher reads each version with what it changes, and confirms its receipt', async () => {
  const { id, here, joined } = await setting();
  const world = { world: id, date: here.date };
  const empty = await readTeacherChannel(world, joined, kit, server.send);
  expect([empty.parts, inForce(empty, here.date), firstToCome(empty)]).toEqual([[], null, null]);
  const sunday = partFrom(here.date);
  await sendParts(here, school, FIRST, BELLS);
  await sendParts(here, school, MOVED, BELLS, server.send, { from: addDays(sunday, 7), once: false });
  const twice = [session('بلعيد محمد', 1, 600), session('بلعيد محمد', 2, 600), FIRST[2]];
  await sendParts(here, school, twice, BELLS, server.send, { from: addDays(sunday, 8), once: true });
  const read = await readTeacherChannel(world, joined, kit, server.send);
  expect([inForce(read, here.date), firstToCome(read)?.version]).toEqual([null, 1]);
  expect(inForce(read, addDays(sunday, 8))?.version).toBe(3);
  expect(inForce(read, addDays(sunday, 9))?.version).toBe(2);
  const [once, moved, whole] = receivedVersions(read);
  expect([whole.part.version, whole.base, whole.changes, whole.confirmed]).toEqual([1, null, [], null]);
  expect([moved.base?.version, moved.changes.map((one) => [one.kind, one.before?.start, one.after?.start])]).toEqual([
    1,
    [['moved', 600, 540]],
  ]);
  expect([once.part.once, once.base?.version, once.changes.map((one) => one.after?.start)]).toEqual([true, 2, [600]]);
  expect(sessionsOf(once.part).map((one) => [one.day, one.start])).toEqual([[1, 600]]);
  await confirmReceipt(world, joined, 2, kit, server.send);
  const confirmed = await readTeacherChannel(world, joined, kit, server.send);
  expect([...confirmed.receipts]).toEqual([[2, here.date]]);
  expect(receivedVersions(confirmed).map((one) => one.confirmed)).toEqual([null, here.date, null]);
});

test('the week’s hours count a session of one week half', () => {
  const one = { id: 'a'.repeat(32), class: '1م2', group: '', subject: 'رياضيات', room: '', day: 0 as const };
  const hours = hoursOf([
    { ...one, start: 480, end: 540, week: 'both' },
    { ...one, start: 540, end: 660, week: 'A' },
  ]);
  expect(hours).toBe(2);
});

test('a device that is not the one that joined is refused', async () => {
  const { id, here, joined } = await setting();
  const world = { world: id, date: here.date };
  expect(await codeOf(readTeacherChannel(world, { ...joined, device: 'made-up-device' }, kit, server.send))).toBe(
    'E_JOIN_TAKEN',
  );
});
