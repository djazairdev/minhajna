// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Publishing the Ministry's draft as the world's next calendar release (#608,
// answer 624), against a made-up demo server: the release after the latest is
// put once on the national space and every device reads it, the world's
// announced days after its date following it; publishing the same change again
// finishes without putting it twice, and after the days failed it puts nothing
// twice and finishes them; a release the relay did not keep is said; a release
// another device put meanwhile is built on; the same change as an older release
// reverted since is put again; a date moved before the announced days arrive
// has them worked out again from it, while a refusal while it stayed is the
// server's; and a busy server and an erased world say so. Every world and entry
// is made up.

import {
  announcedDaysOf,
  EMPTY_DRAFT,
  setDraftEntry,
  takeOutDraftEntry,
  type CalendarDraft,
  type CalendarUpdate,
} from '@minhajna/core';
import { calendar, exam, moving, publish, reference } from '../jest/world-calendar';
import { codeOf, DemoServer, nodeKit } from '../jest/world-server';
import { NATIONAL_SPACE, readWorldCalendar, type HeldWorld } from '../src/demo/world-calendar-read';
import { startWorld, type Send } from '../src/demo/world-session';
import { publishCalendar } from '../src/ministry/calendar-publish';
import { leaveWorldNetwork } from '../src/network/world-network';

const server = new DemoServer();

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

/** A national world started here, its keys held. */
async function started(): Promise<HeldWorld & { date: string }> {
  const one = await startWorld('national', calendar, nodeKit, server.send);
  return { world: one.keys.world, keys: one.keys, sealing: one.sealing, date: one.date };
}

/** The draft moving the first term's exams, as the update `moving` makes. */
const movingDraft = (): CalendarDraft => {
  const { entries, removed } = moving();
  return { entries, removed };
};

const publishing = (held: HeldWorld & { date: string }, draft: CalendarDraft) => ({
  held,
  date: held.date as CalendarUpdate['published'],
  reference,
  draft,
  kit: nodeKit,
});

/** How many batches the world's national space holds. */
async function stored(world: string): Promise<number> {
  const answer = await server.send({
    method: 'GET',
    path: `/worlds/${world}/spaces/${NATIONAL_SPACE}/batches?after=0`,
  });
  return (answer.body as { batches: unknown[] }).batches.length;
}

test('the release after the latest is put once, read everywhere, and the announced days follow it', async () => {
  const held = await started();
  const update = await publishCalendar(publishing(held, movingDraft()), server.send);
  expect(update).toEqual(moving());
  const read = await readWorldCalendar(held, reference, nodeKit, server.send);
  expect(read.updates).toEqual([update]);
  const announced = announcedDaysOf(calendar.year, read.calendar.entries, update.published);
  expect(server.worlds.get(held.world)?.announced.filter((day) => day > held.date)).toEqual(announced);
  expect(announced).toContain('2026-12-20');
  const before = await stored(held.world);
  expect(await publishCalendar(publishing(held, movingDraft()), server.send)).toEqual(update);
  expect(await stored(held.world)).toBe(before);
  const next = takeOutDraftEntry(read.calendar.entries, EMPTY_DRAFT, 'term-1-exams');
  const later = await publishCalendar(
    { ...publishing(held, next), reference: { ...reference, calendar: read.calendar } },
    server.send,
  );
  expect(later.release).not.toBe(update.release);
  expect((await readWorldCalendar(held, reference, nodeKit, server.send)).updates).toEqual([update, later]);
});

test('a release the relay did not keep is said, and the draft is left to the page', async () => {
  const held = await started();
  const other = setDraftEntry(calendar.entries, EMPTY_DRAFT, { ...exam, source: 'Another made-up notice' });
  const theirs = { ...moving(), entries: other.entries };
  const racing: Send = async (request) => {
    if (request.method === 'POST' && request.path.endsWith(`/spaces/${NATIONAL_SPACE}/batches`)) {
      await publish(server, { id: held.world, keys: held.keys, sealing: held.sealing }, theirs);
      return { status: 201, body: { added: 1 }, retryAfter: null };
    }
    return server.send(request);
  };
  expect(await codeOf(publishCalendar(publishing(held, movingDraft()), racing))).toBe('E_CALENDAR_RACE');
});

test('a date moved before the announced days arrive has them worked out again from it', async () => {
  const held = await started();
  const kept = server.worlds.get(held.world)!;
  let moves = 0;
  const mover: Send = (request) => {
    if (request.method === 'PUT' && request.path.endsWith('/announced-days') && moves === 0) {
      moves += 1;
      kept.date = kept.announced.find((day) => day > kept.date)!;
    }
    return server.send(request);
  };
  await publishCalendar(publishing(held, movingDraft()), mover);
  expect(moves).toBe(1);
  const read = await readWorldCalendar(held, reference, nodeKit, server.send);
  expect(kept.announced.filter((day) => day > kept.date)).toEqual(
    announcedDaysOf(calendar.year, read.calendar.entries, kept.date as CalendarUpdate['published']),
  );
});

test('a release another device put meanwhile is built on, and both are read', async () => {
  const held = await started();
  const other = setDraftEntry(calendar.entries, EMPTY_DRAFT, { ...exam, source: 'Another made-up notice' });
  const theirs = { ...moving(), entries: other.entries };
  let raced = false;
  const racing: Send = async (request) => {
    if (request.method === 'POST' && request.path.endsWith(`/spaces/${NATIONAL_SPACE}/batches`) && !raced) {
      raced = true;
      await publish(server, { id: held.world, keys: held.keys, sealing: held.sealing }, theirs);
    }
    return server.send(request);
  };
  const ours = await publishCalendar(publishing(held, movingDraft()), racing);
  expect(ours.release).not.toBe(theirs.release);
  expect((await readWorldCalendar(held, reference, nodeKit, server.send)).updates).toEqual([theirs, ours]);
});

test('the same change as an older release, reverted since, is put again', async () => {
  const held = await started();
  const first = await publishCalendar(publishing(held, movingDraft()), server.send);
  const after = (await readWorldCalendar(held, reference, nodeKit, server.send)).calendar;
  const back = setDraftEntry(after.entries, EMPTY_DRAFT, exam, 'A made-up reason to move it back');
  await publishCalendar({ ...publishing(held, back), reference: { ...reference, calendar: after } }, server.send);
  const again = await publishCalendar(publishing(held, movingDraft()), server.send);
  expect(again.release).not.toBe(first.release);
  const read = await readWorldCalendar(held, reference, nodeKit, server.send);
  expect(read.updates.map((one) => one.release)).toHaveLength(3);
  expect(read.calendar.entries.find((one) => one.id === exam.id)?.from).toBe('2026-12-20');
});

test('publishing again after the days failed puts nothing twice and finishes', async () => {
  const held = await started();
  const failing: Send = (request) =>
    request.method === 'PUT' && request.path.endsWith('/announced-days')
      ? Promise.resolve({ status: 500, body: null, retryAfter: null })
      : server.send(request);
  expect(await codeOf(publishCalendar(publishing(held, movingDraft()), failing))).toBe('E_WORLD_SERVER');
  const before = await stored(held.world);
  const kept = server.worlds.get(held.world)!;
  expect(kept.announced).not.toContain('2026-12-20');
  await publishCalendar(publishing(held, movingDraft()), server.send);
  expect(await stored(held.world)).toBe(before);
  expect(kept.announced).toContain('2026-12-20');
});

test('a refusal while the date stayed is the server’s', async () => {
  const held = await started();
  let refusals = 0;
  const refusing: Send = (request) => {
    if (request.method !== 'PUT' || !request.path.endsWith('/announced-days')) return server.send(request);
    refusals += 1;
    return Promise.resolve({ status: 400, body: null, retryAfter: null });
  };
  expect(await codeOf(publishCalendar(publishing(held, movingDraft()), refusing))).toBe('E_WORLD_SERVER');
  expect(refusals).toBe(1);
});

test('a busy server is said', async () => {
  const held = await started();
  const busy: Send = (request) =>
    request.method === 'PUT' && request.path.endsWith('/announced-days')
      ? Promise.resolve({ status: 429, body: null, retryAfter: 12 })
      : server.send(request);
  expect(await codeOf(publishCalendar(publishing(held, movingDraft()), busy))).toBe('E_WORLD_BUSY');
});

test('an erased world says so', async () => {
  const held = await started();
  const erased: Send = (request) =>
    request.method === 'PUT' && request.path.endsWith('/announced-days')
      ? Promise.resolve({ status: 404, body: null, retryAfter: null })
      : server.send(request);
  expect(await codeOf(publishCalendar(publishing(held, movingDraft()), erased))).toBe('E_NO_SUCH_WORLD');
});
