// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { directorSchool, seedNationalWorld, type SchoolCalendar } from '@minhajna/core';
import { startWorld } from '../src/demo/world-session';
import { personName } from '../src/director/dashboard-text';
import { assignmentsOf, holdSchool, issueFor } from '../src/director/issue-session';
import { bundledReference, readReference } from '../src/reference';
import { openRecordBook } from '../src/storage/history';
import { FakeStorage } from './fake-storage';
import { nodeKit, type DemoServer } from './world-server';

type Asked = { readonly rawId: ArrayBuffer; readonly getClientExtensionResults: () => unknown };

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
/** The bundled reference, read once. */
export const reference = read;
const calendar: SchoolCalendar = reference.calendar;
const navigatorWas = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

/** A made-up PRF output of 32 bytes, from its first byte. */
export const prfFrom = (first: number, length = 32) => Uint8Array.from({ length }, (_, at) => (first + at) % 256);

/**
 * A made-up browser's WebAuthn, for Jest, on `globalThis`: its key answers the
 * PRF output `prf` gives, or none, and `create` gives it too when
 * `onCreate`, or only says the extension is on when `enabled`.
 */
export function fakeBrowser(prf: () => Uint8Array | null, options: { enabled?: boolean; onCreate?: boolean } = {}) {
  const { enabled = true, onCreate = false } = options;
  const answer = (results: boolean): Asked => ({
    rawId: Uint8Array.of(9, 9, 9).buffer,
    getClientExtensionResults: () => {
      const first = results ? prf() : null;
      return { prf: { enabled, ...(first === null ? {} : { results: { first: first.slice().buffer } }) } };
    },
  });
  const credentials = {
    create: jest.fn<Promise<Asked>, [unknown]>(() => Promise.resolve(answer(onCreate))),
    get: jest.fn<Promise<Asked>, [unknown]>(() => Promise.resolve(answer(true))),
  };
  Object.defineProperty(globalThis, 'navigator', { value: { credentials }, configurable: true });
  Object.assign(globalThis, { PublicKeyCredential: class {} });
  return credentials;
}

/** Takes the made-up browser away, with no security keys left. */
export function noBrowser() {
  if (navigatorWas !== undefined) Object.defineProperty(globalThis, 'navigator', navigatorWas);
  Reflect.deleteProperty(globalThis, 'PublicKeyCredential');
}

/** A world whose director holds the school key, issues for its first teacher, and a staffroom PC. */
export async function keyWorld(server: DemoServer) {
  const started = await startWorld('national', calendar, nodeKit, server.send);
  const id = started.keys.world;
  const { zones = [], workingDays } = reference.profile;
  const school = directorSchool(seedNationalWorld(id, zones, workingDays, reference.packs))!;
  const device = async () => ({
    world: id,
    date: started.date,
    book: await openRecordBook(new FakeStorage().asSpec()),
  });
  const [director, pc] = [await device(), await device()];
  const desk = await holdSchool(director, nodeKit, server.send);
  const assignments = await assignmentsOf(desk, school.teachers, nodeKit);
  const first = school.teachers[0];
  const issue = async (access: 'phone' | 'key') =>
    (await issueFor(director, desk, assignments.get(first.id)!, access, nodeKit, server.send)).kept;
  const names = { schoolName: personName(school), teacher: personName(first) };
  return { id, school, pc, desk, issue, names };
}
