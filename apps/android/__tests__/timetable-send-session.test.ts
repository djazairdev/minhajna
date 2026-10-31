// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Sending each teacher their part of the timetable from the director's device
// (#577, answer 605), against a made-up demo server with the server's own relay
// and CA: a teacher of the staff list with a code or a key is sent their part
// under either spelling of their name, both spellings counting as one, while
// one with nothing issued yet, one not in the staff list, one whose name two of
// the staff list share, and one whose part is too long are named apart; the
// teacher's channel reads back the part, from the next Sunday with the level's
// bell times, after the teacher joined on the code; sending again counts the
// version up under the same key, certified once; a write that came first is
// read again, and one that keeps coming first names the teacher with the server
// busy; a certificate that does not come, or is not this key's, sends nothing
// and is asked for again next time; a part that does not reach the server names
// its teacher while the others are sent; a device that holds no school key
// sends nothing. Every world, school and teacher is made up.

import {
  addDays,
  channelParts,
  channelStream,
  readJoinCode,
  readJoined,
  readPart,
  weekday,
  type DemoTeacher,
  type ImportedSession,
  type JoinCode,
  type SchoolCalendar,
} from '@minhajna/core';
import { FakeStorage } from '../jest/fake-storage';
import { codeOf, DemoServer, nodeKit as kit } from '../jest/world-server';
import { startWorld, type Send } from '../src/demo/world-session';
import type { WorldAnswer } from '../src/network/world-network';
import { assignmentsOf, codeText, holdSchool, issueFor, keyCodeText } from '../src/director/issue-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { joinSchool } from '../src/school/school-join-session';
import { caKey, spaceBatches } from '../src/school/space-read';
import { openRecordBook } from '../src/storage/history';
import { partFrom, sendParts } from '../src/timetable/send-session';

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const calendar: SchoolCalendar = read.calendar;
const server = new DemoServer();
const BELLS = [
  [480, 540],
  [540, 600],
] as const;

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

const person = (id: string, name: string, latinName: string): DemoTeacher => ({
  id,
  subject: 'math',
  classIds: [],
  name,
  latinName,
  sex: 'm',
});
const STAFF = [
  person('teacher-1', 'بلعيد محمد', 'Belaid Mohamed'),
  person('teacher-2', 'صالحي زهية', 'Salhi Zahia'),
  person('teacher-3', 'نوري سليم', 'Nouri Slimane'),
  person('teacher-4', 'قاسمي رضا', 'Kacimi Reda'),
  person('teacher-5', 'حداد علي', 'Haddad Ali'),
  person('teacher-6', 'حداد  علي', ''),
];
const school = { name: 'متوسطة المختلقة', teachers: STAFF };

const session = (teacher: string, day: 0 | 1 | 2, start: number, of = '1م2'): ImportedSession => ({
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
async function setting() {
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

async function channel(code: JoinCode) {
  const batches = (await spaceBatches(code.world, code.school, server.send)).get(await channelStream(code, kit.mac));
  const ca = { key: await caKey(code.world, server.send), checker: kit };
  const joined = await readJoined(code, batches ?? [], ca, kit.cipher, kit.mac);
  const device = joined?.device ?? null;
  return {
    latest: await readPart(code, batches ?? [], ca, device, kit.cipher, kit.mac),
    all: await channelParts(code, batches ?? [], ca, device, kit.cipher, kit.mac),
  };
}

const certifying = () => server.seen.filter((one) => one.method === 'POST' && one.path.endsWith('/certificates'));

test('each teacher with a code or a key is sent their part, and the others are named apart', async () => {
  const { here, code, keyCode, joined } = await setting();
  const long = 'م'.repeat(81);
  const sessions = [
    session('بلعيد محمد', 1, 480),
    session(' belaid  MOHAMED ', 0, 540),
    session('Salhi Zahia', 2, 600),
    session('نوري سليم', 0, 480),
    session('مختلق غريب', 0, 480),
    session('قاسمي رضا', 0, 480, long),
    session('حداد علي', 1, 540),
  ];
  const before = certifying().length;
  const sent = await sendParts(here, school, sessions, BELLS, kit, server.send);
  expect(sent).toEqual({
    sent: ['بلعيد محمد', 'Salhi Zahia'],
    noCode: ['نوري سليم'],
    notStaff: ['مختلق غريب'],
    twoNames: ['حداد علي'],
    tooLong: ['قاسمي رضا'],
    failed: [],
    problem: null,
  });
  const first = await channel(code);
  expect(first.latest?.part).toMatchObject({
    teacher: 'بلعيد محمد',
    version: 1,
    issue: 1,
    schoolName: school.name,
    from: partFrom(here.date),
    bells: BELLS,
  });
  expect(first.latest?.part.sessions.map((one) => [one.day, one.start])).toEqual([
    [0, 540],
    [1, 480],
  ]);
  expect(first.latest?.certificate.subject).not.toBe(joined.device);
  expect((await channel(keyCode)).latest?.part.teacher).toBe('Salhi Zahia');
  await sendParts(here, school, sessions.slice(0, 1), BELLS, kit, server.send);
  const second = await channel(code);
  expect(second.all.map((one) => one.part.version)).toEqual([1, 2]);
  expect(second.latest?.part.sessions).toHaveLength(1);
  expect(second.latest?.certificate.publicKey).toBe(first.latest?.certificate.publicKey);
  expect(certifying().length - before).toBe(1);
  expect(JSON.stringify(server.seen)).not.toContain('pkcs8');
});

test('a part applies from the next Sunday, a week on when sent on a Sunday', () => {
  const sunday = '2026-11-01' as Parameters<typeof partFrom>[0];
  expect(weekday(sunday)).toBe(0);
  expect(partFrom(sunday)).toBe(addDays(sunday, 7));
  expect(partFrom(addDays(sunday, 4))).toBe(addDays(sunday, 7));
});

test('a write that came first is read again, and one that keeps coming first says the server is busy', async () => {
  const { here, code } = await setting();
  let refused = 0;
  const racing =
    (times: number): Send =>
    async (request) => {
      if (request.method === 'POST' && request.path.endsWith('/batches') && refused < times) {
        refused += 1;
        return { status: 409, body: null, retryAfter: null };
      }
      return server.send(request);
    };
  await sendParts(here, school, [session('بلعيد محمد', 1, 480)], BELLS, kit, racing(1));
  expect(refused).toBe(1);
  expect((await channel(code)).all).toHaveLength(1);
  refused = 0;
  const busy = await sendParts(here, school, [session('بلعيد محمد', 1, 480)], BELLS, kit, racing(9));
  expect(busy).toMatchObject({ sent: [], failed: ['بلعيد محمد'] });
  expect((busy.problem as { code?: string }).code).toBe('E_WORLD_BUSY');
  expect((await channel(code)).all).toHaveLength(1);
});

test('a certificate that does not come, or is not this key’s, sends nothing, and is asked for again', async () => {
  const { here, code } = await setting();
  const sessions = [session('بلعيد محمد', 1, 480), session('Salhi Zahia', 2, 600)];
  const certifyingWith =
    (change: (answer: WorldAnswer) => WorldAnswer): Send =>
    async (request) => {
      const answer = await server.send(request);
      return request.method === 'POST' && request.path.endsWith('/certificates') ? change(answer) : answer;
    };
  const asked = certifying().length;
  const down = await sendParts(
    here,
    school,
    sessions,
    BELLS,
    kit,
    certifyingWith(() => ({ status: 503, body: null, retryAfter: null })),
  );
  expect(down).toMatchObject({ sent: [], failed: ['بلعيد محمد', 'Salhi Zahia'] });
  expect(certifying().length - asked).toBe(1);
  expect((down.problem as { code?: string }).code).toBe('E_WORLD_SERVER');
  const other = (answer: WorldAnswer) => ({
    ...answer,
    body: { ...(answer.body as object), subject: 'another-made-up-device' },
  });
  const wrong = await sendParts(here, school, sessions, BELLS, kit, certifyingWith(other));
  expect(wrong.sent).toEqual([]);
  expect((await channel(code)).all).toHaveLength(0);
  const before = certifying().length;
  expect((await sendParts(here, school, sessions, BELLS, kit, server.send)).sent).toHaveLength(2);
  expect(certifying().length - before).toBe(1);
});

test('a part that does not reach the server names its teacher, and the others are still sent', async () => {
  const { here, code, keyCode } = await setting();
  const stream = await channelStream(code, kit.mac);
  const failing: Send = async (request) => {
    const body = request.body as { stream?: unknown } | undefined;
    if (request.method === 'POST' && body?.stream === stream) return { status: 500, body: null, retryAfter: null };
    return server.send(request);
  };
  const sessions = [session('بلعيد محمد', 1, 480), session('Salhi Zahia', 2, 600)];
  const found = await sendParts(here, school, sessions, BELLS, kit, failing);
  expect(found).toMatchObject({ sent: ['Salhi Zahia'], failed: ['بلعيد محمد'] });
  expect(found.problem).not.toBeNull();
  expect((await channel(code)).all).toHaveLength(0);
  expect((await channel(keyCode)).all).toHaveLength(1);
});

test('a device that holds no school key sends nothing', async () => {
  const { device } = await setting();
  const other = await device();
  const before = server.seen.length;
  expect(await codeOf(sendParts(other, school, [session('بلعيد محمد', 1, 480)], BELLS, kit, server.send))).toBe(
    'E_NO_SCHOOL_KEY',
  );
  expect(server.seen.slice(before).filter((one) => one.method === 'POST')).toEqual([]);
});
