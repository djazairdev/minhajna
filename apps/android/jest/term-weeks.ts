// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up term for School-mine's tests (#584): term 2 of the bundled calendar
// read for the world's school, the country's maths, and a teacher's weeks
// signed on their channel, each session's state by its weekday, for one group
// or none, the rest awaiting; and a term with one class's three weekly sessions
// over two signed weeks: three held, one awaiting, one not held on Yennayer and
// one not held otherwise, with another class's session never signed; and a new
// code issued to a teacher, on which a new device joins.

import { parseDay, readJoinCode, type Day, type SchoolJoined, type Subject } from '@minhajna/core';
import { assignmentsOf, codeText, holdSchool, issueFor } from '../src/director/issue-session';
import { bundledReference, readReference } from '../src/reference';
import { joinSchool } from '../src/school/school-join-session';
import type { MineCalendar } from '../src/week/school-mine-session';
import { readSignChannel, signTheWeek, weekRecord, weeksToSign, weekStart } from '../src/week/week-sign-session';
import { BELLS, school, sendParts, server, session, setting, STAFF } from './timetable-send';
import { nodeKit as kit } from './world-server';

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
export const DAYS = [0, 1, 2, 3, 4] as const;
export const SUBJECTS: Subject[] = [
  { code: 'math', name: { ar: 'رياضيات', fr: 'Mathématiques', en: 'Maths' }, levels: ['cem'] },
];
export const TEACHER = 'بلعيد محمد';
export const MINE: MineCalendar = { profile: read.profile, calendar: read.calendar };
export const [FIRST, SECOND] = [parseDay('2027-01-05'), parseDay('2027-01-12')];

/** Signs the world's week of a class with each session's state by its weekday, the rest awaiting. */
export async function sign(
  world: { world: string; date: Day },
  joined: SchoolJoined,
  states: Record<number, 'held' | 'not-held'>,
  of = '1م2',
  start = 480,
  group = '',
) {
  const { parts } = await readSignChannel(world, joined, kit, server.send);
  const week = weeksToSign(parts, world.date, DAYS, SUBJECTS).find((one) => one.class === of)!;
  const slots = new Map(
    Object.entries(states).map(([day, state]) => [`${day}\n${start}\n${start + 60}\n${group}\nboth`, state]),
  );
  const first = weekStart(world.date, DAYS);
  const record = await weekRecord(readJoinCode(joined.code)!.school, week, first, slots, kit.mac);
  await signTheWeek(world, joined, record, kit, server.send);
}

/** A term with 1م2's three weekly sessions signed over two weeks and 1م3's session never signed. */
export async function signedTerm() {
  const { id, here, joined } = await setting();
  const sessions = [0, 1, 2].map((day) => session(TEACHER, day as 0 | 1 | 2, 480));
  await sendParts(here, school, [...sessions, session(TEACHER, 0, 540, '1م3')], BELLS);
  await sign({ world: id, date: FIRST }, joined, { 0: 'held', 1: 'not-held' });
  await sign({ world: id, date: SECOND }, joined, { 0: 'held', 1: 'held', 2: 'not-held' });
  return { id, here, joined };
}

/** A new code issued to a teacher of the staff list, and a new device joined on it. */
export async function joinNew(
  id: string,
  here: Parameters<typeof holdSchool>[0],
  device: () => Promise<typeof here>,
  teacher: string,
) {
  const desk = await holdSchool(here, kit, server.send);
  const assignment = (await assignmentsOf(desk, STAFF, kit)).get(teacher)!;
  const { kept, desk: after } = await issueFor(here, desk, assignment, 'phone', kit, server.send);
  return joinSchool(await device(), await codeText(id, after, kept), kit, server.send);
}
