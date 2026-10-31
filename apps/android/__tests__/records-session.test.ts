// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's read of the classes' records (#585, answer 613), on the
// made-up term of term-weeks.ts: each class's courses come in the timetable's
// order, by subject, a class gone from the standing timetable after those in
// it, named by the teacher in the staff list, their weeks newest first with
// whole chains; a week corrected twice comes with both versions below it, and a
// chain missing its original is not whole; before any week is signed the
// director reads none; weeks signed under an earlier code stay after the
// teacher joins on a new one; two teachers of one course keep their records
// apart; and a week signed on two phones keeps the one chain at the highest
// version, never a mix. Every school, class and teacher is made up.

import { correctWeek, parseDay, type ChannelWeek } from '@minhajna/core';
import { FIRST, joinNew, SECOND, sign, signedTerm, TEACHER } from '../jest/term-weeks';
import { BELLS, school, sendParts, server, session, setting } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { leaveWorldNetwork } from '../src/network/world-network';
import { readRecords, wholeChain } from '../src/director/records-session';
import { readSignChannel, signTheWeek } from '../src/week/week-sign-session';

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

test('the director reads each class’s signed weeks by course, newest first, in the timetable’s order', async () => {
  const { id, here, joined } = await signedTerm();
  await sign({ world: id, date: FIRST }, joined, { 0: 'held' }, '1م3', 540);
  const read = await readRecords(here, school, kit, server.send);
  expect(read.map((one) => one.class)).toEqual(['1م2', '1م3']);
  const [course] = read[0].courses;
  expect([course.teacher, course.subject, course.weeks.map((one) => one.week.week)]).toEqual([
    'بلعيد محمد',
    'رياضيات',
    ['2027-01-10', '2027-01-03'],
  ]);
  expect(course.weeks.every(wholeChain)).toBe(true);
});

test('a class’s courses come by subject, and a class gone from the timetable after those still in it', async () => {
  const { id, here, joined } = await setting();
  const physics = { code: 'physics', name: { ar: 'فيزياء', fr: 'Physique', en: 'Physics' }, levels: ['cem'] };
  const first = [session(TEACHER, 0, 480), { ...session(TEACHER, 1, 540), subject: 'فيزياء' }];
  await sendParts(here, school, [...first, session(TEACHER, 2, 480, '1م1')], BELLS);
  await sign({ world: id, date: FIRST }, joined, { 1: 'held' }, '1م2', 540, '', physics);
  await sign({ world: id, date: FIRST }, joined, { 0: 'held' });
  await sign({ world: id, date: FIRST }, joined, { 2: 'held' }, '1م1');
  await sendParts(here, school, first, BELLS, server.send, { from: parseDay('2027-01-10'), once: false });
  const read = await readRecords(here, school, kit, server.send);
  expect(read.map((one) => [one.class, one.courses.map((each) => each.subject)])).toEqual([
    ['1م2', ['رياضيات', 'فيزياء']],
    ['1م1', ['رياضيات']],
  ]);
});

test('a corrected week comes with every version below it, and a chain missing one is not whole', async () => {
  const { id, here, joined } = await signedTerm();
  const world = { world: id, date: SECOND };
  const { weeks } = await readSignChannel(world, joined, kit, server.send);
  const latest = weeks.find((one) => one.week.week === '2027-01-10')!.week;
  const fixed = correctWeek(latest, latest.sessions[2], 'held', 'confirmed-later');
  await signTheWeek(world, joined, fixed, kit, server.send);
  await signTheWeek(world, joined, correctWeek(fixed, fixed.sessions[0], 'not-held'), kit, server.send);
  const [course] = (await readRecords(here, school, kit, server.send))[0].courses;
  const [week] = course.weeks;
  expect([week.week.version, week.earlier.map((one) => one.week.version), wholeChain(week)]).toEqual([2, [0, 1], true]);
  const gap: ChannelWeek = { ...week, earlier: week.earlier.slice(1) };
  expect(wholeChain(gap)).toBe(false);
});

test('before any week is signed the director reads none', async () => {
  const { here } = await setting();
  await sendParts(here, school, [session('بلعيد محمد', 0, 480)], BELLS);
  expect(await readRecords(here, school, kit, server.send)).toEqual([]);
});

test('weeks signed under an earlier code stay in the record after the teacher joins on a new one', async () => {
  const { id, here, device, joined } = await setting();
  const sessions = [session('بلعيد محمد', 0, 480)];
  await sendParts(here, school, sessions, BELLS);
  await sign({ world: id, date: FIRST }, joined, { 0: 'held' });
  const rejoined = await joinNew(id, here, device, 'teacher-1');
  await sendParts(here, school, sessions, BELLS, server.send, { from: parseDay('2027-01-10'), once: false });
  await sign({ world: id, date: SECOND }, rejoined, { 0: 'not-held' });
  const [course] = (await readRecords(here, school, kit, server.send))[0].courses;
  expect(course.weeks.map((one) => [one.week.week, one.week.sessions[0].state])).toEqual([
    ['2027-01-10', 'not-held'],
    ['2027-01-03', 'held'],
  ]);
});

test('two teachers of one course keep their records apart', async () => {
  const { id, here, device, joined } = await setting();
  const other = await joinNew(id, here, device, 'teacher-4');
  await sendParts(here, school, [session('بلعيد محمد', 0, 480), session('قاسمي رضا', 1, 480)], BELLS);
  await sign({ world: id, date: FIRST }, joined, { 0: 'held' });
  await sign({ world: id, date: FIRST }, other, { 1: 'not-held' });
  const { courses } = (await readRecords(here, school, kit, server.send))[0];
  expect(courses.map((one) => [one.teacher, one.weeks[0].week.sessions[0].state])).toEqual([
    ['بلعيد محمد', 'held'],
    ['قاسمي رضا', 'not-held'],
  ]);
  expect(courses[0].course).toBe(courses[1].course);
  expect(courses[0].key).not.toBe(courses[1].key);
});

test('a week signed on two phones keeps one chain, the one at the highest version', async () => {
  const { id, here, device, joined } = await setting();
  const sessions = [session('بلعيد محمد', 0, 480), session('بلعيد محمد', 1, 480)];
  await sendParts(here, school, sessions, BELLS);
  const world = { world: id, date: FIRST };
  await sign(world, joined, { 0: 'held' });
  const rejoined = await joinNew(id, here, device, 'teacher-1');
  await sendParts(here, school, sessions, BELLS, server.send, { from: parseDay('2027-01-03'), once: false });
  await sign(world, rejoined, { 1: 'held' });
  const [latest] = (await readSignChannel(world, rejoined, kit, server.send)).weeks;
  await signTheWeek(world, rejoined, correctWeek(latest.week, latest.week.sessions[0], 'not-held'), kit, server.send);
  const [course] = (await readRecords(here, school, kit, server.send))[0].courses;
  const [week] = course.weeks;
  const states = (one: { sessions: readonly { state: string }[] }) => one.sessions.map((each) => each.state);
  expect([states(week.earlier[0].week), states(week.week)]).toEqual([
    ['awaiting', 'held'],
    ['not-held', 'held'],
  ]);
});
