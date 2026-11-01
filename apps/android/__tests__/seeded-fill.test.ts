// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Filling a seeded school's term of signed weeks (#549, answer 626), against a
// made-up demo server: once the director's device took the seeded key, each
// seeded teacher's channel holds every week the core's generator works out for
// the teacher, each signed under the certificate the teacher joined with, and
// filling again, even after the world's date moved, puts nothing; a fill that
// stopped partway is finished by the next, and one whose weeks do not read back
// stops; a teacher whose channel another device joined gets nothing; and the
// fill once taken runs once a session. Every world, school and teacher is made
// up.

import {
  channelWeeks,
  directorSchool,
  seededTerm,
  seedNationalWorld,
  type Day,
  type DemoSchool,
  type SeededSchoolKey,
} from '@minhajna/core';
import { FakeStorage } from '../jest/fake-storage';
import { calendar, reference } from '../jest/world-calendar';
import { codeOf, DemoServer, nodeKit } from '../jest/world-server';
import { startSeededWorld } from '../src/demo/world-seed';
import { failed, type Send } from '../src/demo/world-session';
import { holdSchool } from '../src/director/issue-session';
import { fillSeededTerm, fillTakenTerm, seededCode, termReference, worldClosure } from '../src/director/seeded-fill';
import { seededKeyOf, takeSeededKey } from '../src/director/seeded-key';
import { leaveWorldNetwork } from '../src/network/world-network';
import { caKey } from '../src/school/space-read';
import { openRecordBook } from '../src/storage/history';
import { putOnChannel } from '../src/timetable/send-session';

const server = new DemoServer();

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

const puts = () => server.seen.filter((one) => one.method === 'POST' && one.path.includes('/spaces/')).length;

/** A seeded national world whose director's device took the school's seeded key. */
async function taken() {
  const started = await startSeededWorld('national', calendar, reference, nodeKit, server.send);
  const id = started.keys.world;
  const { zones = [], workingDays } = reference.profile;
  const demo = seedNationalWorld(id, zones, workingDays, reference.packs);
  const school: DemoSchool = directorSchool(demo)!;
  const held = { world: id, keys: started.keys, sealing: started.sealing };
  const open = { world: id, date: started.date, book: await openRecordBook(new FakeStorage().asSpec()) };
  await takeSeededKey(open, held, school, nodeKit, server.send);
  const desk = await holdSchool(open, nodeKit, server.send, false);
  const seeded = (await seededKeyOf(held, school.id, nodeKit, server.send))!;
  const input = {
    seed: id,
    school,
    space: seeded.space,
    reference: termReference(reference),
    closures: [worldClosure(demo, reference)],
    bells: reference.bells,
    until: started.date,
  };
  const term = await seededTerm(input, nodeKit.mac);
  return { open, held, school, desk, seeded, term };
}

type Taken = Awaited<ReturnType<typeof taken>>;

/** Each seeded teacher's weeks on the channel, every version, as `course week version`. */
async function onChannels(world: Taken, seeded: SeededSchoolKey = world.seeded) {
  const ca = await caKey(world.open.world, server.send);
  const out = new Map<string, string[]>();
  for (const teacher of seeded.teachers) {
    const code = await seededCode(world.open.world, world.desk, seeded.space, teacher.seed, nodeKit);
    await putOnChannel(code, ca, nodeKit, server.send, async ({ batches, joined }) => {
      const checker = { key: ca, checker: nodeKit };
      const held =
        joined === null ? [] : await channelWeeks(code, batches, checker, joined, nodeKit.cipher, nodeKit.mac);
      for (const one of held) {
        expect(one.signed.certificate.publicKey).toBe(joined!.certificate.publicKey);
        for (const week of [one, ...one.earlier].map((each) => each.week))
          out.set(teacher.seed, [...(out.get(teacher.seed) ?? []), `${week.course} ${week.week} ${week.version}`]);
      }
      return [];
    });
  }
  return out;
}

/** The weeks the generator works out for each teacher, as `course week version`. */
const expected = (world: Taken) => {
  const out = new Map<string, string[]>();
  for (const one of world.term)
    for (const week of one.versions)
      out.set(one.teacherId, [...(out.get(one.teacherId) ?? []), `${week.course} ${week.week} ${week.version}`]);
  return out;
};

const sorted = (weeks: Map<string, string[]>) => new Map([...weeks].map(([key, list]) => [key, [...list].sort()]));

test('each teacher’s channel holds the generated weeks, signed as joined, and a refill puts nothing', async () => {
  const world = await taken();
  expect(world.term.length).toBeGreaterThan(0);
  await fillSeededTerm(world.open, world.desk, world.seeded, reference, nodeKit, server.send);
  expect(sorted(await onChannels(world))).toEqual(sorted(expected(world)));
  const before = puts();
  await fillSeededTerm(world.open, world.desk, world.seeded, reference, nodeKit, server.send);
  expect(puts()).toBe(before);
});

test('a fill that stopped partway is finished by the next', async () => {
  const world = await taken();
  let left = 3;
  const stopping: Send = (request) =>
    request.method === 'POST' && (left -= 1) < 0
      ? Promise.reject(failed('A made-up failure', 'E_OFFLINE'))
      : server.send(request);
  expect(await codeOf(fillSeededTerm(world.open, world.desk, world.seeded, reference, nodeKit, stopping))).toBe(
    'E_OFFLINE',
  );
  const partway = await onChannels(world);
  expect([...partway.values()].flat().length).toBeGreaterThan(0);
  expect([...partway.values()].flat().length).toBeLessThan(world.term.flatMap((one) => one.versions).length);
  await fillSeededTerm(world.open, world.desk, world.seeded, reference, nodeKit, server.send);
  expect(sorted(await onChannels(world))).toEqual(sorted(expected(world)));
});

test('a fill after the world’s date moved puts nothing more', async () => {
  const world = await taken();
  await fillSeededTerm(world.open, world.desk, world.seeded, reference, nodeKit, server.send);
  const before = puts();
  const moved = { ...world.open, date: '2027-03-21' as Day };
  await fillSeededTerm(moved, world.desk, world.seeded, reference, nodeKit, server.send);
  expect(puts()).toBe(before);
  expect(sorted(await onChannels(world))).toEqual(sorted(expected(world)));
});

test('a fill whose weeks do not read back stops rather than put them again and again', async () => {
  const world = await taken();
  let dropped = 0;
  const dropping: Send = (request) =>
    request.method === 'POST' && (dropped += 1) > 0
      ? Promise.resolve({ status: 201, body: { added: 1 }, retryAfter: null })
      : server.send(request);
  const fill = fillSeededTerm(world.open, world.desk, world.seeded, reference, nodeKit, dropping);
  expect(await codeOf(fill)).toBe('E_WORLD_SERVER');
  const longest = Math.max(...[...expected(world).values()].map((one) => one.length));
  expect(dropped).toBeGreaterThan(0);
  expect(dropped).toBeLessThanOrEqual(Math.ceil(longest / 64) + 1);
  expect(await onChannels(world)).toEqual(new Map());
});

test('a teacher whose channel another device joined gets nothing', async () => {
  const world = await taken();
  const [first, ...rest] = world.seeded.teachers;
  const other = { ...world.seeded, teachers: [{ ...first, device: `${first.device}-other` }, ...rest] };
  await fillSeededTerm(world.open, world.desk, other, reference, nodeKit, server.send);
  const filled = await onChannels(world);
  expect(filled.has(first.seed)).toBe(false);
  expect(
    rest.every((one) => (filled.get(one.seed)?.length ?? 0) === (expected(world).get(one.seed)?.length ?? 0)),
  ).toBe(true);
});

test('the fill of a taken school runs once a session', async () => {
  const world = await taken();
  await fillTakenTerm(world.open, world.desk, world.held, world.school, reference, nodeKit, server.send);
  expect(sorted(await onChannels(world))).toEqual(sorted(expected(world)));
  const before = server.seen.length;
  await fillTakenTerm(world.open, world.desk, world.held, world.school, reference, nodeKit, server.send);
  expect(server.seen).toHaveLength(before);
});
