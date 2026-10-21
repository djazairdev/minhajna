// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// An empty history in the fake native store and Algeria's bundled reference
// data, for tests of screens that read or keep records.

import {
  parseDay,
  type BellData,
  type CalendarEntry,
  type CountryProfile,
  type PlanPack,
  type RecordBook,
  type SchoolYear,
} from '@minhajna/core';
import type { ReactNode } from 'react';
import { bundledReference, readReference } from '../src/reference';
import { AppDataProvider } from '../src/storage/AppData';
import { nativeDeps, openRecordBook } from '../src/storage/history';
import { FakeStorage } from './fake-storage';

export interface TestData {
  readonly storage: FakeStorage;
  readonly book: RecordBook;
  readonly profile: CountryProfile;
  readonly year: SchoolYear;
  readonly calendar: readonly CalendarEntry[];
  readonly calendarRelease: string;
  /** None: a fresh history has applied no calendar update. */
  readonly updatedIds: readonly string[];
  readonly bells: BellData;
  readonly packs: readonly PlanPack[];
}

/** Opens an empty history, or the one in `storage`. */
export async function openTestData(storage = new FakeStorage()): Promise<TestData> {
  const reference = readReference(bundledReference);
  if (!reference.ok) throw new Error('The bundled reference data is refused');
  const book = await openRecordBook(storage.asSpec());
  return {
    storage,
    book,
    profile: reference.profile,
    year: reference.calendar.year,
    calendar: reference.calendar.entries,
    calendarRelease: reference.calendar.release,
    updatedIds: [],
    bells: reference.bells,
    packs: reference.packs,
  };
}

/** Wraps a screen in the provider, recording every change on one made-up day, or on `day`. */
export function withData(data: TestData, children: ReactNode, day = '2026-10-15') {
  return (
    <AppDataProvider
      book={data.book}
      profile={data.profile}
      year={data.year}
      calendar={data.calendar}
      calendarRelease={data.calendarRelease}
      bells={data.bells}
      packs={data.packs}
      random={nativeDeps(data.storage.asSpec()).random}
      today={() => parseDay(day)}
    >
      {children}
    </AppDataProvider>
  );
}
