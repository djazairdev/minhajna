// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Starting and joining a demo world (#560, answer 572), through the world's
// client against a made-up demo server that keeps the server's own rules: a
// started world's keys open with its code alone, with its kind; what goes
// out is what the server accepts, and never the code's secret; its date is the
// bundled calendar's first term's end and its announced days the later term
// ends and exam starts; a taken ID draws a new code; and every failure leaves
// the network shut, unless another world was open first, which stays open and
// refuses both before any derivation, or the world was entered again
// meanwhile. Nothing connects, and every world is made up.

import { worldCodeGroups, worldCodeSecret, type SchoolCalendar } from '@minhajna/core';
import { joinWorld, newWorldDays, startWorld, WORLD_SIGNER } from '../src/demo/world-session';
import { enterWorldNetwork, leaveWorldNetwork, worldNetworkOpen, worldRequest } from '../src/network/world-network';
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

test('a new world opens on the first term’s end, with the later term ends and exam starts announced', () => {
  const { date, announcedDays } = newWorldDays(calendar);
  const [first, ...later] = calendar.year.terms;
  expect(date).toBe(first.to);
  for (const term of later) expect(announcedDays).toContain(term.to);
  const exams = calendar.entries.filter((entry) => entry.effect === 'exam' && entry.from > date);
  for (const exam of exams) expect(announcedDays).toContain(exam.from);
  expect(announcedDays.length).toBeGreaterThan(0);
  expect([...announcedDays].sort()).toEqual(announcedDays);
  expect(new Set(announcedDays).size).toBe(announcedDays.length);
  expect(announcedDays.every((day) => day > date)).toBe(true);
  expect(() => newWorldDays({ ...calendar, year: { ...calendar.year, terms: [] } })).toThrow('no term');
});

test('a started world opens with its code alone, of its kind, and nothing secret goes out', async () => {
  const started = await startWorld('teachers', calendar, kit, send);
  expect(worldNetworkOpen()).toBe(started.keys.world);
  expect(started.keys.kind).toBe('teachers');
  expect(Object.keys(started.keys.private)).toEqual([WORLD_SIGNER]);
  expect(started.keys.trusted[0].signs).toEqual(['calendar', 'packs']);
  expect(server.seen[0]).toMatchObject({ method: 'POST', path: '/worlds' });
  expect(server.seen[0].headers['X-World-Pass']).toBeUndefined();
  const kept = server.worlds.get(started.keys.world)!;
  expect(kept.date).toBe(started.date);
  expect(kept.announced).toEqual(newWorldDays(calendar).announcedDays);
  for (const secret of [worldCodeSecret(started.code), started.keys.private[WORLD_SIGNER]]) {
    expect(JSON.stringify(kept)).not.toContain(secret);
  }
  leaveWorldNetwork();

  const joined = await joinWorld(worldCodeGroups(started.code).join(' ').toLowerCase(), kit, send);
  expect(joined).toEqual({ keys: started.keys, date: started.date });
  expect(worldNetworkOpen()).toBe(started.keys.world);
  expect(server.seen[1].headers['X-World-Pass']).toMatch(/^[A-Za-z0-9_-]{43}$/u);
});

test('a taken world draws a new code, and three taken in a row give up with the network shut', async () => {
  server.taken = 1;
  const started = await startWorld('national', calendar, kit, send);
  expect(server.seen.map((one) => one.path)).toEqual(['/worlds', '/worlds']);
  expect(worldNetworkOpen()).toBe(started.keys.world);
  expect(started.keys.kind).toBe('national');
  leaveWorldNetwork();
  server.taken = 3;
  expect(await codeOf(startWorld('national', calendar, kit, send))).toBe('E_WORLD_SERVER');
  expect(server.seen).toHaveLength(5);
  expect(worldNetworkOpen()).toBeNull();
});

test('starting fails with the network shut on a bad starter, a wait, no answer or a failing kit', async () => {
  for (const starter of [7, '', 'short', 'x'.repeat(129), 'not a token!']) {
    const bad = (request: Parameters<typeof send>[0]) =>
      worldRequest(request, () => Promise.resolve(answer(201, { starter })));
    expect(await codeOf(startWorld('national', calendar, kit, bad))).toBe('E_WORLD_SERVER');
    expect(worldNetworkOpen()).toBeNull();
  }
  server.busy = true;
  const busy = await startWorld('national', calendar, kit, send).catch((error: unknown) => error);
  expect(busy).toMatchObject({ code: 'E_WORLD_BUSY', retryAfter: 12 });
  expect(worldNetworkOpen()).toBeNull();
  const offline = (request: Parameters<typeof send>[0]) =>
    worldRequest(request, () => Promise.reject(new TypeError('Network request failed')));
  expect(await codeOf(startWorld('national', calendar, kit, offline))).toBe('E_OFFLINE');
  expect(worldNetworkOpen()).toBeNull();
  const broken = { ...kit, newPair: () => Promise.reject(new Error('Keystore unavailable')) };
  expect(await codeOf(startWorld('national', calendar, broken, send))).toBe('E_WORLD_KIT');
  const noEntropy = {
    ...kit,
    random: () => {
      throw new Error('No entropy');
    },
  };
  expect(await codeOf(startWorld('national', calendar, noEntropy, send))).toBe('E_WORLD_KIT');
  const lying = { ...kit, newPair: async () => ({ ...(await kit.newPair()), pkcs8: (await kit.newPair()).pkcs8 }) };
  expect(await codeOf(startWorld('national', calendar, lying, send))).toBe('E_WORLD_KIT');
  expect(worldNetworkOpen()).toBeNull();
});

test('joining refuses a code that does not read, a world nobody started, and keys that do not open', async () => {
  expect(await codeOf(joinWorld('not a code', kit, send))).toBe('E_WORLD_CODE');
  expect(server.seen).toHaveLength(0);
  const started = await startWorld('national', calendar, kit, send);
  leaveWorldNetwork();
  const other = await startWorld('national', calendar, kit, send);
  leaveWorldNetwork();
  server.worlds.delete(other.keys.world);
  expect(await codeOf(joinWorld(other.code, kit, send))).toBe('E_NO_SUCH_WORLD');
  expect(worldNetworkOpen()).toBeNull();
  const kept = server.worlds.get(started.keys.world)!;
  const { sealed, date } = kept;
  for (const [changed, day] of [
    ['A'.repeat(200), date],
    [sealed, '30 June'],
    [sealed, '2030-02-31'],
  ]) {
    Object.assign(kept, { sealed: changed, date: day });
    expect(await codeOf(joinWorld(started.code, kit, send))).toBe('E_WORLD_SERVER');
    expect(worldNetworkOpen()).toBeNull();
  }
});

test('joining fails with the network shut when the server asks to wait or fails', async () => {
  const started = await startWorld('national', calendar, kit, send);
  leaveWorldNetwork();
  server.busy = true;
  const busy = await joinWorld(started.code, kit, send).catch((error: unknown) => error);
  expect(busy).toMatchObject({ code: 'E_WORLD_BUSY', retryAfter: 12 });
  expect(worldNetworkOpen()).toBeNull();
  const failing = (request: Parameters<typeof send>[0]) =>
    worldRequest(request, () => Promise.resolve(answer(500, { error: 'made-up failure' })));
  expect(await codeOf(joinWorld(started.code, kit, failing))).toBe('E_WORLD_SERVER');
  expect(worldNetworkOpen()).toBeNull();
  server.busy = false;
  const unsealing = { ...kit, cipher: { ...kit.cipher, open: () => Promise.reject(new Error('Keystore gone')) } };
  expect(await codeOf(joinWorld(started.code, unsealing, send))).toBe('E_WORLD_KIT');
  expect(worldNetworkOpen()).toBeNull();
});

test('a join that fails after the world was left and entered again leaves the later entry open', async () => {
  const started = await startWorld('national', calendar, kit, send);
  leaveWorldNetwork();
  const racing = (request: Parameters<typeof send>[0]) =>
    worldRequest(request, (address, init) => {
      leaveWorldNetwork();
      enterWorldNetwork(started.keys.world, (init.headers as Record<string, string>)['X-World-Pass']);
      return server.fetch(address, init);
    });
  expect(await codeOf(joinWorld(started.code, kit, racing))).toBe('E_NO_WORLD');
  expect(worldNetworkOpen()).toBe(started.keys.world);
});

test('a world already open, even the same one, refuses both before any derivation, and stays open', async () => {
  const started = await startWorld('national', calendar, kit, send);
  let derived = 0;
  const counting = { ...kit, kdf: (...args: Parameters<typeof kit.kdf>) => ((derived += 1), kit.kdf(...args)) };
  expect(await codeOf(joinWorld(started.code, counting, send))).toBe('E_NO_WORLD');
  expect(worldNetworkOpen()).toBe(started.keys.world);
  leaveWorldNetwork();
  enterWorldNetwork('ABCDE', 'p'.repeat(43));
  expect(await codeOf(startWorld('national', calendar, counting, send))).toBe('E_NO_WORLD');
  expect(await codeOf(joinWorld(started.code, counting, send))).toBe('E_NO_WORLD');
  expect(worldNetworkOpen()).toBe('ABCDE');
  expect(derived).toBe(0);
});
