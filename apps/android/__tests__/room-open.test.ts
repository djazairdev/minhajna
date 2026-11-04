// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Opening the school exams' cut rooms from the director's device (#601, answer
// 632), against a made-up demo server: before an exam's figures day no room
// opens; on it, each grade and subject's chart is put in its room, signed by
// the decider its seed gives, with the setters whose phones joined and the
// classes' positions and forecasts in the pack, and the room is handed on each
// setter's channel, held as the school key derives it; and opening again hands
// nothing, puts no second chart and writes nothing. The term is filled as a
// seeded school's is, then read as one whose key the device took. Every world,
// school and teacher is made up.

import { addDays, isHeldRoom, latestEpoch, roomKey, roomPlace, roomRecords, worldExams } from '@minhajna/core';
import { filled, handedRooms, server } from '../jest/room-school';
import { calendar, reference } from '../jest/world-calendar';
import { nodeKit } from '../jest/world-server';
import { leaveWorldNetwork } from '../src/network/world-network';
import { caKey, spaceBatches } from '../src/school/space-read';
import { chartDrafts } from '../src/threshold/exam-charts';
import { deciderKey } from '../src/threshold/decider-key';
import { openRooms } from '../src/threshold/room-open';

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

test('opens each grade and subject’s room on the figures day, once, handed to its joined setters', async () => {
  const { id, school, director, desk, records } = await filled();
  const exam = worldExams(calendar.year, calendar.entries).find((one) => one.setBy === 'school')!;
  const early = { ...director, date: addDays(exam.figuresDay, -1) };
  expect(await openRooms(early, desk, school, records, reference, nodeKit, server.send)).toEqual({
    handed: 0,
    failed: 0,
  });
  const on = { ...director, date: exam.figuresDay };
  const { handed, failed } = await openRooms(on, desk, school, records, reference, nodeKit, server.send);
  expect([handed > 0, failed]).toEqual([true, 0]);
  const [draft] = chartDrafts(exam, school, records, reference);
  const name = { exam: exam.id, subject: draft.chart.subject, grade: draft.chart.grade };
  const epoch = latestEpoch(desk.opened);
  const place = await roomPlace(await roomKey(desk.opened, epoch, name, desk.crypto), nodeKit.mac);
  const batches = await spaceBatches(id, desk.held.school, server.send);
  const checker = { key: await caKey(id, server.send), checker: nodeKit };
  const rooms = await handedRooms({ id, school, director, desk, records }, name);
  expect(rooms.length).toBeGreaterThan(0);
  for (const room of rooms) expect(await isHeldRoom(room, desk.opened, desk.crypto, deciderKey)).toBe(true);
  const full = { ...name, world: id, school: desk.held.school };
  const read = await roomRecords(
    place,
    batches.get(place.stream) ?? [],
    checker,
    { name: full, decider: rooms[0].decider },
    nodeKit.cipher,
  );
  const chart = read.chart!.value;
  expect([chart.figuresDay, chart.signBy, chart.from]).toEqual([exam.figuresDay, exam.signBy, exam.from]);
  expect(chart.setters.map((one) => one.assignment).sort()).toEqual(rooms.map((one) => one.assignment).sort());
  expect(chart.classes.length).toBeGreaterThan(0);
  expect(chart.classes.every((one) => (one.position === null) === (one.forecast === null))).toBe(true);
  const writes = () => server.seen.filter((one) => one.method !== 'GET').length;
  const before = writes();
  expect(await openRooms(on, desk, school, records, reference, nodeKit, server.send)).toEqual({ handed: 0, failed: 0 });
  expect(writes()).toBe(before);
  const again = await spaceBatches(id, desk.held.school, server.send);
  expect(again.get(place.stream)).toEqual(batches.get(place.stream));
}, 120_000);
