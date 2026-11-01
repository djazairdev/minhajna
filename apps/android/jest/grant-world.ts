// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up national world for the grant's tests (#593): the director's device
// holds a school's key and lists it in its directorate's space, an inspector's
// device posts its key there, and a directorate's device fills in a request;
// how the school's listings read back, and what a holder's device opens on the
// school's request stream.

import {
  addDays,
  directorateSpace,
  listedSchools,
  listingPlace,
  openDirectorateRecords,
  openGrantEnvelopes,
  openGrantRequests,
  requestPlace,
} from '@minhajna/core';
import { startWorld, type Send } from '../src/demo/world-session';
import { holdSchool } from '../src/director/issue-session';
import type { IssueDesk } from '../src/director/school-desk';
import { listSchool } from '../src/director/school-listing';
import type { GrantForm } from '../src/directorate/request-session';
import { postInspectorKey } from '../src/inspector/inspector-key-session';
import { bundledReference, readReference } from '../src/reference';
import { spaceBatches } from '../src/school/space-read';
import { openRecordBook } from '../src/storage/history';
import { FakeStorage } from './fake-storage';
import { server } from './timetable-send';
import { nodeKit as kit } from './world-server';

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const calendar = read.calendar;

export const SCHOOL = { id: 'school-2', directorateId: 'directorate-1' };

/** The reference the tests read, for a page that seeds the world's schools. */
export const reference = read;

type Seeded = { readonly id: string; readonly directorateId: string };

/**
 * A started world whose school, SCHOOL unless `pick` names a seeded one, is
 * listed and whose inspector posted a key, and a directorate's device.
 */
export async function listed(pick: (world: string) => Seeded = () => SCHOOL) {
  const started = await startWorld('national', calendar, kit, server.send);
  const id = started.keys.world;
  const school = pick(id);
  const device = async () => ({
    world: id,
    date: started.date,
    book: await openRecordBook(new FakeStorage().asSpec()),
  });
  const director = await device();
  const desk = await holdSchool(director, kit, server.send);
  await listSchool(id, school, desk.held.school, kit, server.send);
  const { fingerprint } = await postInspectorKey(await device(), school.directorateId, kit, server.send);
  const form = (change: Partial<GrantForm> = {}): GrantForm => ({
    school: school.id,
    fingerprint,
    label: 'Made-up inspector of district 3',
    subject: 'arabic',
    classes: ['4م1', '4م2'],
    weeks: { from: started.date, to: addDays(started.date, 21) },
    until: addDays(started.date, 42),
    ...change,
  });
  return { id, device, desk, fingerprint, directorate: await device(), form };
}

/** The schools listed in the directorate's space, and how many batches the listing stream holds. */
export async function schools(id: string, directorate = SCHOOL.directorateId, send: Send = server.send) {
  const space = await directorateSpace(id, directorate, kit.mac);
  const place = await listingPlace(space, kit.mac);
  const batches = (await spaceBatches(id, space, send)).get(place.stream) ?? [];
  return { count: batches.length, listed: listedSchools(await openDirectorateRecords(place, batches, kit.cipher), id) };
}

/** The space a school is listed with once a background listing settles, waiting a bounded number of turns. */
export async function listedAs(id: string, school: { id: string; directorateId: string }, space: string, send: Send) {
  for (let turn = 0; turn < 200; turn += 1) {
    if ((await schools(id, school.directorateId, send)).listed.get(school.id) === space) return space;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return (await schools(id, school.directorateId, send)).listed.get(school.id);
}

/** The requests a holder's device opens on its school's request stream. */
export async function opened(id: string, desk: Pick<IssueDesk, 'held' | 'crypto'>) {
  const place = await requestPlace(desk.held.school, kit.mac);
  const batches = (await spaceBatches(id, desk.held.school, server.send)).get(place.stream) ?? [];
  const records = await openGrantEnvelopes(place, batches, kit.cipher);
  return openGrantRequests(records, desk.held.school, desk.held.device, desk.crypto, kit.cipher);
}
