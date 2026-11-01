// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the school exchanges (#592, answer 620): the absences choice off at
// first, each change from the one before by its day, the same choice again, one
// not of its shape and another school's left out, two changes on one day both
// listed, the latest counting, under its own key, and one refused when it is
// not of its shape; and the school's space exported whole, its fields in one
// order, marked a demo world's, every stream's sealed batches in the order
// given and in base64url, never opened, and refused for an ID that is not a
// space's. Every school and batch here is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  absencesChanges,
  absencesSent,
  fromBase64Url,
  readSchoolAbsences,
  recordKey,
  spaceExportText,
  SPACE_EXPORT,
} from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';
import { SCHOOL } from './school-devices.ts';

const OTHER = 'another-made-up-space';

describe('the school’s absences choice', () => {
  it('is off at first, then each change counts by its day, the latest last', async () => {
    const book = await openBook(cemEvents());
    const put = (day: string, send: boolean, school = SCHOOL) =>
      book.record(d(day), { kind: 'school.absences', absences: { school, send } });
    assert.deepEqual([absencesSent(book.entries, SCHOOL), absencesChanges(book.entries, SCHOOL)], [false, []]);
    await put('2027-01-05', false);
    await book.record(d('2027-01-05'), { kind: 'school.absences', absences: { school: SCHOOL, send: 'yes' } as never });
    await put('2027-01-05', true);
    await put('2027-01-06', true);
    await put('2027-01-07', true, OTHER);
    await put('2027-01-10', false);
    assert.deepEqual(absencesChanges(book.entries, SCHOOL), [
      { day: d('2027-01-05'), send: true },
      { day: d('2027-01-10'), send: false },
    ]);
    assert.deepEqual([absencesSent(book.entries, SCHOOL), absencesSent(book.entries, OTHER)], [false, true]);
    await put('2027-01-11', true);
    await put('2027-01-11', false);
    assert.deepEqual(absencesChanges(book.entries, SCHOOL).slice(2), [
      { day: d('2027-01-11'), send: true },
      { day: d('2027-01-11'), send: false },
    ]);
    assert.equal(absencesSent(book.entries, SCHOOL), false);
    const key = recordKey({ kind: 'school.absences', absences: { school: SCHOOL, send: true } });
    assert.equal(key, `school-absences:${SCHOOL}`);
  });

  it('refuses a choice that is not of its shape', () => {
    assert.deepEqual(readSchoolAbsences({ school: SCHOOL, send: true }), { school: SCHOOL, send: true });
    for (const value of [
      null,
      { school: SCHOOL },
      { school: SCHOOL, send: 'yes' },
      { school: 'short', send: true },
      { school: SCHOOL, send: true, at: '10:00' },
    ]) {
      assert.equal(readSchoolAbsences(value), null, JSON.stringify(value));
    }
  });
});

describe('the school’s space exported whole', () => {
  it('names the world, space and day, marks a demo world’s, and keeps every batch sealed in order', () => {
    const streams = new Map([
      ['stream-b', [{ number: 0, bytes: new Uint8Array([1, 2, 3]) }]],
      [
        'stream-a',
        [
          { number: 0, bytes: new Uint8Array([251, 255]) },
          { number: 1, bytes: new Uint8Array([]) },
        ],
      ],
    ]);
    const text = spaceExportText({ world: 'K7QF4', school: SCHOOL, exported: d('2027-01-12') }, streams);
    const read = JSON.parse(text) as Record<string, unknown>;
    assert.deepEqual(Object.keys(read), ['format', 'demo', 'world', 'school', 'exported', 'streams']);
    assert.deepEqual(
      [read['format'], read['demo'], read['world'], read['school'], read['exported']],
      [SPACE_EXPORT, true, 'K7QF4', SCHOOL, '2027-01-12'],
    );
    const kept = read['streams'] as { stream: string; batches: { number: number; bytes: string }[] }[];
    assert.deepEqual(
      kept.map((one) => [one.stream, one.batches.map((batch) => batch.number)]),
      [
        ['stream-b', [0]],
        ['stream-a', [0, 1]],
      ],
    );
    assert.deepEqual([...fromBase64Url(kept[1]!.batches[0]!.bytes)!], [251, 255]);
    assert.deepEqual([kept[1]!.batches[0]!.bytes, kept[1]!.batches[1]!.bytes], ['-_8', '']);
    assert.throws(
      () => spaceExportText({ world: 'K7QF4', school: 'short', exported: d('2027-01-12') }, streams),
      RangeError,
    );
    assert.equal(
      spaceExportText({ world: 'K7QF4', school: SCHOOL, exported: d('2027-01-12') }, new Map()),
      text.replace(/"streams":.*$/u, '"streams":[]}'),
    );
  });
});
