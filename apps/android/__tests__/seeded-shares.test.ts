// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The seeded schools' shares of the totals from the device that started the
// world (#596, answer 628), against a made-up demo server: once the date moves
// onto an announced day, every seeded school's share for it is put, from the
// term generator's weeks up to that day, under the ID the director's device
// makes once it took the school's key, and is not worked out or put again while
// the same; a send that failed partway is finished by the next, which puts only
// what is missing; a day the server does not take puts none; and a world with
// no seeded key sends none. Every world, school and teacher is made up.

import {
  directorSchool,
  seededShare,
  seededTerm,
  schoolPlans,
  schoolStaffing,
  seedNationalWorld,
  type TotalsShare,
} from '@minhajna/core';
import { FakeStorage } from '../jest/fake-storage';
import { calendar, reference } from '../jest/world-calendar';
import { DemoServer, nodeKit } from '../jest/world-server';
import { sendSeededShares } from '../src/demo/seeded-shares';
import { startSeededWorld } from '../src/demo/world-seed';
import { moveWorldDate, startWorld, type Send } from '../src/demo/world-session';
import { seededWorld } from '../src/director/director-world';
import { holdSchool } from '../src/director/issue-session';
import { termReference, worldClosure } from '../src/director/seeded-fill';
import { seededKeyOf, takeSeededKey } from '../src/director/seeded-key';
import { termStart } from '../src/director/share-send';
import { leaveWorldNetwork } from '../src/network/world-network';
import { openRecordBook } from '../src/storage/history';

const server = new DemoServer();

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

async function moved() {
  const started = await startSeededWorld('national', calendar, reference, nodeKit, server.send);
  const id = started.keys.world;
  const held = { world: id, keys: started.keys, sealing: started.sealing };
  const day = await moveWorldDate(id, started.starter, started.date, server.send);
  return { id, held, started, day };
}

test('every seeded school’s share is put for the day reached, under the ID its director makes', async () => {
  const { id, held, started, day } = await moved();
  const demo = seededWorld(id, reference);
  expect(await sendSeededShares(held, day, reference, nodeKit, server.send)).toBe(demo.schools.length);
  const shares = [...server.shares.values()] as TotalsShare[];
  expect(shares).toHaveLength(demo.schools.length);
  expect(new Set(shares.map((one) => one.id)).size).toBe(shares.length);
  const { zones = [], workingDays } = reference.profile;
  const school = directorSchool(seedNationalWorld(id, zones, workingDays, reference.packs))!;
  const director = { world: id, date: day, book: await openRecordBook(new FakeStorage().asSpec()) };
  await takeSeededKey(director, held, school, nodeKit, server.send);
  const desk = await holdSchool(director, nodeKit, server.send, false);
  const seeded = (await seededKeyOf(held, school.id, nodeKit, server.send))!;
  const input = { seed: id, school, space: seeded.space, reference: termReference(reference) };
  const more = { closures: [worldClosure(demo, reference)], bells: reference.bells, until: day };
  const weeks = await seededTerm({ ...input, ...more }, nodeKit.mac);
  const from = termStart(reference.calendar, day)!;
  const common = {
    school: desk.opened,
    day,
    from,
    directorate: school.directorateId,
    staffing: schoolStaffing(school),
  };
  const itemsOf = ({ id: pack, release }: { id: string; release: string }) =>
    reference.packs.find((one) => one.id === pack && one.release === release)?.items.map((item) => item.id);
  const plans = await schoolPlans(seeded.space, school, itemsOf, nodeKit.mac);
  const yearFrom = reference.calendar.year.from;
  const theirs = await seededShare({ ...common, plans, yearFrom, weeks }, desk.crypto);
  expect(shares).toContainEqual(theirs);
  expect(theirs.subjects.math.classes).toBeGreaterThan(0);
  expect(Object.keys(theirs.subjects.math.grades ?? {}).length).toBeGreaterThan(0);
  const before = server.seen.length;
  expect(await sendSeededShares(held, day, reference, nodeKit, server.send)).toBe(0);
  expect(server.shares.size).toBe(demo.schools.length);
  expect(server.seen.length - before).toBeLessThan(demo.schools.length);
  expect(started.date < day).toBe(true);
}, 120_000);

test('a send that failed partway is finished by the next, which puts only what is missing', async () => {
  const { id, held, day } = await moved();
  let puts = 0;
  const failing: Send = (request) => {
    if (request.method === 'PUT' && (puts += 1) > 3)
      return Promise.resolve({ status: 500, body: null, retryAfter: null });
    return server.send(request);
  };
  await expect(sendSeededShares(held, day, reference, nodeKit, failing)).rejects.toMatchObject({
    code: 'E_WORLD_SERVER',
  });
  const kept = server.shares.size;
  expect(kept).toBeGreaterThanOrEqual(3);
  const schools = seededWorld(id, reference).schools.length;
  expect(await sendSeededShares(held, day, reference, nodeKit, server.send)).toBe(schools - kept);
  expect(server.shares.size).toBe(schools);
}, 120_000);

test('a day the server does not take puts none, and a world with no seeded key sends none', async () => {
  const { held, started } = await moved();
  expect(await sendSeededShares(held, started.date, reference, nodeKit, server.send)).toBe(0);
  leaveWorldNetwork();
  const plain = await startWorld('national', calendar, nodeKit, server.send);
  const bare = { world: plain.keys.world, keys: plain.keys, sealing: plain.sealing };
  const day = await moveWorldDate(bare.world, plain.starter, plain.date, server.send);
  expect(await sendSeededShares(bare, day, reference, nodeKit, server.send)).toBe(0);
  expect(server.shares.size).toBe(0);
}, 120_000);
