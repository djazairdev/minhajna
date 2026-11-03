// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The world's calendar for the app's tests (#608): the bundled reference data,
// an update moving the first term's exams, a release put on a world's calendar
// stream as the Ministry's PC would put it, keys under the world's signer's
// name that the world does not trust, and a send that fails on the national
// space while asked to. Every key and entry is made up.

import {
  draftUpdate,
  EMPTY_DRAFT,
  parseDay,
  sealWorldCalendar,
  setDraftEntry,
  toBase64Url,
  worldCalendarFile,
  worldCalendarPlace,
  type CalendarUpdate,
  type WorldKeys,
} from '@minhajna/core';
import { NATIONAL_SPACE } from '../src/demo/world-calendar-read';
import { WORLD_SIGNER, type Send } from '../src/demo/world-session';
import { bundledReference, readReference } from '../src/reference';
import { nodeKit, type DemoServer } from './world-server';

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
export const reference = read;
export const { calendar, profile } = reference;
export const exam = calendar.entries.find((one) => one.id === 'term-1-exams')!;

/** The update moving the first term's exams a week later, the release after the bundled one. */
export function moving(): CalendarUpdate {
  const later = { ...exam, from: parseDay('2026-12-20'), to: parseDay('2026-12-24') };
  const draft = setDraftEntry(calendar.entries, EMPTY_DRAFT, later, 'A made-up reason');
  return draftUpdate(draft, profile, calendar.year, calendar.release, calendar.year.terms[0].to);
}

/** Puts a file signed with the keys on the world's calendar stream from `first`, and gives the next number. */
export async function publish(
  server: DemoServer,
  world: { readonly id: string; readonly keys: WorldKeys; readonly sealing: Uint8Array },
  update: CalendarUpdate,
  first = 0,
): Promise<number> {
  const file = await worldCalendarFile(world.keys, WORLD_SIGNER, update, nodeKit.sign);
  const place = await worldCalendarPlace(world.sealing, nodeKit.mac);
  const sealed = await sealWorldCalendar(place, file, first, nodeKit.cipher);
  const path = `/worlds/${world.id}/spaces/${NATIONAL_SPACE}`;
  await server.send({ method: 'PUT', path, body: { kind: 'national' } });
  const batches = sealed.map((one) => toBase64Url(one.bytes));
  const put = await server.send({
    method: 'POST',
    path: `${path}/batches`,
    body: { stream: place.stream, first, batches },
  });
  if (put.status !== 201) throw new Error(`The release was not put: ${put.status}`);
  return first + sealed.length;
}

/** The world's keys with a fresh pair under the same name, which the world does not trust. */
export async function strangerKeys(keys: WorldKeys): Promise<WorldKeys> {
  const { pkcs8 } = await nodeKit.newPair();
  return { ...keys, private: { [WORLD_SIGNER]: pkcs8 } };
}

/** A send to the server that fails on the national space while `failing()` says so. */
export const flakySend =
  (server: DemoServer, failing: () => boolean): Send =>
  (request) =>
    failing() && request.path.includes(`/spaces/${NATIONAL_SPACE}`)
      ? Promise.resolve({ status: 500, body: null, retryAfter: null })
      : server.send(request);
