// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The start-up check for #19: with a full year of demo-class records (#77),
// the app must reach Today in under 2 seconds on a budget phone (PRD §6.8).
// Debug builds can fill the app's own history with the core's demo year, made
// up from start to end, but only while it is empty, so no record is ever
// mixed with it. A release build signed with the same key then opens it, and
// Android times the start.

import { makeContext, parseDay, todayView, type Reference } from '@minhajna/core';
import { makeDemoYear, type DemoLevel } from '@minhajna/core/test-support/demo-year';
import type { Spec as StorageSpec } from '../native/NativeMinhajnaStorage';
import { bundledReference, readReference } from '../reference';
import { nativeDeps, nativeStore, openRecordBook } from '../storage/history';

export interface DemoTimes {
  readonly entries: number;
  /** Opening the history: loading, verifying every entry and building the state. */
  readonly openMilliseconds: number;
  /** Working out Today for the year's last day, from the opened state. */
  readonly todayMilliseconds: number;
}

function bundled(): Reference {
  const read = readReference(bundledReference);
  if (!read.ok) throw new Error('The bundled reference data does not verify');
  const { year, entries: calendar, release: calendarRelease } = read.calendar;
  return { country: read.profile, year, calendar, calendarRelease, packs: new Map() };
}

/** Writes a demo year to the app's own history, which must be empty, then times opening it. */
export async function fillWithDemoYear(storage: StorageSpec, level: DemoLevel): Promise<DemoTimes> {
  await storage.openHistory();
  const store = nativeStore(storage);
  if ((await store.load()).length > 0) throw new Error('The history is not empty: nothing was written');
  const year = await makeDemoYear(bundled(), nativeDeps(storage), level);
  for (const entry of year.entries) await store.append(entry);
  const start = Date.now();
  const book = await openRecordBook(storage);
  const opened = Date.now();
  todayView(makeContext(year.reference, book.state), parseDay('2027-07-08'));
  return { entries: book.entries.length, openMilliseconds: opened - start, todayMilliseconds: Date.now() - opened };
}
