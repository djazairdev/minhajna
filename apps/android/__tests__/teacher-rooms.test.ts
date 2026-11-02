// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school exams' cut rooms on a teacher's phone (#601, answer 632), against
// a made-up demo server: a room the director opened for the teacher reads back
// with its chart, nothing signed yet and the phone as one of its setters; the
// teacher's cut, numbered past their last, settles it while they are its one
// setter, and their no cut then leaves it to the director; signing is refused
// past the deadline, for a phone the chart does not name, and once the director
// has decided in the room as read when it is put; two cuts signed from one
// reading keep the later; a phone that is not the one joined on the code reads
// nothing; and, when asked, the weeks the phone signed come from the same
// reading, as Week-sign reads them, none when they do not read, the rooms kept.
// Every world, school, teacher and pack is made up.

import { addDays, deciderSeed, handedKey, roomPlace, sealRoomRecord, signRoomRecord } from '@minhajna/core';
import { openedRoom } from '../jest/cut-room';
import { SECOND, signedTerm } from '../jest/term-weeks';
import { server } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { leaveWorldNetwork } from '../src/network/world-network';
import { putOnce } from '../src/school/stream-put';
import { deciderSigning } from '../src/threshold/decider-key';
import { readTeacherExams, readTeacherRooms, signCut } from '../src/threshold/teacher-rooms';
import { readSignChannel } from '../src/week/week-sign-session';

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

async function opened() {
  const room = await openedRoom();
  expect(room.opened).toEqual({ handed: 1, failed: 0 });
  return room;
}

test('reads the room, signs a cut that settles it, then a no cut that leaves it to the director', async () => {
  const { id, date, joined, items } = await opened();
  const world = { world: id, date };
  const [room] = await readTeacherRooms(world, joined, kit, server.send);
  expect([room.chart.exam, room.version, room.state.proposed, room.state.settled]).toEqual(['term-1', -1, null, null]);
  expect(room.mine?.key).toBe(joined.certificate.publicKey);
  const cut = await signCut(world, joined, room, items[1], kit, server.send);
  expect([cut.item, cut.version, cut.day]).toEqual([items[1], 0, date]);
  const [signed] = await readTeacherRooms(world, joined, kit, server.send);
  expect([signed.version, signed.state.settled, signed.state.director]).toEqual([
    0,
    { item: items[1], by: 'setters' },
    false,
  ]);
  await signCut(world, joined, signed, null, kit, server.send);
  const [none] = await readTeacherRooms(world, joined, kit, server.send);
  expect([none.version, none.state.settled, none.state.director]).toEqual([1, null, true]);
  await expect(signCut(world, joined, none, 'not-an-item', kit, server.send)).rejects.toThrow(RangeError);
}, 60_000);

test('refuses a cut past the deadline or from a phone the chart does not name', async () => {
  const { id, date, joined, items } = await opened();
  const [room] = await readTeacherRooms({ world: id, date }, joined, kit, server.send);
  const late = { world: id, date: addDays(date, 3) };
  await expect(signCut(late, joined, room, items[0], kit, server.send)).rejects.toMatchObject({ code: 'E_CUT_CLOSED' });
  const stranger = { ...room, mine: null };
  await expect(signCut({ world: id, date }, joined, stranger, items[0], kit, server.send)).rejects.toMatchObject({
    code: 'E_CUT_NOT_SETTER',
  });
  const other = { ...joined, device: 'made-up-device' };
  await expect(readTeacherRooms({ world: id, date }, other, kit, server.send)).rejects.toMatchObject({
    code: 'E_JOIN_TAKEN',
  });
}, 60_000);

test('keeps the later of two cuts signed from one reading', async () => {
  const { id, date, joined, items } = await opened();
  const world = { world: id, date };
  const [room] = await readTeacherRooms(world, joined, kit, server.send);
  const first = await signCut(world, joined, room, items[2], kit, server.send);
  const second = await signCut(world, joined, room, items[1], kit, server.send);
  expect([first.version, second.version]).toEqual([0, 1]);
  const [read] = await readTeacherRooms(world, joined, kit, server.send);
  expect([read.version, read.state.settled]).toEqual([1, { item: items[1], by: 'setters' }]);
}, 60_000);

test('refuses a cut once the director has decided, in the room as read when it is put', async () => {
  const { id, date, joined, items, desk } = await opened();
  const world = { world: id, date };
  const [room] = await readTeacherRooms(world, joined, kit, server.send);
  await signCut(world, joined, room, null, kit, server.send);
  const name = { exam: room.room.exam, subject: room.room.subject, grade: room.room.grade };
  const seed = await deciderSeed(desk.opened, room.room.epoch, name, desk.crypto);
  const { certificate, signer } = await deciderSigning(id, desk, seed, room.ca, kit, server.send);
  const decision = { ...name, world: id, school: room.room.school, item: items[0], day: date, version: 0 };
  const signed = await signRoomRecord('decision', decision, certificate, signer);
  const place = await roomPlace(handedKey(room.room), kit.mac);
  const put = (first: number) => sealRoomRecord(place, signed, first, kit.cipher);
  const kind = 'school' as const;
  const there = () => false;
  await putOnce(
    {
      world: id,
      space: room.room.school,
      kind,
      stream: place.stream,
      open: () => Promise.resolve([]),
      there,
      seal: put,
    },
    server.send,
  );
  await expect(signCut(world, joined, room, items[1], kit, server.send)).rejects.toMatchObject({
    code: 'E_CUT_CLOSED',
  });
  const [read] = await readTeacherRooms(world, joined, kit, server.send);
  expect(read.state.settled).toEqual({ item: items[0], by: 'director' });
}, 60_000);

test('reads the phone’s own signed weeks from the same reading, when asked', async () => {
  const { id, here, joined } = await signedTerm();
  const world = { world: id, date: SECOND };
  const own = await readTeacherExams(world, joined, kit, server.send);
  const { weeks } = await readSignChannel(world, joined, kit, server.send);
  expect([own.rooms, own.weeks]).toEqual([[], weeks.map((one) => one.week)]);
  expect(own.weeks!.map((one) => one.class)).toEqual(['1م2', '1م2']);
  expect((await readTeacherExams({ world: id, date: here.date }, joined, kit, server.send, false)).weeks).toBeNull();
}, 60_000);

test('keeps the rooms and gives no weeks when the weeks do not read', async () => {
  const { id, joined } = await signedTerm();
  const world = { world: id, date: SECOND };
  let [calls, most] = [0, Infinity];
  const mac: typeof kit.mac = (key, data) =>
    ++calls > most ? Promise.reject(new Error('made up')) : kit.mac(key, data);
  const counting = { ...kit, mac };
  const rooms = await readTeacherExams(world, joined, counting, server.send, false);
  [calls, most] = [0, calls];
  expect(await readTeacherExams(world, joined, counting, server.send)).toEqual({ rooms: rooms.rooms, weeks: null });
}, 60_000);
