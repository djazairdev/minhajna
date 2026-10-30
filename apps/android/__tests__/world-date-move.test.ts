// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Moving a demo world's date (#560, answer 572), against a made-up demo
// server that keeps the server's own rules: only the starter token, with the
// world's pass, moves it, to each announced day in turn, until none is left;
// an erased world, a wait, and an answer that is not a later real day each
// say so with their own code. Nothing connects, and every world is made up.

import type { Day, SchoolCalendar } from '@minhajna/core';
import { moveWorldDate, newWorldDays, startWorld } from '../src/demo/world-session';
import { leaveWorldNetwork, worldRequest } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { answer, codeOf, DemoServer, nodeKit as kit } from '../jest/world-server';

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const calendar: SchoolCalendar = read.calendar;
const server = new DemoServer();
const { send } = server;

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

test('the starter token moves the date to each announced day in turn, until none is left', async () => {
  const started = await startWorld('national', calendar, kit, send);
  const { world } = started.keys;
  let date: Day = started.date;
  for (const next of newWorldDays(calendar).announcedDays) {
    date = await moveWorldDate(world, started.starter, date, send);
    expect(date).toBe(next);
    expect(server.worlds.get(world)!.date).toBe(next);
  }
  expect(await codeOf(moveWorldDate(world, started.starter, date, send))).toBe('E_WORLD_LEFT_DAYS');
  expect(server.seen.at(-1)!.headers['X-World-Pass']).toMatch(/^[A-Za-z0-9_-]{43}$/u);
});

test('another token moves nothing, and an erased world or a wait says so', async () => {
  const started = await startWorld('national', calendar, kit, send);
  const { world } = started.keys;
  expect(await codeOf(moveWorldDate(world, 'not-the-starter-token', started.date, send))).toBe('E_WORLD_SERVER');
  expect(server.worlds.get(world)!.date).toBe(started.date);
  expect(await codeOf(moveWorldDate(world, 'bad token!', started.date, send))).toBe('E_NO_WORLD');
  server.busy = true;
  const busy = await moveWorldDate(world, started.starter, started.date, send).catch((error: unknown) => error);
  expect(busy).toMatchObject({ code: 'E_WORLD_BUSY', retryAfter: 12 });
  server.busy = false;
  server.worlds.delete(world);
  expect(await codeOf(moveWorldDate(world, started.starter, started.date, send))).toBe('E_NO_SUCH_WORLD');
});

test('an answer that is not a later real day is refused', async () => {
  const started = await startWorld('national', calendar, kit, send);
  for (const date of ['2030-02-31', '1 June', started.date, '2000-01-01', null]) {
    const odd = (request: Parameters<typeof send>[0]) =>
      worldRequest(request, () => Promise.resolve(answer(200, { date })));
    expect(await codeOf(moveWorldDate(started.keys.world, started.starter, started.date, odd))).toBe('E_WORLD_SERVER');
  }
});
