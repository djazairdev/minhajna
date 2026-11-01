// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// M-Grant on the directorate's PC (#593, answer 621): with no request yet it
// says so and the button waits until the inspector is named, a fingerprint
// typed and a class chosen; a request sent is announced and shown waiting for
// the school's director, counting its classes and naming no teacher; a
// fingerprint no key gives, or a school not listed, is said in M-Grant's
// words; a request not delivered is sent again; one the school says it granted
// shows so, then ended after its end, while one not answered lapses; and on
// the phone a problem is announced. Every directorate, school and device is
// made up.

import { addDays, directorateSpace, relayPlace, sealGrantRelay, seedNationalWorld, toBase64Url } from '@minhajna/core';
import { AccessibilityInfo, Platform } from 'react-native';
import { disabled, filled, page, press, said, seeded, texts, type, unmount } from '../jest/grant-page';
import { listed, reference } from '../jest/grant-world';
import { server } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { personName } from '../src/director/dashboard-text';
import { requestsOf } from '../src/directorate/request-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { spaceBatches } from '../src/school/space-read';
import ar from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.grant;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

test('a request is sent, announced and waits for the school’s director, naming no teacher', async () => {
  const { id, fingerprint, directorate } = await listed((world) => seeded(world));
  const school = seeded(id);
  await page(directorate, school, server.send);
  expect(texts()).toEqual(expect.arrayContaining([words.lead, words.noRequests]));
  expect(disabled('grant-send')).toBe(true);
  await filled(fingerprint, school);
  expect(disabled('grant-send')).toBe(false);
  await press('grant-send');
  const [row] = await requestsOf(directorate, school.directorateId, kit, server.send);
  expect(row.delivered).toBe(true);
  expect(said()).toBe(words.sent);
  expect(texts()).toContain(words.waiting);
  expect(texts().some((one) => one.includes(words.count_one))).toBe(true);
  for (const teacher of school.teachers) expect(texts().join(' ')).not.toContain(personName(teacher));
});

test('a fingerprint no key gives, and a school not listed, are said in M-Grant’s words', async () => {
  const { id, fingerprint, directorate } = await listed((world) => seeded(world));
  const school = seeded(id);
  await page(directorate, school, server.send);
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  await filled('0000-0000-0000-0000', school);
  await press('grant-send');
  expect(texts()).toContain(words.noKey);
  expect(announce).not.toHaveBeenCalled();
  const { zones = [], workingDays } = reference.profile;
  const others = seedNationalWorld(id, zones, workingDays, reference.packs).schools.filter(
    (one) => one.directorateId === school.directorateId && one.id !== school.id && one.teachers.length > 0,
  );
  await filled(fingerprint, others[0]);
  await press('grant-send');
  expect(texts()).toContain(words.unlisted);
  expect(await requestsOf(directorate, school.directorateId, kit, server.send)).toEqual([]);
});

test('a request not delivered is sent again, then shows granted, ended or lapsed as the school answers', async () => {
  const { id, fingerprint, directorate, desk } = await listed((world) => seeded(world));
  const school = seeded(id);
  let busy = true;
  const send: Send = async (request) =>
    busy && request.method === 'POST' && request.path.includes(desk.held.school)
      ? { status: 429, body: { error: 'busy' }, retryAfter: 12 }
      : server.send(request);
  await page(directorate, school, send);
  await filled(fingerprint, school);
  await press('grant-send');
  expect(texts()).toContain(ar.demo.problem.busy);
  const [row] = await requestsOf(directorate, school.directorateId, kit, server.send);
  expect(texts()).toContain(words.undelivered);
  busy = false;
  await press(`grant-again-${row.request.id}`);
  expect(texts()).toContain(words.waiting);
  const space = await directorateSpace(id, school.directorateId, kit.mac);
  const place = await relayPlace(row.request.inspector, kit.mac);
  const there = (await spaceBatches(id, space, server.send)).get(place.stream) ?? [];
  const relay = { format: 'minhajna/grant-relay/1' as const, request: row.request.id, sealed: 'AAAA' };
  const batches = (await sealGrantRelay(place, relay, there.length, kit.cipher)).map((one) => toBase64Url(one.bytes));
  await server.send({
    method: 'POST',
    path: `/worlds/${id}/spaces/${space}/batches`,
    body: { stream: place.stream, first: there.length, batches },
  });
  await unmount();
  await page(directorate, school, server.send);
  expect(texts()).toContain(words.granted.replace('{{until}}', `day ${row.request.until}`));
  await unmount();
  await page({ ...directorate, date: addDays(row.request.until, 1) }, school, server.send);
  expect(texts()).toContain(words.ended.replace('{{until}}', `day ${row.request.until}`));
});

test('a request the school never answers lapses, and on the phone a problem is announced', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  const { id, fingerprint, directorate } = await listed((world) => seeded(world));
  const school = seeded(id);
  await page(directorate, school, server.send);
  await filled('0000-0000-0000-0000', school);
  await press('grant-send');
  expect(announce).toHaveBeenLastCalledWith(words.noKey);
  await type('grant-fingerprint', fingerprint);
  await press('grant-send');
  expect(announce).toHaveBeenLastCalledWith(words.sent);
  const [row] = await requestsOf(directorate, school.directorateId, kit, server.send);
  await unmount();
  await page({ ...directorate, date: addDays(row.request.until, 1) }, school, server.send);
  expect(texts()).toContain(words.lapsed.replace('{{until}}', `day ${row.request.until}`));
});
