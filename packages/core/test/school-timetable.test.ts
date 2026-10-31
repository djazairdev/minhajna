// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The versions of a school's timetable a director's device keeps (#578,
// answer 606): read back by number, the first of each number, another school's
// and any that does not read left out; the next number one more than the
// highest; the standing version the highest not for one day; and each version
// recorded under its own key. Every school, class and teacher is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  keptVersions,
  nextVersion,
  readTimetablePublished,
  recordKey,
  standingVersion,
  type TimetablePublished,
} from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';
import { SCHOOL } from './school-devices.ts';

const session = {
  class: '4م2',
  group: '',
  subject: 'العربية',
  teacher: 'بلعيد محمد',
  room: 'القاعة 7',
  day: 1,
  start: 600,
  end: 660,
  week: 'both',
} as const;

const version = (number: number, once = false, school = SCHOOL): TimetablePublished => ({
  school,
  version: number,
  from: d('2026-12-06'),
  once,
  sessions: [session],
});

describe('the versions of a school’s timetable', () => {
  it('reads back each version once, by number, and works out the next and the standing one', async () => {
    const book = await openBook(cemEvents());
    assert.deepEqual(keptVersions(book.entries, SCHOOL), []);
    assert.equal(nextVersion([]), 1);
    assert.equal(standingVersion([]), null);
    await book.record(d('2026-10-20'), { kind: 'school.timetable', published: version(2, true) });
    await book.record(d('2026-10-20'), { kind: 'school.timetable', published: version(1) });
    await book.record(d('2026-10-21'), {
      kind: 'school.timetable',
      published: { ...version(1), from: d('2026-12-13') },
    });
    await book.record(d('2026-10-21'), {
      kind: 'school.timetable',
      published: version(3, false, 'another-made-up-space'),
    });
    await book.record(d('2026-10-22'), {
      kind: 'school.timetable',
      published: { ...version(4), sessions: [{ ...session, end: 600 }] },
    });
    const kept = keptVersions(book.entries, SCHOOL);
    assert.deepEqual(
      kept.map((one) => [one.version, one.once]),
      [
        [1, false],
        [2, true],
      ],
    );
    assert.equal(nextVersion(kept), 3);
    assert.equal(standingVersion(kept)?.version, 1);
    assert.equal(recordKey({ kind: 'school.timetable', published: version(2) }), `school-timetable:${SCHOOL}/2`);
  });

  it('refuses a version that is not of its shape', () => {
    assert.deepEqual(readTimetablePublished(version(1)), version(1));
    for (const wrong of [
      { ...version(1), extra: 1 },
      { ...version(1), version: 0 },
      { ...version(1), from: '2026-13-01' },
      { ...version(1), once: 'no' },
      { ...version(1), school: 'short' },
      { ...version(1), sessions: [{ ...session, row: 2 }] },
      { ...version(1), sessions: [{ ...session, teacher: '' }] },
      { ...version(1), sessions: [{ ...session, class: '4م\u202e2' }] },
      { ...version(1), sessions: [{ ...session, week: 'C' }] },
      { ...version(1), sessions: Array.from({ length: 2001 }, () => session) },
      null,
    ])
      assert.equal(readTimetablePublished(wrong), null);
  });
});
