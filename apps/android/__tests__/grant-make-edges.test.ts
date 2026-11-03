// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's grant at its edges (#593, answer 621), on the made-up term of
// grant-term.ts: two approvals at once keep one grant, recorded, told and
// relayed once, a fingerprint typed in capitals with spaces and a dash taken;
// a later grant over a corrected week gets the week as corrected while the
// earlier keeps its own; a teacher on a new code is told once, on it; after a
// new epoch of the keyring a grant is made under it, and one recorded under the
// older epoch is finished without recording it again; and a directorate space
// open as another kind stops before the relay, which the next approval puts.
// Every school, class, teacher and device is made up.

import { correctWeek, directorateSpace, type Grant } from '@minhajna/core';
import { grantTerm, newEpoch, noticesOf, relayedTo, STAFFED, WEEKS } from '../jest/grant-term';
import { SCHOOL } from '../jest/grant-world';
import { joinNew, SECOND } from '../jest/term-weeks';
import { server } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { approveGrant } from '../src/director/grant-make';
import { grantsOf } from '../src/director/grant-session';
import type { IssueDesk } from '../src/director/issue-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { spaceBatches } from '../src/school/space-read';
import { readSignChannel, signTheWeek } from '../src/week/week-sign-session';

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

const posts = () => server.seen.filter((one) => one.method === 'POST' && one.path.endsWith('/batches')).length;

const recorded = async (world: string, desk: Parameters<typeof grantsOf>[0]) =>
  (await grantsOf(desk, await spaceBatches(world, desk.held.school, server.send), kit)).map((one) => one.grant.id);

/** The versions of each week the inspector's device reads for a grant. */
async function versions(inspector: Parameters<typeof relayedTo>[0], desk: IssueDesk, grant: Grant) {
  const read = await (await relayedTo(inspector, desk.held.school, SECOND)).weeks(grant);
  return Array.isArray(read) ? read.map((one) => one?.versions.map((each) => each.week.version)) : read;
}

test('two approvals at once keep one grant, recorded, told and relayed once', async () => {
  const { director, desk, joined, inspector, fingerprint, ask } = await grantTerm();
  const request = await ask();
  const typed = fingerprint.toUpperCase().replace(/-/gu, ' – ');
  const [one, two] = await Promise.all([
    approveGrant(director, STAFFED, request.id, typed, kit, server.send),
    approveGrant(director, STAFFED, request.id, fingerprint, kit, server.send),
  ]);
  expect(two.id).toBe(one.id);
  expect(await recorded(director.world, desk)).toEqual([one.id]);
  expect((await noticesOf(joined)).map((each) => each.value.grant)).toEqual([one.id]);
  const seen = await relayedTo(inspector, desk.held.school, SECOND);
  expect([...new Set(seen.relayed.map((each) => each.grant.id))]).toEqual([one.id]);
  expect(await versions(inspector, desk, one)).toEqual([[0], [0]]);
});

test('a later grant over a corrected week gets the week as corrected, and the earlier keeps its own', async () => {
  const { id, director, desk, joined, inspector, fingerprint, ask } = await grantTerm();
  const first = await approveGrant(director, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  const world = { world: id, date: SECOND };
  const { weeks } = await readSignChannel(world, joined, kit, server.send);
  const latest = weeks.find((one) => one.week.week === WEEKS[1])!.week;
  await signTheWeek(
    world,
    joined,
    correctWeek(latest, latest.sessions[2], 'held', 'confirmed-later'),
    kit,
    server.send,
  );
  const second = await approveGrant(director, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  expect(await versions(inspector, desk, first)).toEqual([[0], [0]]);
  expect(await versions(inspector, desk, second)).toEqual([[0], [0, 1]]);
});

test('a teacher on a new code is told once, on it', async () => {
  const { id, director, device, joined, fingerprint, ask } = await grantTerm();
  const request = await ask();
  const again = await joinNew(id, director, device, 'teacher-1');
  const grant = await approveGrant(director, STAFFED, request.id, fingerprint, kit, server.send);
  expect((await noticesOf(again)).map((one) => [one.value.grant, one.value.weeks.map((each) => each.week)])).toEqual([
    [grant.id, WEEKS],
  ]);
  expect(await noticesOf(joined)).toEqual([]);
});

test('after a new epoch a grant is made under it, and one recorded before is finished', async () => {
  const { director, device, inspector, fingerprint, ask } = await grantTerm();
  const old = await ask();
  const kept = await approveGrant(director, STAFFED, old.id, fingerprint, kit, server.send);
  const desk = await newEpoch(director, await device());
  expect(desk.opened.keys.length).toBe(2);
  const before = posts();
  expect((await approveGrant(director, STAFFED, old.id, fingerprint, kit, server.send)).id).toBe(kept.id);
  expect(posts() - before).toBe(1);
  const made = await approveGrant(director, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  expect([made.log.epoch, made.weeks.map((one) => one.epoch)]).toEqual([1, [1, 1]]);
  expect(await versions(inspector, desk, made)).toEqual([[0], [0]]);
  expect(await recorded(director.world, desk)).toEqual([kept.id, made.id]);
});

test('a directorate space open as another kind stops before the relay, which the next approval puts', async () => {
  const { id, director, desk, joined, inspector, fingerprint, ask } = await grantTerm();
  const request = await ask();
  const theirs = await directorateSpace(id, SCHOOL.directorateId, kit.mac);
  const send: Send = async (asked) =>
    asked.method === 'PUT' && asked.path.endsWith(theirs)
      ? { status: 409, body: { error: 'other' }, retryAfter: null }
      : server.send(asked);
  await expect(approveGrant(director, STAFFED, request.id, fingerprint, kit, send)).rejects.toMatchObject({
    code: 'E_SPACE_KIND',
  });
  expect((await noticesOf(joined)).length).toBe(1);
  expect((await relayedTo(inspector, desk.held.school, SECOND)).relayed).toEqual([]);
  const grant = await approveGrant(director, STAFFED, request.id, fingerprint, kit, server.send);
  expect((await relayedTo(inspector, desk.held.school, SECOND)).relayed.map((one) => one.grant.id)).toEqual([grant.id]);
});
