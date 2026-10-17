// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// An empty history in the fake native store and Algeria's bundled profile,
// for tests of screens that read or keep records.

import { parseDay, type CountryProfile, type RecordBook } from '@minhajna/core';
import type { ReactNode } from 'react';
import { bundledReference, readReference } from '../src/reference';
import { AppDataProvider } from '../src/storage/AppData';
import { nativeDeps, openRecordBook } from '../src/storage/history';
import { FakeStorage } from './fake-storage';

export interface TestData {
  readonly storage: FakeStorage;
  readonly book: RecordBook;
  readonly profile: CountryProfile;
}

/** Opens an empty history, or the one in `storage`. */
export async function openTestData(storage = new FakeStorage()): Promise<TestData> {
  const reference = readReference(bundledReference);
  if (!reference.ok) throw new Error('The bundled reference data is refused');
  const book = await openRecordBook(storage.asSpec());
  return { storage, book, profile: reference.profile };
}

/** Wraps a screen in the provider, recording every change on one made-up day. */
export function withData(data: TestData, children: ReactNode) {
  return (
    <AppDataProvider
      book={data.book}
      profile={data.profile}
      random={nativeDeps(data.storage.asSpec()).random}
      today={() => parseDay('2026-10-15')}
    >
      {children}
    </AppDataProvider>
  );
}
