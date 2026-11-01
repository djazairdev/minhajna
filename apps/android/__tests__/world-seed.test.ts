// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Starting a national demo world seeds it (#548, answer 625), against a made-up
// demo server: the seeded staff's keys and joins go up in about a dozen
// requests under the starter token, each waiting the seeding's longer time, in
// well under a minute; the world's sealing key alone opens the seeded keys, one
// school for each seeded school, and a seeded school's keyring reads back from
// its space; the world's calendar holds, as its first release, the world's
// made-up closure (answer 626); a teachers' world, or a start without the
// reference data, seeds and publishes nothing; and a busy server, a refused or
// unanswered request, a closure the relay refused, or certificates that are not
// the ones asked for, fail the start as a whole with the network shut. Every
// world and key is made up.

import { keyringStream, openSeededKeys, readKeyrings, seededKeysPlace } from '@minhajna/core';
import { calendar, reference } from '../jest/world-calendar';
import { codeOf, DemoServer, nodeKit } from '../jest/world-server';
import { SEED_TIMEOUT_MS, startSeededWorld } from '../src/demo/world-seed';
import { readWorldCalendar } from '../src/demo/world-calendar-read';
import { failed, type Send } from '../src/demo/world-session';
import { seededWorld } from '../src/director/director-world';
import { leaveWorldNetwork, worldNetworkOpen, type WorldRequest } from '../src/network/world-network';
import { spaceBatches } from '../src/school/space-read';
import en from '../src/text/en.json';

const server = new DemoServer();

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

const seedings = () => server.seen.filter((one) => one.path.includes('/seed/'));

test('a national world is seeded in about a dozen requests, its keys opened with its sealing key alone', async () => {
  const asked: WorldRequest[] = [];
  const noting: Send = (request) => {
    asked.push(request);
    return server.send(request);
  };
  const began = Date.now();
  const started = await startSeededWorld('national', calendar, reference, nodeKit, noting);
  expect(Date.now() - began).toBeLessThan(60_000);
  const sent = seedings();
  expect(sent.map((one) => one.path.split('/').at(-1))).toEqual([
    ...Array.from({ length: 4 }, () => 'certificates'),
    ...Array.from({ length: 5 }, () => 'batches'),
  ]);
  expect(sent.every((one) => one.headers.Authorization === `Bearer ${started.starter}`)).toBe(true);
  const timed = asked.filter((one) => one.path.includes('/seed/')).map((one) => one.timeoutMs);
  expect(timed).toEqual(Array.from({ length: 9 }, () => SEED_TIMEOUT_MS));
  const { world } = started.keys;
  const place = await seededKeysPlace(started.sealing, nodeKit.mac);
  const national = (await spaceBatches(world, 'national', server.send)).get(place.stream) ?? [];
  const keys = await openSeededKeys(place, national, world, nodeKit.cipher);
  expect(keys?.schools.map((one) => one.seed)).toEqual(seededWorld(world, reference).schools.map((one) => one.id));
  const other = await seededKeysPlace(nodeKit.random(32), nodeKit.mac);
  expect(await openSeededKeys(other, national, world, nodeKit.cipher)).toBeNull();
  const { space } = keys!.schools[0];
  const stream = (await spaceBatches(world, space, server.send)).get(await keyringStream(space, nodeKit.mac)) ?? [];
  expect(await readKeyrings(space, stream, 65, nodeKit.cipher, nodeKit.mac)).toHaveLength(1);
  const held = { world, keys: started.keys, sealing: started.sealing };
  const read = await readWorldCalendar(held, { profile: reference.profile, calendar }, nodeKit, server.send);
  const names = read.updates.map((one) => one.entries.map((entry) => [entry.id, entry.name.en]));
  expect(names).toEqual([[['demo-closure', en.demo.closure]]]);
  expect(worldNetworkOpen()).toBe(world);
});

test('a teachers’ world, or a national one without the reference data, seeds nothing', async () => {
  await startSeededWorld('teachers', calendar, reference, nodeKit, server.send);
  leaveWorldNetwork();
  await startSeededWorld('national', calendar, undefined, nodeKit, server.send);
  expect(seedings()).toEqual([]);
  expect(server.seen.filter((one) => one.path.endsWith('/spaces/national/batches') && one.body)).toEqual([]);
});

test.each([
  ['a busy server', 'batches', { status: 429, body: null, retryAfter: 12 }, 'E_WORLD_BUSY'],
  ['a refused certificate request', 'certificates', { status: 403, body: null, retryAfter: null }, 'E_WORLD_SERVER'],
  ['an offline PC', 'certificates', 'E_OFFLINE', 'E_OFFLINE'],
  ['an unanswered upload', 'batches', 'E_TIMEOUT', 'E_TIMEOUT'],
] as const)('%s fails the start as a whole, with the network shut', async (_, part, answer, code) => {
  const failing: Send = (request) => {
    if (!request.path.endsWith(`/seed/${part}`)) return server.send(request);
    return typeof answer === 'string' ? Promise.reject(failed('A made-up failure', answer)) : Promise.resolve(answer);
  };
  expect(await codeOf(startSeededWorld('national', calendar, reference, nodeKit, failing))).toBe(code);
  expect(worldNetworkOpen()).toBeNull();
});

test('a closure the relay refused fails the start as a whole, with the network shut', async () => {
  const refusing: Send = (request) =>
    request.method === 'POST' && request.path.endsWith('/spaces/national/batches')
      ? Promise.resolve({ status: 403, body: null, retryAfter: null })
      : server.send(request);
  expect(await codeOf(startSeededWorld('national', calendar, reference, nodeKit, refusing))).toBe('E_WORLD_SERVER');
  expect(worldNetworkOpen()).toBeNull();
});

test('certificates that are not the ones asked for are the server’s fault', async () => {
  const swapping: Send = async (request) => {
    const answer = await server.send(request);
    if (!request.path.endsWith('/seed/certificates')) return answer;
    const [one, two, ...rest] = (answer.body as { certificates: unknown[] }).certificates;
    return { ...answer, body: { certificates: [two, one, ...rest] } };
  };
  expect(await codeOf(startSeededWorld('national', calendar, reference, nodeKit, swapping))).toBe('E_WORLD_SERVER');
  expect(worldNetworkOpen()).toBeNull();
  expect(seedings().filter((one) => one.path.endsWith('/seed/batches'))).toEqual([]);
});
