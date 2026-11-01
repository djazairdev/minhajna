// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The directorate's request at its edges (#593, answer 621): a school whose
// space holds no keyring, or whose listing names a space of another kind, is
// refused as not listed before anything is kept, and a world with no room for a
// new space is the server's refusal; an erased world is said as erased by every
// step, and a quiet listing says nothing; a store that keeps nothing is said;
// two schools' requests are read as delivered each; and a keyring forged on the
// school's stream, which the directorate cannot check, takes the request to the
// forger's device and not the director's, the claim answer 621 accepts. Every
// directorate, school and device is made up.

import {
  directorateSpace,
  keyringStream,
  newId,
  newSchoolSpace,
  sealKeyring,
  toBase64Url,
  type SchoolKeyring,
} from '@minhajna/core';
import { listed, opened, SCHOOL } from '../jest/grant-world';
import { server } from '../jest/timetable-send';
import { codeOf, nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { newDevicePair, worldKeyCrypto } from '../src/demo/world-key-crypto';
import { holdSchool } from '../src/director/issue-session';
import { listQuietly, listSchool } from '../src/director/school-listing';
import { deliverRequest, requestGrant, requestsOf } from '../src/directorate/request-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { spaceBatches } from '../src/school/space-read';
import { openSpace } from '../src/school/stream-put';

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

/** Puts a keyring on its school's stream at the next number, as anyone who knows the space could. */
async function putRing(id: string, ring: SchoolKeyring) {
  const there = (await spaceBatches(id, ring.school, server.send)).get(await keyringStream(ring.school, kit.mac)) ?? [];
  const sealed = await sealKeyring(ring, there.length, kit.cipher, kit.mac);
  const body = {
    stream: sealed.stream,
    first: there.length,
    batches: sealed.batches.map((one) => toBase64Url(one.bytes)),
  };
  expect(
    (await server.send({ method: 'POST', path: `/worlds/${id}/spaces/${ring.school}/batches`, body })).status,
  ).toBe(201);
}

test('a space with no keyring, or of another kind, is no school to send to', async () => {
  const { id, desk, directorate, form } = await listed();
  const bare = newSchoolSpace(kit.random);
  await openSpace(id, bare, 'school', server.send);
  await listSchool(id, { ...SCHOOL, id: 'school-4' }, bare, kit, server.send);
  const empty = requestGrant(directorate, SCHOOL.directorateId, form({ school: 'school-4' }), kit, server.send);
  expect(await codeOf(empty)).toBe('E_GRANT_UNLISTED');
  expect(await requestsOf(directorate, kit, server.send)).toEqual([]);
  const other = await directorateSpace(id, SCHOOL.directorateId, kit.mac);
  await putRing(id, { ...desk.opened.ring, school: other });
  await listSchool(id, { ...SCHOOL, id: 'school-5' }, other, kit, server.send);
  const kind = requestGrant(directorate, SCHOOL.directorateId, form({ school: 'school-5' }), kit, server.send);
  expect(await codeOf(kind)).toBe('E_GRANT_UNLISTED');
  expect(await requestsOf(directorate, kit, server.send)).toEqual([]);
  const full: Send = async (request) =>
    request.method === 'PUT' ? { status: 409, body: { error: 'full' }, retryAfter: null } : server.send(request);
  expect(await codeOf(openSpace(id, newSchoolSpace(kit.random), 'school', full))).toBe('E_WORLD_SERVER');
  const body = { statusCode: 409, message: 'this space exists with another kind', error: 'Conflict' };
  const taken: Send = async (request) =>
    request.method === 'PUT' ? { status: 409, body, retryAfter: null } : server.send(request);
  expect(await codeOf(openSpace(id, newSchoolSpace(kit.random), 'school', taken))).toBe('E_SPACE_KIND');
});

test('an erased world is said as erased, and a store that keeps nothing is said', async () => {
  const { id, desk, directorate, form } = await listed();
  const kept = jest.spyOn(directorate.book, 'record').mockImplementation(() => Promise.resolve({} as never));
  expect(await codeOf(requestGrant(directorate, SCHOOL.directorateId, form(), kit, server.send))).toBe('E_WORLD');
  kept.mockRestore();
  const request = await requestGrant(directorate, SCHOOL.directorateId, form(), kit, server.send);
  server.worlds.clear();
  const steps = [
    requestGrant(directorate, SCHOOL.directorateId, form(), kit, server.send),
    deliverRequest(id, request, kit, server.send),
    requestsOf(directorate, kit, server.send),
    listSchool(id, SCHOOL, desk.held.school, kit, server.send),
  ];
  for (const step of steps) expect(await codeOf(step)).toBe('E_NO_SUCH_WORLD');
  const errors = jest.spyOn(console, 'error');
  listQuietly(id, SCHOOL, desk.held.school, kit, server.send);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(errors).not.toHaveBeenCalled();
});

test('two schools’ requests are each read as delivered', async () => {
  const { id, device, directorate, form } = await listed();
  const other = await holdSchool(await device(), kit, server.send);
  await listSchool(id, { ...SCHOOL, id: 'school-3' }, other.held.school, kit, server.send);
  const first = await requestGrant(directorate, SCHOOL.directorateId, form(), kit, server.send);
  const second = await requestGrant(directorate, SCHOOL.directorateId, form({ school: 'school-3' }), kit, server.send);
  const rows = await requestsOf(directorate, kit, server.send);
  expect(rows.map((one) => [one.request.id, one.delivered])).toEqual([
    [first.id, true],
    [second.id, true],
  ]);
  expect(await opened(id, other)).toEqual([second]);
});

test('a keyring forged on the school’s stream takes the request to the forger, as a claim', async () => {
  const { id, desk, directorate, form } = await listed();
  const pair = await newDevicePair(kit);
  const forger = { id: newId(kit.random), publicKey: pair.publicKey };
  const ring = desk.opened.ring;
  await putRing(id, {
    ...ring,
    version: ring.version + 1,
    previous: ring.tag,
    by: forger.id,
    holders: [forger],
    epochs: ring.epochs.map((one) => ({ ...one, sealed: { [forger.id]: 'ab' } })),
    tag: 'f'.repeat(64),
  });
  const request = await requestGrant(directorate, SCHOOL.directorateId, form(), kit, server.send);
  expect(await opened(id, desk)).toEqual([]);
  const held = { ...desk.held, device: forger.id };
  expect(await opened(id, { held, crypto: worldKeyCrypto(kit, pair) })).toEqual([request]);
});
