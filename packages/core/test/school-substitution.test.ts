// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A substitute's appointment in the director's store (#587, answer 615): each
// appointment at its latest record, in the order first recorded, another
// school's left out, under its own key; and an appointment refused when it
// carries a reason, a school, ID or staff ID of the wrong shape, the holder as
// substitute, an empty, long or unclean decision, no class, an empty one or one
// twice, a first day that is not one, no version, or an end before its first
// day. Every school, class and teacher is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { keptSubstitutions, readSchoolSubstitution, recordKey, type SchoolSubstitution } from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';
import { SCHOOL } from './school-devices.ts';

const [A, B] = ['a'.repeat(32), 'b'.repeat(32)];
const appointment = (id: string, ended: string | null = null): SchoolSubstitution => ({
  school: SCHOOL,
  id,
  holder: 'teacher-2',
  substitute: 'teacher-5',
  decision: '2029/117',
  classes: ['4م1', '4م2'],
  from: d('2027-01-10'),
  version: 2,
  ended: ended === null ? null : d(ended),
});

describe('a substitute’s appointment', () => {
  it('keeps each appointment at its latest record, in the order first recorded, under its own key', async () => {
    const book = await openBook(cemEvents());
    const put = (one: SchoolSubstitution) =>
      book.record(d('2027-01-06'), { kind: 'school.substitution', substitution: one });
    await put(appointment(A));
    await put(appointment(B));
    await put(appointment(A, '2027-02-14'));
    await put({ ...appointment(B), school: 'another-made-up-space' });
    assert.deepEqual(
      keptSubstitutions(book.entries, SCHOOL).map((one) => [one.id, one.ended]),
      [
        [A, '2027-02-14'],
        [B, null],
      ],
    );
    const key = recordKey({ kind: 'school.substitution', substitution: appointment(A) });
    assert.equal(key, `school-substitution:${SCHOOL}/${A}`);
  });

  it('refuses an appointment that is not of its shape', () => {
    const good = appointment(A);
    assert.deepEqual(readSchoolSubstitution(good), good);
    for (const wrong of [
      { ...good, reason: 'ill' },
      { ...good, school: 'short' },
      { ...good, id: 'not-an-id' },
      { ...good, holder: 'Teacher Two' },
      { ...good, substitute: 'teacher-2' },
      { ...good, decision: '' },
      { ...good, decision: 'x'.repeat(41) },
      { ...good, decision: ' 2029/117' },
      { ...good, classes: [] },
      { ...good, classes: ['4م1', ''] },
      { ...good, classes: ['4م1', '4م1'] },
      { ...good, from: '2027-13-01' },
      { ...good, version: 0 },
      { ...good, ended: '2027-01-09' },
      null,
    ])
      assert.equal(readSchoolSubstitution(wrong), null);
  });
});
