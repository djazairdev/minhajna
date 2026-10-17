// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Public reference assets only. No upload or arbitrary input file is accepted.

import { parseCountryProfile, parseSchoolCalendar, type Reference } from '../../core/src/index.ts';
import { makeDemoYear, type DemoLevel, type DemoYear } from '../../core/test/demo-year.ts';
import { historyDeps } from './crypto.ts';

async function json(name: string): Promise<unknown> {
  const response = await fetch(new URL(`../../../${name}`, import.meta.url));
  if (!response.ok) throw new Error('reference');
  return response.json();
}

/** The build copies these two bundled files into the same static origin. */
export async function reference(): Promise<Reference> {
  const profile = parseCountryProfile(await json('profile.json'));
  if (!profile.ok) throw new Error('profile');
  const calendar = parseSchoolCalendar(await json('calendar.json'), profile.value);
  if (!calendar.ok) throw new Error('calendar');
  return { country: profile.value, year: calendar.value.year, calendar: calendar.value.entries, packs: new Map() };
}

/** Generation is outside the timed encryption and database measurements. */
export async function workload(ref: Reference, level: DemoLevel): Promise<DemoYear> {
  return makeDemoYear(ref, historyDeps, level);
}
