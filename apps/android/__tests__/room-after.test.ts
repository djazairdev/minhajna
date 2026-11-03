// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Handing the school exams' cut rooms to every teacher of the subject after
// the exam (#602, answers 634 and 636), from the director's device, against a
// made-up demo server: the exams past are those whose last day the world's
// date passed, up to the year's last day; a room opened on the figures day for
// one setter alone is, on the exam's last day and after the year's last day,
// still held by that setter alone; from the day after the exam it is handed to
// every teacher the timetable gives the subject in a class of the grade, all
// of whose phones joined, and to no one else, its chart and setters left as
// they were, each held as the school key derives it; handing again writes
// nothing; and an exam whose figures day passed with no room opened gets none
// after it. The term is filled as a seeded school's is. Every world, school
// and teacher is made up.

import {
  addDays,
  isHeldRoom,
  latestEpoch,
  roomKey,
  roomPlace,
  roomRecords,
  worldExams,
  type Day,
  type ExamRoom,
} from '@minhajna/core';
import { filled, handedRooms, server } from '../jest/room-school';
import { calendar, reference } from '../jest/world-calendar';
import { nodeKit } from '../jest/world-server';
import { assignmentsOf } from '../src/director/issue-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { caKey, spaceBatches } from '../src/school/space-read';
import { chartDrafts, examsAfter } from '../src/threshold/exam-charts';
import { deciderKey } from '../src/threshold/decider-key';
import { openRooms } from '../src/threshold/room-open';

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

const exam = worldExams(calendar.year, calendar.entries).find((one) => one.setBy === 'school')!;
/** The chart in a room as the space holds it, under the latest epoch. */
async function chartOf(
  { id, desk }: Awaited<ReturnType<typeof filled>>,
  name: Pick<ExamRoom, 'exam' | 'subject' | 'grade'>,
  decider: string,
) {
  const place = await roomPlace(await roomKey(desk.opened, latestEpoch(desk.opened), name, desk.crypto), nodeKit.mac);
  const batches = (await spaceBatches(id, desk.held.school, server.send)).get(place.stream) ?? [];
  const checker = { key: await caKey(id, server.send), checker: nodeKit };
  const full = { ...name, world: id, school: desk.held.school };
  return (await roomRecords(place, batches, checker, { name: full, decider }, nodeKit.cipher)).chart!.value;
}

test('the exams past are those whose last day the date passed, up to the year’s last day', () => {
  const past = (date: Day) => examsAfter(reference, date).map((one) => one.id);
  const school = worldExams(calendar.year, calendar.entries).filter((one) => one.setBy === 'school');
  expect([past(exam.to), past(addDays(exam.to, 1)), past(calendar.year.to)]).toEqual([
    [],
    [exam.id],
    school.map((one) => one.id),
  ]);
  expect(past(addDays(calendar.year.to, 1))).toEqual([]);
});

const writes = () => server.seen.filter((one) => one.method !== 'GET').length;

test('hands a room to every teacher of the subject and grade from the day after the exam, once', async () => {
  const seeded = await filled();
  const { school, director, desk, records } = seeded;
  const draft = chartDrafts(exam, school, records, reference).find((one) => one.teachers.length >= 2)!;
  const [first] = draft.teachers;
  const name = { exam: exam.id, subject: draft.chart.subject, grade: draft.chart.grade };
  const one = { ...school, teachers: school.teachers.filter((each) => each.id === first) };
  const open = (date: Day, of = school) =>
    openRooms({ ...director, date }, desk, of, records, reference, nodeKit, server.send);
  expect((await open(exam.figuresDay, one)).failed).toBe(0);
  const setters = (await handedRooms(seeded, name)).map((each) => each.assignment);
  expect(setters).toHaveLength(1);
  await open(exam.to);
  expect((await handedRooms(seeded, name)).map((each) => each.assignment)).toEqual(setters);
  expect(await open(addDays(calendar.year.to, 1))).toEqual({ handed: 0, failed: 0 });
  expect((await handedRooms(seeded, name)).map((each) => each.assignment)).toEqual(setters);
  const after = await open(addDays(exam.to, 1));
  const rooms = await handedRooms(seeded, name);
  const assigned = await assignmentsOf(desk, school.teachers, nodeKit);
  const teachers = draft.teachers.map((each) => assigned.get(each)).sort();
  expect([after.failed, rooms.map((each) => each.assignment).sort()]).toEqual([0, teachers]);
  for (const room of rooms) expect(await isHeldRoom(room, desk.opened, desk.crypto, deciderKey)).toBe(true);
  expect((await chartOf(seeded, name, rooms[0].decider)).setters.map((each) => each.assignment)).toEqual(setters);
  const before = writes();
  expect(await open(addDays(exam.to, 2))).toEqual({ handed: 0, failed: 0 });
  expect(writes()).toBe(before);
}, 180_000);

test('an exam with no room gets none after it', async () => {
  const seeded = await filled();
  const { school, director, desk, records } = seeded;
  const open = (date: Day) => openRooms({ ...director, date }, desk, school, records, reference, nodeKit, server.send);
  const before = writes();
  expect(await open(addDays(exam.to, 1))).toEqual({ handed: 0, failed: 0 });
  const [draft] = chartDrafts(exam, school, records, reference);
  const name = { exam: exam.id, subject: draft.chart.subject, grade: draft.chart.grade };
  expect([writes(), (await handedRooms(seeded, name)).length]).toEqual([before, 0]);
}, 180_000);
