// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Joining my school (answer 808): the code as typed goes alone to the
// directory, what arrives shows first and the approval records it once with
// the code kept in the device layer; a code that cannot be one is not sent;
// another school than the one chosen, a new school and a school no longer
// listed are said before going on, and the records land where they said;
// classes the teacher entered at the school are said to stay.
// Every school, class and pupil is made up.

import { joiningCodes, parseDay, type TeacherDelivery } from '@minhajna/core';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { MADE_UP_CODE, MADE_UP_DELIVERY, serveJoin } from '../jest/directory-join';
import {
  CHOSEN,
  closeJoin,
  joinRoot,
  onDone,
  press,
  showJoin,
  shown,
  typeCode,
  withId,
  withSchools,
} from '../jest/join-screen';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

afterEach(async () => {
  await closeJoin();
  jest.restoreAllMocks();
});

const unlisted: TeacherDelivery = { ...MADE_UP_DELIVERY, school: null };
const keptCodes = (data: TestData) =>
  data.book.entries.filter((entry) => JSON.stringify(entry).includes('directory.joined')).length;

async function joinWith(data: TestData) {
  await showJoin(data);
  await typeCode(MADE_UP_CODE);
  await press('join-next');
}

test('sends only the code as read, shows what arrives, and records it once with the code kept', async () => {
  const join = serveJoin();
  const data = await withSchools(CHOSEN);
  await showJoin(data);
  await typeCode(' 7k2m-9q4r x8zt-3hn6 ');
  await press('join-next');
  expect(join).toHaveBeenCalledTimes(1);
  expect(join.mock.calls[0].slice(0, 3)).toEqual(['/directory/join', { code: '7K2M9Q4RX8ZT3HN6' }, undefined]);
  const rows = ['\u20681م1\u2069 · تلميذان', '\u20681م2\u2069 · تلميذ واحد'];
  expect(shown()).toEqual(expect.arrayContaining(['متوسطة النجاح', ...rows]));
  expect(withId('join-other')).toEqual([]);
  expect(data.book.state.classes.size).toBe(0);
  expect(accessibilityProblems(joinRoot())).toEqual([]);
  await press('join-approve');
  await press('join-approve');
  expect(onDone).toHaveBeenCalledTimes(1);
  expect([...data.book.state.classes.values()].map((one) => one.name)).toEqual(['1م1', '1م2']);
  expect(data.book.state.pupils.size).toBe(3);
  expect(data.book.state.timetables.at(-1)?.version.source).toBe('package');
  expect([...joiningCodes(data.book.entries)]).toEqual([['s-1', '7K2M9Q4RX8ZT3HN6']]);
  expect(keptCodes(data)).toBe(1);
});

test('does not send what cannot be a joining code, and clears the problem on typing', async () => {
  const join = serveJoin();
  await showJoin(await withSchools(CHOSEN));
  await typeCode('1234');
  await press('join-next');
  expect(join).not.toHaveBeenCalled();
  expect(withId('join-code')[0].props.error).toBe(text.join.badCode);
  await typeCode('12345');
  expect(withId('join-code')[0].props.error).toBeUndefined();
});

test('names another school than the one chosen, and records into the chosen one', async () => {
  serveJoin();
  const data = await withSchools({ ...CHOSEN, code: 'cem-16-2', name: 'متوسطة الفجر' });
  await joinWith(data);
  expect(withId('join-other')).toHaveLength(1);
  expect(shown()).toContain('الانضمام إلى \u2068متوسطة النجاح\u2069');
  await press('join-approve');
  expect(data.book.state.schools.get('s-1')?.code).toBe('cem-16-1');
  expect(new Set([...data.book.state.classes.values()].map((one) => one.schoolId))).toEqual(new Set(['s-1']));
});

test('says a school the phone adds, and adds it', async () => {
  serveJoin();
  const data = await withSchools();
  await joinWith(data);
  expect(withId('join-new')).toHaveLength(1);
  expect(shown()).toContain(text.join.approve);
  await press('join-approve');
  const [school] = [...data.book.state.schools.values()];
  expect([school?.name, school?.code, data.book.state.classes.size]).toEqual(['متوسطة النجاح', 'cem-16-1', 2]);
});

test('says when the school is no longer listed, and fills the phone’s only school', async () => {
  serveJoin(unlisted);
  const data = await withSchools(CHOSEN);
  await joinWith(data);
  expect(withId('join-unlisted')).toHaveLength(1);
  expect(shown()).toContain(CHOSEN.name);
  await press('join-approve');
  expect(data.book.state.classes.size).toBe(2);
});

test('offers only to leave when no single school can take an unlisted school’s delivery', async () => {
  serveJoin(unlisted);
  await joinWith(await withSchools());
  expect(withId('join-unplaced')).toHaveLength(1);
  expect(withId('join-approve')).toEqual([]);
  expect(accessibilityProblems(joinRoot())).toEqual([]);
  await press('join-cancel');
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('joins a school named from Settings that has no code kept yet, showing every class', async () => {
  serveJoin();
  const named = { ...CHOSEN, id: 's-2', code: 'cem-16-9', name: 'متوسطة الأمل' };
  const data = await withSchools({ ...CHOSEN, code: 'cem-16-5' }, named);
  await showJoin(data, 's-2');
  expect(withId('join-code')).toHaveLength(1);
  await typeCode(MADE_UP_CODE);
  await press('join-next');
  expect(withId('join-other')).toHaveLength(1);
  expect(shown()).toEqual(expect.arrayContaining(['\u20681م1\u2069 · تلميذان']));
  await press('join-approve');
  expect([...joiningCodes(data.book.entries)]).toEqual([['s-2', '7K2M9Q4RX8ZT3HN6']]);
});

test('says the classes the teacher entered at the school stay beside the school’s', async () => {
  serveJoin();
  const data = await withSchools(CHOSEN);
  const groups = [{ id: 'k1.w', kind: 'whole' as const, name: '1م9' }];
  const schoolClass = { id: 'k1', schoolId: 's-1', level: 'cem', grade: '1am', name: '1م9', groups };
  await data.book.record(parseDay('2026-10-02'), { kind: 'class.set', schoolClass });
  await showJoin(data, 's-1');
  await typeCode(MADE_UP_CODE);
  await press('join-next');
  expect(withId('join-hand-made')).toHaveLength(1);
  expect(accessibilityProblems(joinRoot())).toEqual([]);
});

test('says when the code belongs to another school on the phone than the one named, and records there', async () => {
  serveJoin();
  const data = await withSchools(CHOSEN, { ...CHOSEN, id: 's-2', code: 'cem-16-9', name: 'متوسطة الأمل' });
  await showJoin(data, 's-2');
  await typeCode(MADE_UP_CODE);
  await press('join-next');
  expect(withId('join-elsewhere')).toHaveLength(1);
  expect(shown()).toContain('الانضمام إلى \u2068متوسطة النجاح\u2069');
  await press('join-approve');
  expect(new Set([...data.book.state.classes.values()].map((one) => one.schoolId))).toEqual(new Set(['s-1']));
});
