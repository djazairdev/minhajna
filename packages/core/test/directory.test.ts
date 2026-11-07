// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The directory's readers, what a teacher's phone receives, and the options a
// new list starts with (answers 802 to 808). Made-up data only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  deliveryFor,
  nextReferenceVersion,
  readReferenceDraft,
  readReferenceList,
  readSchoolBook,
  startingLevels,
  type CountryProfile,
  type SchoolBook,
} from '../src/index.ts';

const school = {
  id: 's1',
  name: 'Made-up school',
  level: 'cem',
  wilaya: '16',
  commune: { code: '1601', name: { fr: 'Made-up town' } },
};
const levels = [{ code: 'cem', options: [{ code: 'math', subjects: ['math'] }] }];

const book = {
  format: 1,
  teachers: [
    { id: 't1', name: 'Made-up one', option: 'math' },
    { id: 't2', name: 'Made-up two', option: 'french' },
  ],
  classes: [
    {
      id: 'c1',
      grade: '4am',
      name: '4AM1',
      pupils: [{ id: 'p1', name: 'Made-up pupil', sex: 'f', registration: '1120450087' }],
      teachers: { math: 't1', french: 't2' },
    },
    { id: 'c2', grade: '4am', name: '4AM2', pupils: [], teachers: { french: 't2' } },
  ],
  week: [
    { id: 'w1', classId: 'c1', subject: 'math', weekday: 0, slot: { half: 'morning', index: 1 } },
    { id: 'w2', classId: 'c1', subject: 'french', weekday: 0, slot: { half: 'morning', index: 2 } },
    { id: 'w3', classId: 'c2', subject: 'french', weekday: 1, slot: { half: 'afternoon', index: 1 } },
  ],
};

test('a draft keeps its levels and schools, and says what is wrong with a bad one', () => {
  const read = readReferenceDraft({ levels, schools: [school] });
  assert.ok(typeof read !== 'string');
  assert.equal(read.schools[0]?.commune.code, '1601');
  assert.match(readReferenceDraft({ levels }) as string, /levels and schools/u);
  assert.match(readReferenceDraft({ levels, schools: [school, school] }) as string, /twice/u);
  assert.match(readReferenceDraft({ levels: [], schools: [school] }) as string, /unknown level/u);
  assert.match(readReferenceDraft({ levels, schools: [{ ...school, name: ' ' }] }) as string, /needs a name/u);
  assert.match(readReferenceDraft({ levels, schools: [{ ...school, commune: {} }] }) as string, /commune/u);
  assert.match(
    readReferenceDraft({ levels: [{ code: 'cem', options: [{ code: 'x', subjects: [] }] }], schools: [] }) as string,
    /subjects/u,
  );
});

test('a published list needs its format, version and day', () => {
  const list = { format: 1, version: '2029.1', published: '2029-09-01', levels, schools: [school] };
  assert.ok(typeof readReferenceList(list) !== 'string');
  assert.equal(typeof readReferenceList({ ...list, format: 2 }), 'string');
  assert.equal(typeof readReferenceList({ ...list, version: '' }), 'string');
  assert.equal(typeof readReferenceList({ ...list, published: 'soon' }), 'string');
});

test('a school book refuses a session of another school, and a bad slot', () => {
  assert.ok(typeof readSchoolBook(book) !== 'string');
  const stray = { ...book, week: [{ ...book.week[0], classId: 'c9' }] };
  assert.match(readSchoolBook(stray) as string, /no class/u);
  const late = { ...book, week: [{ ...book.week[0], slot: { half: 'night', index: 1 } }] };
  assert.match(readSchoolBook(late) as string, /slot/u);
  const crowded = { ...book, classes: [{ ...book.classes[0], pupils: Array(201).fill(book.classes[0]?.pupils[0]) }] };
  assert.match(readSchoolBook(crowded) as string, /bad list/u);
});

test('a delivery holds only the teacher own classes and sessions', () => {
  const read = readSchoolBook(book) as SchoolBook;
  const one = deliveryFor(read, 't1', null);
  assert.deepEqual(
    one?.classes.map(({ id }) => id),
    ['c1'],
  );
  assert.deepEqual(
    one?.sessions.map(({ id }) => id),
    ['w1'],
  );
  assert.equal(Object.hasOwn(one?.classes[0] ?? {}, 'teachers'), false);
  const two = deliveryFor(read, 't2', null);
  assert.deepEqual(
    two?.classes.map(({ id }) => id),
    ['c1', 'c2'],
  );
  assert.deepEqual(
    two?.sessions.map(({ id }) => id),
    ['w2', 'w3'],
  );
  assert.equal(deliveryFor(read, 'nobody', null), null);
});

test('a level with specialists starts with the class teacher, and the others with each subject', () => {
  const profile = {
    levels: [{ code: 'primary' }, { code: 'cem' }],
    subjects: [
      { code: 'arabic', levels: ['primary', 'cem'] },
      { code: 'french', levels: ['primary', 'cem'], specialist: ['primary'] },
    ],
  } as unknown as CountryProfile;
  assert.deepEqual(startingLevels(profile), [
    {
      code: 'primary',
      options: [
        { code: 'class', subjects: ['arabic'], classTeacher: true },
        { code: 'french', subjects: ['french'] },
      ],
    },
    {
      code: 'cem',
      options: [
        { code: 'arabic', subjects: ['arabic'] },
        { code: 'french', subjects: ['french'] },
      ],
    },
  ]);
});

test('versions count within a year', () => {
  assert.equal(nextReferenceVersion(null, 2029), '2029.1');
  assert.equal(nextReferenceVersion('2029.3', 2029), '2029.4');
  assert.equal(nextReferenceVersion('2028.9', 2029), '2029.1');
});
