// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up school for the timetable's sending tests (#577, #578): a demo
// server with its relay and CA, a staff list of six teachers, two sharing a
// name, a started national world whose director's device holds the school key
// and issued codes or a key to four of them, one teacher joined on a code, and
// how to read a teacher's channel back and send a version.

import {
  channelParts,
  channelStream,
  readJoinCode,
  readJoined,
  readPart,
  type DemoTeacher,
  type ImportedSession,
  type JoinCode,
  type SchoolCalendar,
} from '@minhajna/core';
import { startWorld, type Send } from '../src/demo/world-session';
import { assignmentsOf, codeText, holdSchool, issueFor, keyCodeText } from '../src/director/issue-session';
import { bundledReference, readReference } from '../src/reference';
import { joinSchool } from '../src/school/school-join-session';
import { caKey, spaceBatches } from '../src/school/space-read';
import { openRecordBook } from '../src/storage/history';
import { partFrom } from '../src/timetable/send-session';
import { draftVersion, publishVersion } from '../src/timetable/version-session';
import { FakeStorage } from './fake-storage';
import { DemoServer, nodeKit as kit } from './world-server';

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const calendar: SchoolCalendar = read.calendar;
export const server = new DemoServer();
export const BELLS = [
  [480, 540],
  [540, 600],
] as const;

const person = (id: string, name: string, latinName: string): DemoTeacher => ({
  id,
  subject: 'math',
  classIds: [],
  name,
  latinName,
  sex: 'm',
});
export const STAFF = [
  person('teacher-1', 'بلعيد محمد', 'Belaid Mohamed'),
  person('teacher-2', 'صالحي زهية', 'Salhi Zahia'),
  person('teacher-3', 'نوري سليم', 'Nouri Slimane'),
  person('teacher-4', 'قاسمي رضا', 'Kacimi Reda'),
  person('teacher-5', 'حداد علي', 'Haddad Ali'),
  person('teacher-6', 'حداد  علي', ''),
];
export const school = { name: 'متوسطة المختلقة', teachers: STAFF };

export const session = (teacher: string, day: 0 | 1 | 2, start: number, of = '1م2'): ImportedSession => ({
  row: 2,
  class: of,
  group: '',
  subject: 'رياضيات',
  teacher,
  room: 'ق1',
  day,
  start,
  end: start + 60,
  week: 'both',
});

/** A started world, its director's device holding the school key, and codes or a key issued. */
export async function setting() {
  const started = await startWorld('national', calendar, kit, server.send);
  const id = started.keys.world;
  const device = async () => ({
    world: id,
    date: started.date,
    book: await openRecordBook(new FakeStorage().asSpec()),
  });
  const here = await device();
  const desk = await holdSchool(here, kit, server.send);
  const assignments = await assignmentsOf(desk, STAFF, kit);
  const issue = async (teacher: string, access: 'phone' | 'key') =>
    (await issueFor(here, desk, assignments.get(teacher)!, access, kit, server.send)).kept;
  const phone = await issue('teacher-1', 'phone');
  const key = await issue('teacher-2', 'key');
  await issue('teacher-4', 'phone');
  await issue('teacher-5', 'phone');
  const text = await codeText(id, desk, phone);
  const joined = await joinSchool(await device(), text, kit, server.send);
  const keyCode = readJoinCode(await keyCodeText(id, desk, key))!;
  return { id, here, device, code: readJoinCode(text)!, keyCode, joined };
}

export async function channel(code: JoinCode) {
  const batches = (await spaceBatches(code.world, code.school, server.send)).get(await channelStream(code, kit.mac));
  const ca = { key: await caKey(code.world, server.send), checker: kit };
  const joined = await readJoined(code, batches ?? [], ca, kit.cipher, kit.mac);
  const device = joined?.device ?? null;
  return {
    latest: await readPart(code, batches ?? [], ca, device, kit.cipher, kit.mac),
    all: await channelParts(code, batches ?? [], ca, device, kit.cipher, kit.mac),
  };
}

export const certifying = () =>
  server.seen.filter((one) => one.method === 'POST' && one.path.endsWith('/certificates'));

/** Drafts a version from the sessions and publishes it, from the next Sunday unless chosen otherwise. */
export async function sendParts(
  world: Parameters<typeof draftVersion>[0],
  of: Parameters<typeof draftVersion>[1],
  sessions: readonly ImportedSession[],
  bells: Parameters<typeof draftVersion>[3],
  send: Send = server.send,
  choice = { from: partFrom(world.date), once: false },
) {
  return publishVersion(world, await draftVersion(world, of, sessions, bells, kit, send), choice, kit, send);
}
