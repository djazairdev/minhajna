// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which of the phone's schools a delivery fills (answer 808): the one with
// the delivery's code, the school named from Settings, the only school
// without a class, or a new one, saying when the code or, without one, the
// name is another; and for a school no longer listed, the named or the only
// school, or none. Made-up schools only.

import { parseDay, type RecordEvent, type School } from '@minhajna/core';
import { openTestData } from '../jest/app-data';
import { MADE_UP_DELIVERY } from '../jest/directory-join';
import { CHOSEN } from '../jest/join-screen';
import { joinTarget } from '../src/join/join-target';

const other: School = { ...CHOSEN, id: 's-2', code: 'cem-16-2', name: 'متوسطة الفجر' };
const typed: School = { ...CHOSEN, id: 's-3', name: 'متوسطة مكتوبة' };
delete (typed as { code?: string }).code;
const unlisted = { ...MADE_UP_DELIVERY, school: null };
const taughtAt = (schoolId: string): RecordEvent => ({
  kind: 'class.set',
  schoolClass: {
    id: `k-${schoolId}`,
    schoolId,
    level: 'cem',
    grade: '1am',
    name: '1م9',
    groups: [{ id: `k-${schoolId}.w`, kind: 'whole', name: '1م9' }],
  },
});

async function stateOf(...events: RecordEvent[]) {
  const data = await openTestData();
  await data.book.recordAll(parseDay('2026-10-01'), events);
  return data.book.state;
}
const target = async (events: RecordEvent[], named?: string, delivery = MADE_UP_DELIVERY) => {
  const found = joinTarget(await stateOf(...events), delivery, named, () => 'fresh');
  return found === null ? null : [found.school.id, found.kind];
};
const school = (one: School): RecordEvent => ({ kind: 'school.set', school: one });

test('takes the school named from Settings, saying when its code is another or no longer listed', async () => {
  expect(await target([school(CHOSEN), school(other)], 's-1')).toEqual(['s-1', 'chosen']);
  expect(await target([school(other)], 's-2')).toEqual(['s-2', 'other']);
  expect(await target([school(CHOSEN)], 's-1', unlisted)).toEqual(['s-1', 'unlisted']);
});

test('takes the school holding the delivery’s code over the one named from Settings, saying so', async () => {
  expect(await target([school(CHOSEN), school(other)], 's-2')).toEqual(['s-1', 'elsewhere']);
});

test('takes the school with the delivery’s code among several', async () => {
  expect(await target([school(other), school(CHOSEN), taughtAt('s-2')])).toEqual(['s-1', 'chosen']);
});

test('takes the only school without a class, saying when its code, or its name without one, is another', async () => {
  expect(await target([school(other), school(typed), taughtAt('s-3')])).toEqual(['s-2', 'other']);
  expect(await target([school(typed)])).toEqual(['s-3', 'other']);
  expect(await target([school({ ...typed, name: 'متوسطة النجاح' })])).toEqual(['s-3', 'chosen']);
});

test('adds a school when none fits', async () => {
  const found = joinTarget(await stateOf(school(other), school(typed)), MADE_UP_DELIVERY, undefined, () => 'fresh');
  expect(found).toEqual({
    school: { id: 'fresh', name: 'متوسطة النجاح', levels: ['cem'], subjects: [] },
    kind: 'new',
  });
  expect(await target([])).toEqual(['fresh', 'new']);
});

test('gives an unlisted school’s delivery to the only empty or only school, or to none', async () => {
  expect(await target([school(other), school(typed), taughtAt('s-3')], undefined, unlisted)).toEqual([
    's-2',
    'unlisted',
  ]);
  expect(await target([school(other), taughtAt('s-2')], undefined, unlisted)).toEqual(['s-2', 'unlisted']);
  expect(await target([school(other), school(typed)], undefined, unlisted)).toBeNull();
  expect(await target([], undefined, unlisted)).toBeNull();
});
