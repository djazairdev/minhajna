// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Versions of the school's timetable from the director's device (#578, answer
// 606), against a made-up demo server: the first draft has no standing version
// and every teacher with a code is new; a second version says what the whole
// timetable changes, tells only the teacher whose sessions it changes, and is
// kept in the world's store after the first; a version for one day carries its
// day and leaves the standing version the one the next draft is compared with;
// a teacher given a code after a version receives their part with the next one,
// though their sessions did not change; a version for one day is refused, and
// nothing kept, before a standing version or while a teacher it changes holds
// no standing part; the sessions a version cannot keep are counted; and a
// one-day version is compared with what applies on its day, so a standing
// version still to come is not counted and a second one-day version for a day
// reaches the teacher whose day the first changed. Every world, school and
// teacher is made up.

import { addDays, keptVersions, readJoinCode } from '@minhajna/core';
import { BELLS, channel, school, sendParts, server, session, setting, STAFF } from '../jest/timetable-send';
import { codeOf, nodeKit as kit } from '../jest/world-server';
import { assignmentsOf, codeText, holdSchool, issueFor } from '../src/director/issue-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { partFrom } from '../src/timetable/send-session';
import { affected, draftVersion, oneDayAllowed, publishVersion, teachersOn } from '../src/timetable/version-session';

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

const FIRST = [session('بلعيد محمد', 1, 600), session('Salhi Zahia', 2, 540), session('نوري سليم', 0, 480)];
const MOVED = [session('بلعيد محمد', 1, 540), ...FIRST.slice(1)];

test('a second version tells only the teacher it changes, and each version is kept', async () => {
  const { here, code, keyCode } = await setting();
  const first = await draftVersion(here, school, FIRST, BELLS, kit, server.send);
  expect([first.version, first.standing]).toEqual([1, null]);
  expect(first.teachers.map((one) => [one.teacher, one.first])).toEqual([
    ['بلعيد محمد', true],
    ['Salhi Zahia', true],
  ]);
  expect(first.noCode).toEqual(['نوري سليم']);
  await publishVersion(here, first, { from: partFrom(here.date), once: false }, kit, server.send);
  const second = await draftVersion(here, school, MOVED, BELLS, kit, server.send);
  expect([second.version, second.standing]).toEqual([2, { version: 1, from: partFrom(here.date) }]);
  expect(second.changes.map((one) => one.kind)).toEqual(['moved']);
  const [moved, same] = second.teachers;
  expect(moved.changes.map((one) => [one.kind, one.before?.start, one.after?.start])).toEqual([['moved', 600, 540]]);
  expect([moved.first, same.changes, affected(same)]).toEqual([false, [], false]);
  const from = addDays(partFrom(here.date), 7);
  const sent = await publishVersion(here, second, { from, once: false }, kit, server.send);
  expect([sent.sent, sent.unchanged]).toEqual([['بلعيد محمد'], ['Salhi Zahia']]);
  expect((await channel(code)).latest?.part).toMatchObject({ version: 2, from, once: false });
  expect((await channel(keyCode)).all.map((one) => one.part.version)).toEqual([1]);
  const kept = keptVersions(here.book.entries, second.desk.held.school);
  expect(kept.map((one) => [one.version, one.from, one.once, one.sessions.length])).toEqual([
    [1, partFrom(here.date), false, 3],
    [2, from, false, 3],
  ]);
  expect(kept[1].sessions[0]).not.toHaveProperty('row');
});

test('a version for one day carries its day, and the next draft is compared with the standing version', async () => {
  const { here, code } = await setting();
  await sendParts(here, school, FIRST, BELLS);
  const day = addDays(here.date, 2);
  const once = await draftVersion(here, school, MOVED, BELLS, kit, server.send);
  await publishVersion(here, once, { from: day, once: true }, kit, server.send);
  const read = await channel(code);
  expect(read.all.map((one) => [one.part.version, one.part.once, one.part.from])).toEqual([
    [1, false, partFrom(here.date)],
    [2, true, day],
  ]);
  expect(read.latest?.part.version).toBe(1);
  const next = await draftVersion(here, school, FIRST, BELLS, kit, server.send);
  expect([next.version, next.standing?.version, next.teachers.filter(affected)]).toEqual([3, 1, []]);
});

test('a teacher given a code after a version receives their part with the next, their sessions unchanged', async () => {
  const { here } = await setting();
  await sendParts(here, school, FIRST, BELLS);
  const desk = await holdSchool(here, kit, server.send);
  const assignment = (await assignmentsOf(desk, STAFF, kit)).get('teacher-3')!;
  const issued = (await issueFor(here, desk, assignment, 'phone', kit, server.send)).kept;
  const later = readJoinCode(await codeText(here.world, desk, issued))!;
  expect((await channel(later)).all).toEqual([]);
  const sent = await sendParts(here, school, FIRST, BELLS);
  expect([sent.sent, sent.unchanged]).toEqual([['نوري سليم'], ['بلعيد محمد', 'Salhi Zahia']]);
  expect((await channel(later)).all.map((one) => one.part.version)).toEqual([2]);
});

test('a one-day version is refused before a standing version, or while a teacher it changes holds none', async () => {
  const { here } = await setting();
  const first = await draftVersion(here, school, FIRST, BELLS, kit, server.send);
  expect(oneDayAllowed(first)).toBe(false);
  const once = { from: addDays(here.date, 1), once: true };
  expect(await codeOf(publishVersion(here, first, once, kit, server.send))).toBe('E_TIMETABLE_ONCE');
  expect(keptVersions(here.book.entries, first.desk.held.school)).toEqual([]);
  await sendParts(here, school, FIRST, BELLS);
  const desk = await holdSchool(here, kit, server.send);
  const assignment = (await assignmentsOf(desk, STAFF, kit)).get('teacher-3')!;
  await issueFor(here, desk, assignment, 'phone', kit, server.send);
  const later = await draftVersion(here, school, MOVED, BELLS, kit, server.send);
  expect(later.teachers.filter(affected).map((one) => [one.teacher, one.first])).toEqual([
    ['بلعيد محمد', false],
    ['نوري سليم', true],
  ]);
  expect(oneDayAllowed(later)).toBe(false);
  expect(await codeOf(publishVersion(here, later, once, kit, server.send))).toBe('E_TIMETABLE_ONCE');
});

test('a draft counts the sessions it cannot keep, and the version keeps the others', async () => {
  const { here } = await setting();
  const sessions = [...FIRST, session('Salhi Zahia', 0, 480, 'م'.repeat(81))];
  const draft = await draftVersion(here, school, sessions, BELLS, kit, server.send);
  expect([draft.unkept, draft.tooLong]).toEqual([1, ['Salhi Zahia']]);
  await publishVersion(here, draft, { from: partFrom(here.date), once: false }, kit, server.send);
  expect(keptVersions(here.book.entries, draft.desk.held.school)[0].sessions).toHaveLength(3);
});

test('a one-day version is compared with what applies on its day, not a standing version still to come', async () => {
  const { here, code } = await setting();
  const sunday = partFrom(here.date);
  await sendParts(here, school, FIRST, BELLS);
  await sendParts(here, school, MOVED, BELLS, server.send, { from: addDays(sunday, 7), once: false });
  const draft = await draftVersion(here, school, FIRST, BELLS, kit, server.send);
  expect(draft.teachers.filter(affected).map((one) => one.teacher)).toEqual(['بلعيد محمد']);
  const choice = { from: addDays(sunday, 1), once: true };
  expect(teachersOn(draft, choice).filter(affected)).toEqual([]);
  expect((await publishVersion(here, draft, choice, kit, server.send)).sent).toEqual([]);
  expect((await channel(code)).all.map((one) => one.part.version)).toEqual([1, 2]);
});

test('a second one-day version for a day reaches the teacher whose day the first one changed', async () => {
  const { here, code } = await setting();
  await sendParts(here, school, FIRST, BELLS);
  const choice = { from: addDays(partFrom(here.date), 1), once: true };
  expect((await sendParts(here, school, MOVED, BELLS, server.send, choice)).sent).toEqual(['بلعيد محمد']);
  const back = await draftVersion(here, school, FIRST, BELLS, kit, server.send);
  expect(back.teachers.filter(affected)).toEqual([]);
  expect((await publishVersion(here, back, choice, kit, server.send)).sent).toEqual(['بلعيد محمد']);
  const read = await channel(code);
  expect(read.all.map((one) => [one.part.version, one.part.once])).toEqual([
    [1, false],
    [2, true],
    [3, true],
  ]);
  expect(read.all[2].part.sessions.map((one) => one.start)).toEqual([600]);
});
