// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teachers' receipts read from the director's device (#579, answer 607),
// against a made-up demo server: before any part no teacher is listed; once a
// version is sent, each teacher sent a part is listed in the staff list's
// order, with how they joined and nothing confirmed; a receipt from the joined
// phone shows with the world's day; a later standing version leaves the
// earlier receipt as the one before it until it is confirmed too; and a one-day
// version still to come is listed with its own receipt, the teacher up to date
// only once it is confirmed. Teachers with a code but no part are not listed.
// Every world, school and teacher is made up.

import { addDays } from '@minhajna/core';
import { BELLS, school, sendParts, server, session, setting } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { leaveWorldNetwork } from '../src/network/world-network';
import { readReceipts, upToDate } from '../src/timetable/receipt-session';
import { partFrom } from '../src/timetable/send-session';
import { confirmReceipt } from '../src/timetable/teacher-session';

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

const FIRST = [session('Salhi Zahia', 2, 540), session('بلعيد محمد', 1, 600)];
const MOVED = [FIRST[0], session('بلعيد محمد', 1, 540)];

test('each teacher sent a part shows the versions they confirmed, and their days', async () => {
  const { id, here, joined } = await setting();
  const world = { world: id, date: here.date };
  expect(await readReceipts(here, school, kit, server.send)).toEqual([]);
  await sendParts(here, school, FIRST, BELLS);
  const first = await readReceipts(here, school, kit, server.send);
  expect(first.map((one) => [one.id, one.teacher, one.access, one.standing, one.before, one.days])).toEqual([
    ['teacher-1', 'بلعيد محمد', 'phone', { version: 1, confirmed: null }, null, []],
    ['teacher-2', 'صالحي زهية', 'key', { version: 1, confirmed: null }, null, []],
  ]);
  await confirmReceipt(world, joined, 1, kit, server.send);
  const [confirmed] = await readReceipts(here, school, kit, server.send);
  expect([confirmed.standing, upToDate(confirmed)]).toEqual([{ version: 1, confirmed: here.date }, true]);
  await sendParts(here, school, MOVED, BELLS);
  const [behind, other] = await readReceipts(here, school, kit, server.send);
  expect([behind.standing, behind.before, other.standing.version]).toEqual([
    { version: 2, confirmed: null },
    { version: 1, day: here.date },
    1,
  ]);
  await confirmReceipt(world, joined, 2, kit, server.send);
  const day = addDays(partFrom(here.date), 1);
  await sendParts(here, school, FIRST, BELLS, server.send, { from: day, once: true });
  const [once] = await readReceipts(here, school, kit, server.send);
  expect([once.standing.version, once.days, upToDate(once)]).toEqual([
    2,
    [{ version: 3, day, confirmed: null }],
    false,
  ]);
  await confirmReceipt(world, joined, 3, kit, server.send);
  expect(upToDate((await readReceipts(here, school, kit, server.send))[0])).toBe(true);
});
