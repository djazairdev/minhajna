// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What I-Grant reads on the inspector's phone (#594, answer 622), on the
// made-up term of grant-term.ts: before any grant none is relayed; once the
// director grants a request, the grant is listed with its school as the
// directorate lists it, and opening 1م2 posts one use for each of its two weeks
// before reading, which the teacher reads with the keys of their notice and the
// school's devices check, then counts its two signed weeks from the archive:
// three sessions held, one not held for another cause and one taken by
// Yennayer, the awaiting one not counted; opening it again that day posts
// nothing, and the next day one use a week more; past its end the grant is
// listed as ended, and opening it is refused before anything is put; a
// corrected week and a visa are counted; a grant not yet open, or listed for
// another device, is left out and opens no class; a directorate space not there
// yet holds no grant, and an erased world is said as erased. Every school,
// class, teacher and device is made up.

import {
  addDays,
  checkUse,
  correctWeek,
  openGrantUses,
  parseDay,
  usePlace as placeOfUses,
  type GrantNotice,
  type SignedTimetable,
} from '@minhajna/core';
import { SCHOOL } from '../jest/grant-world';
import { grantTerm, noticesOf, STAFFED, WEEKS } from '../jest/grant-term';
import { MINE, SECOND } from '../jest/term-weeks';
import { server } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { approveGrant } from '../src/director/grant-make';
import { readGrants } from '../src/director/grant-session';
import { readRecords } from '../src/director/records-session';
import { giveVisa } from '../src/director/visa-session';
import { openGrantClass, readInspectorGrants } from '../src/inspector/grant-read';
import { leaveWorldNetwork } from '../src/network/world-network';
import { spaceBatches } from '../src/school/space-read';
import { readSignChannel, signTheWeek } from '../src/week/week-sign-session';
import { deliveryReading } from '../src/week/school-mine-session';

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

const reading = deliveryReading(MINE, [], []);
const codeOf = (step: Promise<unknown>) =>
  step.then(
    () => null,
    (error: unknown) => (error as { code?: string }).code,
  );
const posts = () => server.seen.filter((one) => one.method === 'POST' && one.path.endsWith('/batches')).length;

async function granted() {
  const term = await grantTerm();
  const request = await term.ask();
  const grant = await approveGrant(term.director, STAFFED, request.id, term.fingerprint, kit, server.send);
  const [notice] = await noticesOf(term.joined);
  return { ...term, grant, notice };
}

/** The uses on the teacher's streams, read with the keys of their notice. */
async function usesOf(world: string, notice: SignedTimetable<GrantNotice>) {
  const batches = await spaceBatches(world, notice.value.school, server.send);
  const found = [];
  for (const { key } of notice.value.uses) {
    const place = await placeOfUses(Uint8Array.from(Buffer.from(key, 'hex')), kit.mac);
    found.push(...(await openGrantUses(place, batches.get(place.stream) ?? [], kit.cipher)));
  }
  return found;
}

test('no grant is relayed before the director makes one', async () => {
  const { inspector } = await grantTerm();
  expect(await readInspectorGrants(inspector, SCHOOL.directorateId, kit, server.send)).toEqual([]);
});

test('opening a class posts a use a week first, then counts its signed weeks from the archive', async () => {
  const { director, desk, inspector, grant, notice } = await granted();
  const listed = await readInspectorGrants(inspector, SCHOOL.directorateId, kit, server.send);
  expect(listed.map((one) => [one.grant.id, one.school, one.ended])).toEqual([[grant.id, SCHOOL.id, false]]);
  const [course] = new Set(grant.weeks.map((one) => one.course));
  const start = server.seen.length;
  const read = await openGrantClass(inspector, listed[0].grant, course, reading, kit, server.send);
  const delivery = read?.delivery;
  const asked = server.seen.slice(start).map((one) => one.method + ' ' + one.path.split('/').at(-1));
  expect(asked.filter((one) => one === 'POST batches').length).toBe(2);
  expect(asked.lastIndexOf('POST batches')).toBeLessThan(asked.indexOf('GET ca'));
  expect(delivery && [delivery.class, delivery.weeks, delivery.lastWeek]).toEqual(['1م2', 2, WEEKS[1]]);
  expect(delivery && [delivery.held, delivery.other, delivery.calendar]).toEqual([3, 1, 1]);
  expect(delivery?.lost.filter((one) => one.entry !== null).map((one) => one.day)).toEqual([parseDay('2027-01-12')]);
  expect(read && [read.corrections, read.visas]).toEqual([0, 0]);
  const uses = await usesOf(director.world, notice);
  expect(uses.map((one) => [one.week, one.day])).toEqual(WEEKS.map((week) => [week, inspector.date]));
  const made = (await readGrants(director, STAFFED, kit, server.send)).asked[0].made!.grant;
  for (const one of uses) expect(await checkUse(desk.opened, made, one, desk.crypto)).toBe(true);
  const before = posts();
  await openGrantClass(inspector, listed[0].grant, course, reading, kit, server.send);
  expect(posts()).toBe(before);
  const tomorrow = { ...inspector, date: addDays(inspector.date, 1) };
  await openGrantClass(tomorrow, listed[0].grant, course, reading, kit, server.send);
  expect((await usesOf(director.world, notice)).map((one) => one.day)).toEqual([
    inspector.date,
    tomorrow.date,
    inspector.date,
    tomorrow.date,
  ]);
});

test('past its end the grant is listed as ended, and no class of it opens', async () => {
  const { director, inspector, grant, notice } = await granted();
  const after = { ...inspector, date: addDays(grant.until, 1) };
  const listed = await readInspectorGrants(after, SCHOOL.directorateId, kit, server.send);
  expect(listed.map((one) => [one.grant.id, one.ended])).toEqual([[grant.id, true]]);
  const before = posts();
  await expect(openGrantClass(after, grant, grant.weeks[0].course, reading, kit, server.send)).rejects.toMatchObject({
    code: 'E_GRANT_ENDED',
  });
  expect(posts()).toBe(before);
  expect(await usesOf(director.world, notice)).toEqual([]);
});

test('an opened class counts the corrections and visas its archived weeks hold', async () => {
  const { id, director, joined, inspector, fingerprint, ask } = await grantTerm();
  const world = { world: id, date: SECOND };
  const latest = (await readSignChannel(world, joined, kit, server.send)).weeks.find(
    (one) => one.week.week === WEEKS[1],
  )!.week;
  await signTheWeek(
    world,
    joined,
    correctWeek(latest, latest.sessions[2], 'held', 'confirmed-later'),
    kit,
    server.send,
  );
  const records = await readRecords(director, STAFFED, kit, server.send);
  const course = records.flatMap((one) => one.courses).find((one) => one.class === '1م2')!;
  await giveVisa(
    director,
    course.weeks.find((one) => one.week.week === WEEKS[0])!,
    kit,
    server.send,
  );
  const grant = await approveGrant(director, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  const read = await openGrantClass(inspector, grant, course.course, reading, kit, server.send);
  expect(read && [read.corrections, read.visas]).toEqual([1, 1]);
  expect(read && [read.delivery.held, read.delivery.other, read.delivery.calendar]).toEqual([4, 1, 0]);
});

test('a grant not yet open or for another device is left out and opens no class', async () => {
  const { device, inspector, grant } = await granted();
  const before = { ...inspector, date: addDays(grant.from, -1) };
  expect(await readInspectorGrants(before, SCHOOL.directorateId, kit, server.send)).toEqual([]);
  const other = await device();
  expect(await readInspectorGrants(other, SCHOOL.directorateId, kit, server.send)).toEqual([]);
  const sent = posts();
  for (const one of [before, other])
    expect(await codeOf(openGrantClass(one, grant, grant.weeks[0].course, reading, kit, server.send))).toBe(
      'E_GRANT_FORGED',
    );
  expect(posts()).toBe(sent);
});

test('a directorate space not there yet holds no grant, and an erased world is said as erased', async () => {
  const { inspector } = await grantTerm();
  expect(await readInspectorGrants(inspector, 'directorate-9', kit, server.send)).toEqual([]);
  server.worlds.clear();
  expect(await codeOf(readInspectorGrants(inspector, SCHOOL.directorateId, kit, server.send))).toBe('E_NO_SUCH_WORLD');
});
