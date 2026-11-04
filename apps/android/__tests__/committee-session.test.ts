// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A committee's room on the workspace's PC (#604, answer 638), against a
// made-up demo server: a room with no space yet holds no vote; each seat's vote
// goes on the directorate's or the national space under the seat's key,
// numbered above the seat's votes, and a seat naming its cut again puts
// nothing; the first majority is adopted and shuts the room, also when it came
// in while a vote was being put, and nothing more goes on the stream; a vote
// outside the days, off the plan or of no seat is refused; a vote put again
// after its answer was lost is one vote; a room reads no other committee's
// votes, nor a world's that holds another key; the plan is the pack most of the
// grade's classes pin, of those held, and the subjects those with a pack held.
// Every world, committee and school is made up.

import {
  addDays,
  COMMITTEE_SEATS,
  directorateSpace,
  NATIONAL_COMMITTEE,
  parseDay,
  type CommitteeName,
  type DemoSchool,
  type PlanPack,
} from '@minhajna/core';
import { calendar } from '../jest/world-calendar';
import { DemoServer, codeOf, nodeKit as kit } from '../jest/world-server';
import { NATIONAL_SPACE, type HeldWorld } from '../src/demo/world-calendar-read';
import { startWorld, type Send } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { castVote, committeePlan, committeeSubjects, readCommittee } from '../src/threshold/committee-session';

const server = new DemoServer();
const DAY = parseDay('2030-04-28');
const days = { from: DAY, to: addDays(DAY, 9) };
const ITEMS = ['u4', 'u5', 'u6'];

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

async function started(): Promise<HeldWorld> {
  const one = await startWorld('national', calendar, kit, server.send);
  return { world: one.keys.world, keys: one.keys, sealing: one.sealing };
}

const named = (held: HeldWorld, more: Partial<CommitteeName> = {}): CommitteeName => ({
  world: held.world,
  scope: 'dir-1',
  exam: 'mock',
  subject: 'math',
  grade: '4am',
  ...more,
});

const roomOf = (held: HeldWorld, more: Partial<CommitteeName> = {}) => ({
  name: named(held, more),
  items: ITEMS,
  days,
});

async function batchesIn(world: string, space: string) {
  const answer = await server.send({ method: 'GET', path: `/worlds/${world}/spaces/${space}/batches?after=0` });
  return answer.status === 200 ? (answer.body as { batches: unknown[] }).batches.length : 0;
}

test('a room with no space yet holds no vote', async () => {
  const held = await started();
  const state = await readCommittee(held, roomOf(held), kit, server.send);
  expect([state.votes.size, state.proposed, state.adopted, state.majority]).toEqual([0, null, null, 2]);
});

test('votes go on the directorate’s space, numbered up, and the first majority shuts the room', async () => {
  const held = await started();
  const room = roomOf(held);
  await castVote(held, room, 0, 'u5', DAY, kit, server.send);
  const space = await directorateSpace(held.world, 'dir-1', kit.mac);
  expect(await batchesIn(held.world, space)).toBe(1);
  let state = await readCommittee(held, room, kit, server.send);
  expect(state.proposed).toEqual({ item: 'u5', seats: [0] });
  await castVote(held, room, 0, 'u5', DAY, kit, server.send);
  expect(await batchesIn(held.world, space)).toBe(1);
  await castVote(held, room, 0, 'u6', addDays(DAY, 1), kit, server.send);
  state = await readCommittee(held, room, kit, server.send);
  expect([state.votes.get(0)?.item, state.votes.get(0)?.version, state.votes.get(0)?.day]).toEqual([
    'u6',
    1,
    addDays(DAY, 1),
  ]);
  await castVote(held, room, 0, 'u5', addDays(DAY, 2), kit, server.send);
  await castVote(held, room, 1, null, DAY, kit, server.send);
  state = await readCommittee(held, room, kit, server.send);
  expect([state.votes.get(0)?.version, state.proposed?.item, state.adopted]).toEqual([2, 'u5', null]);
  await castVote(held, room, 2, 'u5', addDays(DAY, 3), kit, server.send);
  state = await readCommittee(held, room, kit, server.send);
  expect(state.adopted).toEqual({ item: 'u5', seats: [0, 2], day: addDays(DAY, 3) });
  const put = await batchesIn(held.world, space);
  await expect(castVote(held, room, 1, 'u5', DAY, kit, server.send)).rejects.toMatchObject({ code: 'E_CUT_CLOSED' });
  await expect(castVote(held, room, 2, 'u5', DAY, kit, server.send)).rejects.toMatchObject({ code: 'E_CUT_CLOSED' });
  expect((await readCommittee(held, room, kit, server.send)).adopted?.item).toBe('u5');
  expect(await batchesIn(held.world, space)).toBe(put);
});

test('a national committee of five takes three seats, on the national space', async () => {
  const held = await started();
  const room = roomOf(held, { scope: NATIONAL_COMMITTEE, exam: 'bem' });
  const before = await batchesIn(held.world, NATIONAL_SPACE);
  for (const seat of [0, 4]) await castVote(held, room, seat, 'u6', DAY, kit, server.send);
  let state = await readCommittee(held, room, kit, server.send);
  expect([state.adopted, state.majority]).toEqual([null, 3]);
  await castVote(held, room, COMMITTEE_SEATS.national - 3, 'u6', DAY, kit, server.send);
  state = await readCommittee(held, room, kit, server.send);
  expect(state.adopted?.seats).toEqual([0, 4, 2]);
  expect(await batchesIn(held.world, NATIONAL_SPACE)).toBe(before + 3);
});

test('a vote outside the days, off the plan or of no seat is refused and puts nothing', async () => {
  const held = await started();
  const room = roomOf(held);
  const refused = async (seat: number, item: string | null, day = DAY) =>
    castVote(held, room, seat, item, day, kit, server.send);
  await expect(refused(0, 'u6', addDays(DAY, -1))).rejects.toMatchObject({ code: 'E_CUT_CLOSED' });
  await expect(refused(0, 'u6', addDays(DAY, 10))).rejects.toMatchObject({ code: 'E_CUT_CLOSED' });
  await expect(refused(0, 'off-plan')).rejects.toThrow(RangeError);
  for (const seat of [-1, 0.5, COMMITTEE_SEATS.directorate])
    await expect(refused(seat, 'u6')).rejects.toThrow(RangeError);
  await castVote(held, room, 0, 'u6', days.to, kit, server.send);
  const space = await directorateSpace(held.world, 'dir-1', kit.mac);
  expect(await batchesIn(held.world, space)).toBe(1);
});

test('a majority come in while a vote is put shuts it, and another seat’s vote is put on top', async () => {
  const held = await started();
  const room = roomOf(held);
  await castVote(held, room, 0, 'u6', DAY, kit, server.send);
  const before = (other: () => Promise<void>): Send => {
    let first = true;
    return async (request) => {
      if (first && request.method === 'POST') {
        first = false;
        await other();
      }
      return server.send(request);
    };
  };
  const top = before(() => castVote(held, room, 1, 'u5', DAY, kit, server.send));
  await castVote(held, room, 2, 'u4', DAY, kit, top);
  let state = await readCommittee(held, room, kit, server.send);
  expect([...state.votes.keys()]).toEqual([0, 1, 2]);
  const shutting = before(() => castVote(held, room, 1, 'u6', DAY, kit, server.send));
  expect(await codeOf(castVote(held, room, 2, 'u5', DAY, kit, shutting))).toBe('E_CUT_CLOSED');
  const space = await directorateSpace(held.world, 'dir-1', kit.mac);
  expect(await batchesIn(held.world, space)).toBe(4);
  state = await readCommittee(held, room, kit, server.send);
  expect([state.adopted?.item, state.votes.get(2)?.item]).toEqual(['u6', 'u4']);
});

test('a vote put again after its answer was lost stays one vote', async () => {
  const held = await started();
  const room = roomOf(held);
  let lost = true;
  const losing: Send = async (request) => {
    const answer = await server.send(request);
    if (lost && request.method === 'POST') {
      lost = false;
      return { status: 409, body: null, retryAfter: null };
    }
    return answer;
  };
  await castVote(held, room, 1, 'u6', DAY, kit, losing);
  const state = await readCommittee(held, room, kit, server.send);
  const space = await directorateSpace(held.world, 'dir-1', kit.mac);
  expect([state.votes.get(1)?.version, await batchesIn(held.world, space)]).toEqual([0, 1]);
  lost = true;
  await castVote(held, room, 0, 'u6', DAY, kit, losing);
  const adopted = await readCommittee(held, room, kit, server.send);
  expect([adopted.adopted?.item, await batchesIn(held.world, space)]).toEqual(['u6', 2]);
});

test('a vote counted or not, the seat’s next is numbered above it', async () => {
  const held = await started();
  await castVote(held, roomOf(held), 0, 'u6', addDays(DAY, 5), kit, server.send);
  const narrow = { ...roomOf(held), days: { from: DAY, to: addDays(DAY, 1) } };
  await castVote(held, narrow, 0, 'u6', DAY, kit, server.send);
  const state = await readCommittee(held, narrow, kit, server.send);
  expect(state.votes.get(0)?.version).toBe(1);
});

test('a room is of the world held', async () => {
  const held = await started();
  const other = roomOf({ ...held, world: 'B7QF4' });
  await expect(readCommittee(held, other, kit, server.send)).rejects.toThrow(RangeError);
  await expect(castVote(held, other, 0, 'u6', DAY, kit, server.send)).rejects.toThrow(RangeError);
});

test('a room reads no other committee’s votes, nor under another world’s key', async () => {
  const held = await started();
  await castVote(held, roomOf(held), 0, 'u6', DAY, kit, server.send);
  expect((await readCommittee(held, roomOf(held), kit, server.send)).votes.size).toBe(1);
  for (const more of [{ exam: 'other' }, { subject: 'arabic' }, { grade: '3am' }, { scope: 'dir-2' }])
    expect((await readCommittee(held, roomOf(held, more), kit, server.send)).votes.size).toBe(0);
  const other = { ...held, sealing: new Uint8Array(32).fill(9) };
  expect((await readCommittee(other, roomOf(held), kit, server.send)).votes.size).toBe(0);
});

test('a problem reading says the server’s code', async () => {
  const held = await started();
  const broken: Send = () => Promise.resolve({ status: 500, body: null, retryAfter: null });
  expect(await codeOf(readCommittee(held, roomOf(held), kit, broken))).toBe('E_WORLD_SERVER');
  expect(await codeOf(castVote(held, roomOf(held), 0, 'u6', DAY, kit, broken))).toBe('E_WORLD_SERVER');
});

test('the plan is the pack most of the grade’s classes pin, the subjects those with a pack held', () => {
  const pack = (id: string): PlanPack => ({ id, release: '1', items: [] }) as unknown as PlanPack;
  const packs = [pack('p-1'), pack('p-2')];
  const pinned = (grade: string, packsOf: Record<string, string>) => ({
    grade,
    packs: Object.fromEntries(Object.entries(packsOf).map(([key, id]) => [key, { id, release: '1' }])),
  });
  const schools = [
    {
      classes: [
        pinned('4am', { math: 'p-1', art: 'p-absent' }),
        pinned('4am', { math: 'p-2', arabic: 'p-2' }),
        pinned('3am', { math: 'p-1', physics: 'p-1' }),
      ],
    },
    { classes: [pinned('4am', { math: 'p-2' })] },
  ] as unknown as Pick<DemoSchool, 'classes'>[];
  expect(committeeSubjects(schools, packs, '4am')).toEqual(['math', 'arabic']);
  expect(committeePlan(schools, packs, '4am', 'math')?.id).toBe('p-2');
  expect(committeePlan(schools, packs, '3am', 'math')?.id).toBe('p-1');
  expect(
    committeePlan(
      schools.slice(0, 1).map((one) => ({ classes: one.classes.slice(0, 2) })),
      packs,
      '4am',
      'math',
    )?.id,
  ).toBe('p-1');
  expect(committeePlan(schools, packs, '4am', 'art')).toBeNull();
  const fewer = [{ classes: [1, 2, 3].map(() => pinned('4am', { math: 'p-absent' })) }, ...schools.slice(0, 1)];
  expect(committeePlan(fewer as typeof schools, packs.slice(0, 1), '4am', 'math')?.id).toBe('p-1');
  expect(committeePlan(schools, packs, '2am', 'math')).toBeNull();
});
