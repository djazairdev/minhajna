// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind a joint class (#43): making one, setting a pupil's year,
// counting each year, the plan step's group and pin for each year, and each
// year's name and row once the class is taught. Made-up data only.

import { jointProblems, parseDay, type Pupil, type RecordEvent, type School } from '@minhajna/core';
import { openTestData } from '../jest/app-data';
import { classRows } from '../src/classes/class-rules';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';
import { sessionMeta } from '../src/today/today-meta';
import { pinEvents, pinOfClass, planGroups } from '../src/plan/plan-rules';
import { bundledReference, readReference } from '../src/reference';
import { jointSchools, newJointClass, withYear, yearTally, yearsValid } from '../src/setup/joint-rules';

const reference = readReference(bundledReference);
if (!reference.ok) throw new Error('The bundled reference data is refused');
const profile = reference.profile;
const primary = profile.levels.find((level) => level.code === 'primary')!;

const school: School = { id: 's-1', name: 'ابتدائية الأمل', levels: ['primary'], subjects: ['arabic', 'math'] };
let next = 0;
const newId = () => `id-${++next}`;
const joint = newJointClass({ id: 'k-1', groupId: 'g-all' }, profile, school, ['5ap', '4ap'], ' 4-5 أ ', newId);
const [four, five] = joint.groups.slice(1);

test('offers a joint class at schools that teach primary only', () => {
  expect(jointSchools([school, { ...school, id: 's-2', levels: ['cem'] }]).map((one) => one.id)).toEqual(['s-1']);
});

test('makes a joint class whose years pass the core’s check', () => {
  expect(joint).toMatchObject({ level: 'primary', grade: '4ap', name: '4-5 أ' });
  expect(joint.groups.map((group) => group.grade)).toEqual([undefined, '4ap', '5ap']);
  expect(jointProblems(joint, primary)).toEqual([]);
});

test('takes two or three different years of primary', () => {
  expect(yearsValid(profile, ['4ap', '5ap'])).toBe(true);
  expect(yearsValid(profile, ['1ap', '2ap', '3ap'])).toBe(true);
  expect(yearsValid(profile, ['4ap'])).toBe(false);
  expect(yearsValid(profile, ['1ap', '2ap', '3ap', '4ap'])).toBe(false);
  expect(yearsValid(profile, ['4ap', '1am'])).toBe(false);
});

test('sets a pupil’s year, keeping their other groups', () => {
  expect(withYear(['half-1'], joint, '4ap')).toEqual(['half-1', four?.id]);
  expect(withYear(['half-1', four.id], joint, '5ap')).toEqual(['half-1', five?.id]);
});

test('counts each year’s pupils', () => {
  const pupil = (id: string, groups: string[]): Pupil => ({
    id,
    classId: 'k-1',
    name: id,
    sex: 'f',
    groups,
    movements: [],
  });
  expect(yearTally([pupil('a', [four.id]), pupil('b', [five.id]), pupil('c', [five.id])], joint)).toEqual([
    { grade: '4ap', count: 1 },
    { grade: '5ap', count: 2 },
  ]);
});

test('puts a joint class in each year’s plan group, with a pin for each year', async () => {
  const events: RecordEvent[] = [
    { kind: 'school.set', school },
    { kind: 'class.set', schoolClass: joint },
    { kind: 'course.set', course: { id: 'c-week', classId: 'k-1', subject: 'arabic', year: '2026-2027', pack: null } },
  ];
  const { book } = await openTestData();
  await book.recordAll(parseDay('2026-09-13'), events);
  const state = book.state;
  expect(planGroups(state).map((group) => [group.key, group.classes.map((one) => one.id)])).toEqual([
    ['4ap/arabic', ['k-1']],
    ['4ap/math', ['k-1']],
    ['5ap/arabic', ['k-1']],
    ['5ap/math', ['k-1']],
  ]);
  const pin = { id: 'dz.primary.5ap.arabic.example', release: '2026.1' };
  const [fifth] = pinEvents(state, ['k-1'], 'arabic', '2026-2027', pin, newId, '5ap');
  expect(fifth).toMatchObject({ kind: 'course.set', course: { classId: 'k-1', grade: '5ap', pack: pin } });
  const [fourth] = pinEvents(state, ['k-1'], 'arabic', '2026-2027', null, newId, '4ap');
  expect(fourth).toMatchObject({ kind: 'course.set', course: { id: 'c-week', pack: null } });
  await book.record(parseDay('2026-09-14'), fifth);
  const pinned = book.state;
  expect(pinOfClass(pinned, 'k-1', 'arabic', '2026-2027', '5ap')).toEqual(pin);
  expect(pinOfClass(pinned, 'k-1', 'arabic', '2026-2027', '4ap')).toBeNull();
});

test('names each year of a joint class, and gives each its own row and pupils', async () => {
  const data = await openTestData();
  const pupil = (id: string, year: string): Pupil => ({
    id,
    classId: 'k-1',
    name: id,
    sex: 'm',
    groups: [year],
    movements: [],
  });
  await data.book.recordAll(parseDay('2026-09-13'), [
    { kind: 'school.set', school },
    { kind: 'class.set', schoolClass: joint },
    { kind: 'pupil.set', pupil: pupil('p-1', four.id) },
    { kind: 'pupil.set', pupil: pupil('p-2', five.id) },
    { kind: 'pupil.set', pupil: pupil('p-3', five.id) },
    {
      kind: 'course.set',
      course: { id: 'c-5', classId: 'k-1', subject: 'arabic', year: '2026-2027', pack: null, grade: '5ap' },
    },
    { kind: 'course.set', course: { id: 'c-4', classId: 'k-1', subject: 'arabic', year: '2026-2027', pack: null } },
  ]);
  const context = coreContext({ ...data, state: data.book.state });
  const rows = classRows(context, parseDay('2026-10-18'));
  expect(rows.map((row) => [row.course.id, row.grade, row.pupils])).toEqual([
    ['c-4', '4ap', 1],
    ['c-5', '5ap', 2],
  ]);
  const t = i18n.t.bind(i18n) as unknown as Parameters<typeof sessionMeta>[1];
  const item = {
    course: data.book.state.courses.get('c-5')!,
    session: { day: parseDay('2026-10-18'), slot: { half: 'morning', index: 1 }, groupId: 'g-all' },
  } as unknown as Parameters<typeof sessionMeta>[3];
  expect(sessionMeta({ ...data, state: data.book.state }, t, 'rtl', item, false).className).toBe('4-5 أ · 5 ابتدائي');
});
