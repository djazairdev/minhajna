// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The loads the check sends, all made up: the core's demo year (#77), 45
// invented pupils and every session and roll call of 2026/27, as a first
// sync, a school day and a school week of it as daily syncs. And two
// devices that took the same roll call apart, for the conflict.

import { readFileSync } from 'node:fs';
import {
  MemoryStore,
  RecordBook,
  makeContext,
  parseCountryProfile,
  parseSchoolCalendar,
  pupilsFor,
  rollCallUnits,
  takeRollCall,
  toHex,
  type Day,
  type Entry,
  type HistoryDeps,
  type Reference,
} from '@minhajna/core';
import { makeDemoYear, type DemoLevel, type DemoYear } from '@minhajna/core/test-support/demo-year';

const encoder = new TextEncoder();

/** Node's Web Crypto, as the core's tests use it. */
export const deps: HistoryDeps = {
  digest: async (text) => toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))),
  random: (length) => crypto.getRandomValues(new Uint8Array(length)),
};

function readData(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../../data/dz/${name}`, import.meta.url), 'utf8'));
}

/** The bundled Algerian profile and 2026/27 calendar. */
export function demoReference(): Reference {
  const profile = parseCountryProfile(readData('profile.json'));
  if (!profile.ok) throw new Error('The bundled profile does not read');
  const calendar = parseSchoolCalendar(readData('calendar-2026-2027.json'), profile.value);
  if (!calendar.ok) throw new Error('The bundled calendar does not read');
  return { country: profile.value, year: calendar.value.year, calendar: calendar.value.entries, packs: new Map() };
}

export function demoYear(level: DemoLevel): Promise<DemoYear> {
  return makeDemoYear(demoReference(), deps, level);
}

/** The entries recorded on the days from `from` to `to`, inclusive. */
export function between(entries: readonly Entry[], from: Day, to: Day): Entry[] {
  return entries.filter((entry) => entry.day >= from && entry.day <= to);
}

export interface TwoDevices {
  /** What both devices held at their last sync. */
  readonly base: readonly Entry[];
  /** What each device recorded since. */
  readonly phone: readonly Entry[];
  readonly computer: readonly Entry[];
}

async function reopen(entries: readonly Entry[]): Promise<RecordBook> {
  const store = new MemoryStore();
  for (const entry of entries) await store.append(entry);
  return RecordBook.open(store, deps);
}

/**
 * The phone and the computer both hold the year up to `day`. Then each, on
 * its own, corrects the same roll call differently and takes another the
 * same way; the computer also corrects a second roll call.
 */
export async function twoDevices(year: DemoYear, day: Day): Promise<TwoDevices> {
  const base = year.entries.filter((entry) => entry.day <= day);
  const phone = await reopen(base);
  const computer = await reopen(base);
  const context = makeContext(year.reference, phone.state);
  const units = rollCallUnits(context, year.classId, year.reference.year.from, day);
  const [first, second, third] = units.slice(-3);
  if (first === undefined || second === undefined || third === undefined) throw new Error('Too few roll calls');
  const [one, two] = pupilsFor(context, first);
  if (one === undefined || two === undefined) throw new Error('Too few pupils');
  const same = takeRollCall(context, second, { absent: [], late: [] }, 'Synthetic correction: same on both.');
  const before = phone.entries.length;
  await phone.recordAll(day, [
    takeRollCall(context, first, { absent: [{ pupilId: one.id, justified: false }], late: [] }, 'Synthetic: phone.'),
    same,
  ]);
  await computer.recordAll(day, [
    takeRollCall(context, first, { absent: [], late: [two.id] }, 'Synthetic: computer.'),
    same,
    takeRollCall(context, third, { absent: [], late: [] }, 'Synthetic: computer only.'),
  ]);
  return { base, phone: phone.entries.slice(before), computer: computer.entries.slice(before) };
}
