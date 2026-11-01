// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's listing and the directorate's request (#593, answer 621): a
// school is listed once in its directorate's space, again only for another
// space; a request made on the directorate's device for the school listed and
// the inspector the fingerprint names is kept in its store, delivered once to
// the school's stream and opened there by the director's device; a school not
// listed, a fingerprint no key gives and a request that does not read are
// refused before anything is kept; a request kept but not delivered, as after
// a busy server, is delivered again; and one past its end reads as lapsed.
// Every directorate, school and device is made up.

import { addDays, requestPlace } from '@minhajna/core';
import { listed, opened, SCHOOL, schools } from '../jest/grant-world';
import { server } from '../jest/timetable-send';
import { codeOf, nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { listSchool } from '../src/director/school-listing';
import { deliverRequest, requestGrant, requestsOf } from '../src/directorate/request-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { spaceBatches } from '../src/school/space-read';

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

test('a school is listed once, and again only for another space', async () => {
  const { id, desk } = await listed();
  const once = await schools(id);
  await listSchool(id, SCHOOL, desk.held.school, kit, server.send);
  expect(await schools(id)).toEqual(once);
  await listSchool(id, SCHOOL, 'another-made-up-space-id', kit, server.send);
  expect((await schools(id)).listed.get(SCHOOL.id)).toBe('another-made-up-space-id');
});

test('a request is kept, delivered once and opened by the director’s device', async () => {
  const { id, desk, directorate, form } = await listed();
  const request = await requestGrant(directorate, SCHOOL.directorateId, form(), kit, server.send);
  expect([request.school, request.asked, request.classes]).toEqual([
    desk.held.school,
    directorate.date,
    ['4م1', '4م2'],
  ]);
  const place = await requestPlace(desk.held.school, kit.mac);
  const count = async () => (await spaceBatches(id, desk.held.school, server.send)).get(place.stream)?.length;
  const once = await count();
  await deliverRequest(id, request, kit, server.send);
  expect(await count()).toBe(once);
  expect(await opened(id, desk)).toEqual([request]);
  expect(await requestsOf(directorate, SCHOOL.directorateId, kit, server.send)).toEqual([
    { request, seed: SCHOOL.id, delivered: true, granted: false, lapsed: false },
  ]);
  const later = { ...directorate, date: addDays(request.until, 1) };
  expect((await requestsOf(later, SCHOOL.directorateId, kit, server.send))[0].lapsed).toBe(true);
});

test('what cannot be requested is refused before anything is kept', async () => {
  const { id, directorate, form } = await listed();
  await listSchool(id, { ...SCHOOL, id: 'school-3' }, 'made-up-space-without-keyring', kit, server.send);
  const refused = [
    [form({ school: 'school-3' }), 'E_GRANT_UNLISTED'],
    [form({ school: 'school-9' }), 'E_GRANT_UNLISTED'],
    [form({ fingerprint: '0000-0000-0000-0000' }), 'E_GRANT_FINGERPRINT'],
    [form({ classes: [] }), 'E_GRANT_FORM'],
    [form({ until: addDays(directorate.date, -1) }), 'E_GRANT_FORM'],
  ] as const;
  for (const [one, code] of refused) {
    expect(await codeOf(requestGrant(directorate, SCHOOL.directorateId, one, kit, server.send))).toBe(code);
  }
  expect(await requestsOf(directorate, SCHOOL.directorateId, kit, server.send)).toEqual([]);
});

test('a request kept but not delivered is delivered again', async () => {
  const { id, desk, directorate, form } = await listed();
  const busy: Send = async (request) =>
    request.method === 'POST' && request.path.includes(desk.held.school)
      ? { status: 429, body: { error: 'busy' }, retryAfter: 12 }
      : server.send(request);
  expect(await codeOf(requestGrant(directorate, SCHOOL.directorateId, form(), kit, busy))).toBe('E_WORLD_BUSY');
  const [kept] = await requestsOf(directorate, SCHOOL.directorateId, kit, server.send);
  expect(kept.delivered).toBe(false);
  await deliverRequest(id, kept.request, kit, server.send);
  expect(await opened(id, desk)).toEqual([kept.request]);
  expect((await requestsOf(directorate, SCHOOL.directorateId, kit, server.send))[0].delivered).toBe(true);
});
