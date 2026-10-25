// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  MemoryStore,
  SchoolCoverBook,
  type CoverAuthority,
  type CoverRole,
  type CoverSession,
  type HistoryStore,
} from '../src/index.ts';
import { d, year } from './reference-fixtures.ts';
import { deps } from './support.ts';

export const coverDay = d('2026-10-15');
export const schoolSession = (id: string, fields: Partial<CoverSession> = {}): CoverSession => ({
  id,
  schoolId: 's-cem',
  teacherId: 'holder',
  classId: 'k-1',
  className: '4م1',
  level: 'cem',
  day: coverDay,
  slot: { half: 'morning', index: 1 },
  ...fields,
});

/** Invented identities and assignments, never a real school space or authentication fixture. */
export async function coverFixture(store: HistoryStore = new MemoryStore()) {
  let authority: CoverAuthority = {
    nationalSystem: true,
    schoolId: 's-cem',
    actorId: 'director',
    year,
    members: new Map<string, readonly CoverRole[]>([
      ['director', ['director']],
      ['deputy', ['deputy']],
      ['holder', ['teacher']],
      ['colleague', ['teacher']],
      ['other', ['teacher']],
      ['supervisor', ['supervisor']],
      ['preparer', ['timetable-preparer']],
      ['inspector', ['inspector']],
    ]),
    sessions: [
      schoolSession('one'),
      schoolSession('later', { slot: { half: 'morning', index: 2 } }),
      schoolSession('busy', { teacherId: 'other', classId: 'k-2', className: '3م2' }),
      schoolSession('elsewhere', { schoolId: 's-elsewhere' }),
    ],
  };
  const source = () => authority;
  const book = await SchoolCoverBook.open(store, deps, source);
  return {
    book,
    store,
    source,
    scope: (change: Partial<CoverAuthority>) => {
      authority = { ...authority, ...change };
    },
  };
}
