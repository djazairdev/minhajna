// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school exams' rooms on the director's device (#603, answers 632 and
// 637), against a made-up demo server: before an exam's figures day no room is
// read; once the rooms are open each grade and subject's room is read with its
// chart, in the timetable's order, with where its cut stands; the director's
// decision is refused before it falls to them and on or after the exam's first
// day, and once the signing deadline passed unsettled it is signed with the
// room's decider key, put once, settles the cut, and a second decision is
// refused. The term is filled as a seeded school's is. Every world, school and
// teacher is made up.

import { addDays, worldExams, type Day } from '@minhajna/core';
import { filled, server } from '../jest/room-school';
import { calendar, reference } from '../jest/world-calendar';
import { nodeKit } from '../jest/world-server';
import { leaveWorldNetwork } from '../src/network/world-network';
import { examGroups } from '../src/threshold/exam-charts';
import { openRooms } from '../src/threshold/room-open';
import { decideCut, mayDecide, readSchoolRooms } from '../src/threshold/school-rooms';

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

const exam = worldExams(calendar.year, calendar.entries).find((one) => one.setBy === 'school')!;

test('reads each open room with its chart and where its cut stands, and decides a cut that fell to the director', async () => {
  const { school, director, desk, records } = await filled();
  const on = (date: Day) => ({ ...director, date });
  const read = (date: Day) => readSchoolRooms(on(date), desk, school, reference, nodeKit, server.send);
  expect(await read(addDays(exam.figuresDay, -1))).toEqual([]);
  expect(await read(exam.figuresDay)).toEqual([]);
  await openRooms(on(exam.figuresDay), desk, school, records, reference, nodeKit, server.send);
  const rooms = await read(exam.figuresDay);
  const opened = examGroups(exam, school).map((one) => `${one.grade} ${one.subject}`);
  const named = rooms.map((one) => `${one.chart.grade} ${one.chart.subject}`);
  expect([rooms.length > 0, named.every((one) => opened.includes(one))]).toEqual([true, true]);
  expect(named).toEqual(opened.filter((one) => named.includes(one)));
  const [room] = rooms;
  expect([room.exam.id, room.state.settled, room.state.director, mayDecide(room, exam.figuresDay)]).toEqual([
    exam.id,
    null,
    false,
    false,
  ]);
  const decide = (date: Day, item: string | null) => decideCut(on(date), desk, room, item, nodeKit, server.send);
  await expect(decide(exam.figuresDay, null)).rejects.toMatchObject({ code: 'E_CUT_CLOSED' });
  await expect(decide(exam.from, null)).rejects.toMatchObject({ code: 'E_CUT_CLOSED' });
  await expect(decide(exam.figuresDay, 'not-an-item')).rejects.toThrow(RangeError);
  const due = addDays(exam.signBy, 1);
  const [late] = await read(due);
  expect([late.state.director, mayDecide(late, due)]).toEqual([true, true]);
  const cut = await decide(due, room.chart.items[0]);
  expect([cut.item, cut.day]).toEqual([room.chart.items[0], due]);
  const [decided] = await read(due);
  expect([decided.state.settled, mayDecide(decided, due)]).toEqual([
    { item: room.chart.items[0], by: 'director' },
    false,
  ]);
  await expect(decide(due, null)).rejects.toMatchObject({ code: 'E_CUT_CLOSED' });
}, 180_000);
