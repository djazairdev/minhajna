// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's covers (#586, answer 614): the latest arrangement of each
// session on each day, another school's and an unmarked one left out, under its
// own key; how many covers each person gave between two days, each session and
// day once; the suggestion of whoever gave the fewest, in the staff list's
// order on a tie; and a cover refused when it is not of its shape or names
// someone where nobody takes the session. Every school, session and teacher is
// made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { coverLog, coverOn, coverSuggestion, readSchoolCover, recordKey, type SchoolCover } from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';
import { SCHOOL } from './school-devices.ts';

const [A, B] = ['a'.repeat(32), 'b'.repeat(32)];
const cover = (session: string, day: string, arrangement: SchoolCover['arrangement'], by: string | null = null) =>
  ({ school: SCHOOL, day: d(day), session, arrangement, by }) as SchoolCover;

describe('a session marked for cover', () => {
  it('keeps each session’s latest arrangement on its day, and drops one unmarked', async () => {
    const book = await openBook(cemEvents());
    const put = (one: SchoolCover) => book.record(one.day, { kind: 'school.cover', cover: one });
    await put(cover(A, '2027-01-05', 'supervision'));
    await put(cover(A, '2027-01-05', 'colleague', 'teacher-2'));
    await put(cover(B, '2027-01-05', 'release'));
    await put(cover(B, '2027-01-05', null));
    await put(cover(B, '2027-01-06', 'merge'));
    await put({ ...cover(A, '2027-01-05', 'study'), school: 'another-made-up-space' });
    const day = coverOn(book.entries, SCHOOL, d('2027-01-05'));
    assert.deepEqual(
      [...day.values()].map((one) => [one.session, one.arrangement, one.by]),
      [[A, 'colleague', 'teacher-2']],
    );
    assert.deepEqual([...coverOn(book.entries, SCHOOL, d('2027-01-06')).keys()], [B]);
    await put(cover(B, '2027-01-05', 'supervision'));
    await put(cover(A, '2027-01-05', 'supervision'));
    assert.deepEqual([...coverOn(book.entries, SCHOOL, d('2027-01-05')).keys()], [B, A]);
    const key = recordKey({ kind: 'school.cover', cover: cover(A, '2027-01-05', 'study') });
    assert.equal(key, `school-cover:${SCHOOL}/2027-01-05/${A}`);
  });

  it('counts the covers each person gave within the days asked, each session and day once', async () => {
    const book = await openBook(cemEvents());
    const put = (one: SchoolCover) => book.record(one.day, { kind: 'school.cover', cover: one });
    await put(cover(A, '2027-01-05', 'supervision', 'teacher-2'));
    await put(cover(A, '2027-01-05', 'supervision', 'teacher-3'));
    await put(cover(B, '2027-01-05', 'study', 'teacher-3'));
    await put(cover(A, '2027-01-06', 'colleague', 'teacher-2'));
    await put(cover(B, '2027-01-06', 'colleague', 'teacher-2'));
    await put(cover(B, '2027-01-06', null));
    await put(cover(A, '2026-12-17', 'supervision', 'teacher-2'));
    await put(cover(A, '2027-01-03', 'study', 'teacher-4'));
    await put({ ...cover(B, '2027-01-04', 'study', 'teacher-4'), school: 'another-made-up-space' });
    const log = coverLog(book.entries, SCHOOL, d('2027-01-03'), d('2027-01-06'));
    assert.deepEqual([...log].sort(), [
      ['teacher-2', 1],
      ['teacher-3', 2],
      ['teacher-4', 1],
    ]);
  });

  it('suggests whoever gave the fewest, the staff list’s order breaking a tie', () => {
    const log = new Map([
      ['teacher-2', 2],
      ['teacher-3', 1],
    ]);
    assert.equal(coverSuggestion(['teacher-2', 'teacher-3', 'teacher-4'], log), 'teacher-4');
    assert.equal(coverSuggestion(['teacher-2', 'teacher-3'], log), 'teacher-3');
    assert.equal(coverSuggestion(['teacher-5', 'teacher-4'], log), 'teacher-5');
    assert.equal(coverSuggestion([], log), null);
  });

  it('refuses a cover that is not of its shape, or names someone where nobody takes it', () => {
    const good = cover(A, '2027-01-05', 'colleague', 'teacher-2');
    assert.deepEqual(readSchoolCover(good), good);
    for (const right of [cover(A, '2027-01-05', null), cover(A, '2027-01-05', 'study'), cover(B, '2027-01-05', 'swap')])
      assert.deepEqual(readSchoolCover(right), right);
    for (const wrong of [
      { ...good, reason: 'ill' },
      { ...good, school: 'short' },
      { ...good, day: '2027-13-01' },
      { ...good, session: 'not-an-id' },
      { ...good, arrangement: 'absence' },
      { ...good, arrangement: 'merge' },
      { ...good, arrangement: 'release' },
      { ...good, arrangement: null },
      { ...good, by: 'Teacher Two' },
      { ...good, by: '-' },
      { ...good, by: 'teacher--2' },
      { ...good, by: 'a'.repeat(65) },
      { ...good, by: 2 },
      null,
    ])
      assert.equal(readSchoolCover(wrong), null);
  });
});
