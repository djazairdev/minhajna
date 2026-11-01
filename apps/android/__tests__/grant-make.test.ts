// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's grant (#593, answer 621), on the made-up term of
// grant-term.ts: a request addressed to this device resolves to 1م2's signed
// weeks, with their class and teacher, and to 1م3 as having none; approving it
// archives each week, records the grant, tells the teacher and relays it, so
// the inspector's device opens both weeks and the teacher reads one notice;
// approving again finishes the same grant without archiving, recording or
// telling twice; a relay that failed is put on the next approval; and a wrong
// fingerprint, a request with no signed week, one past its end and one no
// longer there are refused before anything is put. Every school, class,
// teacher and device is made up.

import { addDays, directorateSpace } from '@minhajna/core';
import { SCHOOL } from '../jest/grant-world';
import { grantTerm, LABEL, noticesOf, relayedTo, STAFFED, WEEKS } from '../jest/grant-term';
import { TEACHER } from '../jest/term-weeks';
import { server } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { approveGrant } from '../src/director/grant-make';
import { readGrants } from '../src/director/grant-session';
import { leaveWorldNetwork } from '../src/network/world-network';

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

const posts = () => server.seen.filter((one) => one.method === 'POST' && one.path.endsWith('/batches')).length;

test('a request resolves to its classes’ signed weeks, and the classes with none are said', async () => {
  const { director, ask } = await grantTerm();
  const request = await ask();
  const { asked } = await readGrants(director, STAFFED, kit, server.send);
  expect(asked.map((one) => one.request.id)).toEqual([request.id]);
  const [one] = asked;
  expect(one.weeks.map((week) => [week.class, week.teacher, week.recorded.week.week])).toEqual([
    ['1م2', TEACHER, WEEKS[0]],
    ['1م2', TEACHER, WEEKS[1]],
  ]);
  expect([one.missing, one.made, one.lapsed, one.relayed]).toEqual([['1م3'], null, false, false]);
});

test('approving archives, records, tells and relays, and approving again finishes the same grant', async () => {
  const { director, desk, joined, inspector, fingerprint, ask } = await grantTerm();
  const request = await ask();
  const grant = await approveGrant(director, STAFFED, request.id, fingerprint, kit, server.send);
  expect([grant.from, grant.until, grant.weeks.map((one) => one.week)]).toEqual([director.date, request.until, WEEKS]);
  const read = await readGrants(director, STAFFED, kit, server.send);
  expect([read.asked[0].made?.grant.id, read.asked[0].made?.label, read.asked[0].relayed]).toEqual([
    grant.id,
    LABEL,
    true,
  ]);
  const seen = await relayedTo(inspector, desk.held.school, director.date);
  expect(seen.relayed.map((one) => [one.request, one.grant.id])).toEqual([[request.id, grant.id]]);
  const weeks = await seen.weeks(seen.relayed[0].grant);
  expect(Array.isArray(weeks) && weeks.map((one) => one?.versions.map((each) => each.week.week))).toEqual([
    [WEEKS[0]],
    [WEEKS[1]],
  ]);
  const told = await noticesOf(joined);
  expect(told.map((one) => [one.value.grant, one.value.inspector, one.value.weeks.map((each) => each.week)])).toEqual([
    [grant.id, LABEL, WEEKS],
  ]);
  const before = posts();
  const again = await approveGrant(director, STAFFED, request.id, 'not the fingerprint', kit, server.send);
  expect(again.id).toBe(grant.id);
  expect(posts() - before).toBe(1);
  expect((await noticesOf(joined)).length).toBe(1);
  expect((await relayedTo(inspector, desk.held.school, director.date)).count).toBe(seen.count + 1);
});

test('a relay that failed is put on the next approval', async () => {
  const { id, director, desk, joined, inspector, fingerprint, ask } = await grantTerm();
  const request = await ask();
  const space = desk.held.school;
  const theirs = await directorateSpace(id, SCHOOL.directorateId, kit.mac);
  const send: Send = async (asked) =>
    asked.method === 'POST' && asked.path.includes(theirs)
      ? { status: 503, body: null, retryAfter: null }
      : server.send(asked);
  await expect(approveGrant(director, STAFFED, request.id, fingerprint, kit, send)).rejects.toMatchObject({
    code: 'E_WORLD_SERVER',
  });
  expect((await relayedTo(inspector, space, director.date)).relayed).toEqual([]);
  const grant = await approveGrant(director, STAFFED, request.id, fingerprint, kit, server.send);
  const seen = await relayedTo(inspector, space, director.date);
  expect(seen.relayed.map((one) => one.grant.id)).toEqual([grant.id]);
  expect((await noticesOf(joined)).length).toBe(1);
});

test('a wrong fingerprint, no signed week, or a lapsed or gone request is refused before anything is put', async () => {
  const { director, fingerprint, ask } = await grantTerm();
  const request = await ask();
  const none = await ask({ classes: ['1م3'] });
  const before = posts();
  const refused = async (world: typeof director, id: string, typed: string) =>
    (
      (await approveGrant(world, STAFFED, id, typed, kit, server.send).catch((error: unknown) => error)) as {
        code?: string;
      }
    ).code;
  expect(
    await refused(
      director,
      request.id,
      fingerprint.replace(/^./u, (one) => (one === '0' ? '1' : '0')),
    ),
  ).toBe('E_GRANT_FINGERPRINT');
  expect(await refused(director, none.id, fingerprint)).toBe('E_GRANT_NO_WEEKS');
  expect(await refused({ ...director, date: addDays(request.until, 1) }, request.id, fingerprint)).toBe(
    'E_GRANT_LAPSED',
  );
  expect(await refused(director, '0123456789abcdef0123456789abcdef', fingerprint)).toBe('E_GRANT_GONE');
  expect(posts()).toBe(before);
});
