// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Node-only test loading, deliberately outside the portable fixture entry.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MemoryStore, RecordBook, parseCountryProfile, parseSchoolCalendar, type Reference } from '../src/index.ts';
import { type DemoYear } from './demo-year.ts';
import { deps } from './support.ts';

function readData(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../../data/dz/${name}`, import.meta.url), 'utf8'));
}

/** Reads and validates the public bundled profile/calendar, without a plan pack. */
export function demoReference(): Reference {
  const profile = parseCountryProfile(readData('profile.json'));
  assert.ok(profile.ok);
  const calendar = parseSchoolCalendar(readData('calendar-2026-2027.json'), profile.value);
  assert.ok(calendar.ok);
  return { country: profile.value, year: calendar.value.year, calendar: calendar.value.entries, packs: new Map() };
}

/** Simulates storage of the serialised history before opening a new book. */
export async function reopenDemo(fixture: DemoYear): Promise<RecordBook> {
  const store = new MemoryStore();
  for (const entry of fixture.entries) await store.append(JSON.parse(JSON.stringify(entry)) as typeof entry);
  return RecordBook.open(store, deps);
}
