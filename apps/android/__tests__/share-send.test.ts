// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's share of the totals from the director's device (#596, answer
// 628), against a made-up demo server: for an announced day the world's date
// reached, the share prepared from the school's signed weeks in the day's term,
// with the timetable's staffing, is put once and replaces itself when sent
// again; a day the server does not take, such as an exam day it does not list,
// is passed over; a day not reached is not sent; and a seeded school's key
// sends nothing, its share being the starter's. The term is filled as a seeded
// school's is, then read as one whose key the device started, with a calendar
// whose first term is cut short so the filled weeks fall in the day's term.
// Every world, school and teacher is made up.

import {
  addDays,
  directorSchool,
  schoolStaffing,
  seedNationalWorld,
  type Day,
  type SchoolCalendar,
} from '@minhajna/core';
import { FakeStorage } from '../jest/fake-storage';
import { calendar, reference } from '../jest/world-calendar';
import { DemoServer, nodeKit } from '../jest/world-server';
import { startSeededWorld } from '../src/demo/world-seed';
import { holdSchool } from '../src/director/issue-session';
import { recordsOf } from '../src/director/records-session';
import { fillSeededTerm } from '../src/director/seeded-fill';
import { seededKeyOf, takeSeededKey } from '../src/director/seeded-key';
import { sendShares, sharedDays } from '../src/director/share-send';
import { leaveWorldNetwork } from '../src/network/world-network';
import { openRecordBook } from '../src/storage/history';

const server = new DemoServer();

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

/** The calendar with its first term cut after two weeks, so the rest of it is the next term. */
function cut(whole: SchoolCalendar): SchoolCalendar {
  const [first, ...rest] = whole.year.terms;
  const split = addDays(first.from, 13);
  const terms = [{ ...first, to: split }, { ...first, number: 2, from: addDays(split, 1) }, ...rest];
  return { ...whole, year: { ...whole.year, terms: terms.map((one, at) => ({ ...one, number: at + 1 })) } };
}

async function filled() {
  const started = await startSeededWorld('national', calendar, reference, nodeKit, server.send);
  const id = started.keys.world;
  const { zones = [], workingDays } = reference.profile;
  const school = directorSchool(seedNationalWorld(id, zones, workingDays, reference.packs))!;
  const held = { world: id, keys: started.keys, sealing: started.sealing };
  const director = { world: id, date: started.date, book: await openRecordBook(new FakeStorage().asSpec()) };
  await takeSeededKey(director, held, school, nodeKit, server.send);
  const desk = await holdSchool(director, nodeKit, server.send, false);
  await fillSeededTerm(
    director,
    desk,
    (await seededKeyOf(held, school.id, nodeKit, server.send))!,
    reference,
    nodeKit,
    server.send,
  );
  const records = await recordsOf(director, desk, school, nodeKit, server.send);
  const unseeded = { ...desk, held: { ...desk.held, seeded: undefined } };
  return { id, school, director, desk, started: unseeded, records };
}

test('the share of an announced day reached is put once, and replaces itself when sent again', async () => {
  const { id, school, director, started, records } = await filled();
  const short = cut(reference.calendar);
  const days = sharedDays(short, director.date);
  const { day, from } = days.at(-1)!;
  expect([days.length > 1, day, from]).toEqual([true, director.date, addDays(short.year.terms[0].to, 1)]);
  server.worlds.get(id)!.announced = [day];
  const [share] = await sendShares(director, started, school, records, short, nodeKit, server.send);
  expect([share.day, share.directorate]).toEqual([day, school.directorateId]);
  const staffing = schoolStaffing(school);
  expect(Object.keys(share.subjects)).toEqual(Object.keys(staffing));
  const math = share.subjects.math;
  expect(math.teachers).toBe(staffing.math.teachers);
  const courses = records.flatMap((one) => one.courses).filter((one) => one.subject === 'math');
  expect(math.classes).toBe(courses.length);
  expect(Object.keys(math.items).length).toBeGreaterThan(0);
  expect([...server.shares.values()]).toEqual([share]);
  const [again] = await sendShares(director, started, school, records, short, nodeKit, server.send);
  expect(again).toEqual(share);
  expect(server.shares.size).toBe(1);
  expect(server.seen.filter((one) => one.method === 'PUT' && one.path.includes('/totals/'))).toHaveLength(
    2 * days.length,
  );
});

test('a day the server does not take is passed over, and a day not reached is not sent', async () => {
  const { id, school, director, started, records } = await filled();
  const short = cut(reference.calendar);
  expect(await sendShares(director, started, school, records, short, nodeKit, server.send)).toEqual([]);
  expect(server.shares.size).toBe(0);
  server.worlds.get(id)!.announced = [director.date];
  const before: Day = addDays(director.date, -1);
  expect(
    await sendShares({ ...director, date: before }, started, school, records, short, nodeKit, server.send),
  ).toEqual([]);
  expect(sharedDays(reference.calendar, director.date)).toEqual([]);
});

test('a seeded school’s key sends nothing, its share being the starter’s', async () => {
  const { id, school, director, desk, records } = await filled();
  server.worlds.get(id)!.announced = [director.date];
  expect(await sendShares(director, desk, school, records, cut(reference.calendar), nodeKit, server.send)).toEqual([]);
  expect(server.seen.some((one) => one.path.includes('/totals/'))).toBe(false);
});
