// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The uses of an inspector's grant on both sides (#594, answer 622), on the
// made-up term of grant-term.ts: before the inspector opens a class the
// teacher's log reads no use and the director's access page no last access;
// once the inspector opens 1م2, the teacher reads one use a week with the keys
// of their notice, newest first, and the director the day as the last access; a
// use another holder of a week's key forged, on a later day, shows in the
// teacher's log as reported but not as the director's last access, which checks
// it; a use under one week's key naming another week is left out; a grant whose
// log epoch the keyring lacks has no last access; a reading the server refuses
// is said as the server's; and a teacher with no notice reads nothing. Every
// school, class, teacher and device is made up.

import { addDays, openGrantUses, sealGrantUse, usePlace as placeOfUses, type Day } from '@minhajna/core';
import { grantTerm, noticesOf, STAFFED, WEEKS } from '../jest/grant-term';
import { MINE } from '../jest/term-weeks';
import { server } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { lastUseOf } from '../src/director/grant-last-use';
import { approveGrant } from '../src/director/grant-make';
import { readGrants } from '../src/director/grant-session';
import { holdSchool } from '../src/director/issue-session';
import { openGrantClass } from '../src/inspector/grant-read';
import { leaveWorldNetwork } from '../src/network/world-network';
import { spaceBatches } from '../src/school/space-read';
import { putOnce } from '../src/school/stream-put';
import { fromHex } from '../src/storage/history';
import { readAccessUses } from '../src/week/access-uses';
import { deliveryReading } from '../src/week/school-mine-session';

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

const reading = deliveryReading(MINE, [], []);

test('the teacher reads each use as reported, and the director only those that check', async () => {
  const { director, joined, inspector, fingerprint, ask } = await grantTerm();
  expect(await readAccessUses(joined, [], kit, server.send)).toEqual(new Map());
  const grant = await approveGrant(director, STAFFED, (await ask()).id, fingerprint, kit, server.send);
  const notices = await noticesOf(joined);
  const last = async () => (await readGrants(director, STAFFED, kit, server.send)).asked[0].lastUse;
  expect((await readAccessUses(joined, notices, kit, server.send)).get(grant.id)).toEqual([]);
  expect(await last()).toBeNull();
  const opened = await openGrantClass(inspector, grant, grant.weeks[0].course, reading, kit, server.send);
  expect(opened).not.toBeNull();
  const read = (await readAccessUses(joined, notices, kit, server.send)).get(grant.id) ?? [];
  expect(read.map((one) => [one.day, one.week])).toEqual(WEEKS.map((week) => [inspector.date, week]));
  expect(await last()).toBe(inspector.date);
  const later: Day = addDays(inspector.date, 2);
  const { course, week, key } = notices[0].value.uses[0];
  const place = await placeOfUses(fromHex(key), kit.mac);
  const forged = { ...read[0], course, week, day: later, proof: 'f'.repeat(64) };
  const put = (at: typeof place, use: typeof forged) => ({
    world: director.world,
    space: grant.school,
    kind: 'school' as const,
    stream: at.stream,
    open: (batches: Parameters<typeof openGrantUses>[1]) => openGrantUses(at, batches, kit.cipher),
    there: () => false,
    seal: (first: number) => sealGrantUse(at, use, first, kit.cipher),
  });
  await putOnce(put(place, forged), server.send);
  const again = (await readAccessUses(joined, notices, kit, server.send)).get(grant.id) ?? [];
  expect(again.map((one) => one.day)).toEqual([later, inspector.date, inspector.date]);
  expect(await last()).toBe(inspector.date);
  const astray = { ...read[0], week: WEEKS[1], day: addDays(later, 1) };
  await putOnce(
    { ...put(place, forged), seal: (first) => sealGrantUse(place, astray, first, kit.cipher) },
    server.send,
  );
  const after = (await readAccessUses(joined, notices, kit, server.send)).get(grant.id) ?? [];
  expect(after.map((one) => one.day)).toEqual([later, inspector.date, inspector.date]);
  const desk = await holdSchool(director, kit, server.send);
  const batches = await spaceBatches(director.world, grant.school, server.send);
  expect(await lastUseOf(desk, { ...grant, log: { ...grant.log, epoch: 9 } }, batches, kit)).toBeNull();
  const refused: Send = (request) =>
    request.method === 'GET' ? Promise.resolve({ status: 503, body: null, retryAfter: null }) : server.send(request);
  await expect(readAccessUses(joined, notices, kit, refused)).rejects.toMatchObject({ code: 'E_WORLD_SERVER' });
});
