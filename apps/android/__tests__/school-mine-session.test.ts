// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What School-mine reads of the bundled calendar and bells (#584, answer 612):
// with bells running the morning to one o'clock, a session from noon is the
// morning's, taken by a morning closure and not an afternoon one; without the
// school's bells the level's template splits the day, and without either noon
// does, while bells with no afternoon leave every session in the morning; a
// holiday and an exam window take a session and a plain school day nothing, an
// entry naming grades only of a class of those grades, every exam of the
// country's calendar being one; an inspector reads the directorate's classes by
// their schools' levels; a class is placed by its name key and an unknown one
// is not; and the term holds its own days only, the standing part never a part
// for one day. Every closure and exam is made up.

import {
  parseDay,
  type CalendarEntry,
  type Day,
  type DemoLevel,
  type TimetablePart,
  type WeekSession,
} from '@minhajna/core';
import { bundledReference, readReference } from '../src/reference';
import {
  afternoonFrom,
  deliveryReading,
  directorateRooms,
  mineOf,
  standingOn,
  termOn,
  type MineCalendar,
} from '../src/week/school-mine-session';

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const DAY = parseDay('2027-01-05');
const entry = (id: string, effect: CalendarEntry['effect'], half?: 'morning' | 'afternoon'): CalendarEntry => ({
  id,
  layer: 'national',
  from: DAY,
  to: DAY,
  effect,
  name: { en: id },
  source: 'Made-up calendar',
  confidence: 'announced',
  ...(half === undefined ? {} : { half }),
});
const mine = (...entries: CalendarEntry[]): MineCalendar => ({
  ...read,
  calendar: { ...read.calendar, entries: [...read.calendar.entries, ...entries] },
  level: 'cem',
});
const hours = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, at) => [(from + at) * 60, (from + at + 1) * 60] as const);
const DAYLONG: TimetablePart['bells'] = [...hours(8, 13), ...hours(13, 17)];
const at = (start: number) =>
  ({ day: 2, start, end: start + 60, group: '', week: 'both', state: 'not-held' }) as WeekSession;
const taken = (reading: ReturnType<typeof deliveryReading>, day: Day, start: number) =>
  reading.takenBy(day, at(start), '4AM1')?.id ?? null;

test('a session from noon to one is the morning’s when the bells run the morning to one', () => {
  expect(afternoonFrom(mine(), DAYLONG)).toBe(13 * 60);
  const morning = deliveryReading(mine(entry('made-up-morning', 'closure', 'morning')), [], DAYLONG);
  expect([taken(morning, DAY, 12 * 60), taken(morning, DAY, 13 * 60)]).toEqual(['made-up-morning', null]);
  const afternoon = deliveryReading(mine(entry('made-up-afternoon', 'closure', 'afternoon')), [], DAYLONG);
  expect([taken(afternoon, DAY, 12 * 60), taken(afternoon, DAY, 13 * 60)]).toEqual([null, 'made-up-afternoon']);
});

test('without the school’s bells the level’s template splits the day, and without either, noon', () => {
  expect(afternoonFrom(mine(), [])).toBe(13 * 60);
  expect(afternoonFrom({ ...mine(), bells: undefined }, [])).toBe(12 * 60);
  expect(afternoonFrom(mine(), [[480, 540]] as TimetablePart['bells'])).toBe(Infinity);
});

test('a holiday and an exam window take a session, and a school day with neither none', () => {
  const reading = deliveryReading(mine(entry('made-up-exam', 'exam')), [], DAYLONG);
  expect([taken(reading, DAY, 480), taken(reading, parseDay('2027-01-12'), 480)]).toEqual(['made-up-exam', 'yennayer']);
  expect(taken(deliveryReading(mine(), [], DAYLONG), DAY, 480)).toBeNull();
});

test('an entry naming grades takes a session only of a class of those grades, and of no class it cannot place', () => {
  const exam: CalendarEntry = { ...entry('made-up-4am-exam', 'exam'), grades: ['4am'], term: 2 };
  const rooms = [
    { name: '4AM1', grade: '4am' },
    { name: '1AM1', grade: '1am' },
  ];
  const { takenBy } = deliveryReading({ ...mine(exam), rooms }, [], DAYLONG);
  const take = (name: string) => takenBy(DAY, at(480), name)?.id ?? null;
  expect([take('4AM1'), take(' 4am1 '), take('1AM1'), take('9AM9')]).toEqual([
    'made-up-4am-exam',
    'made-up-4am-exam',
    null,
    null,
  ]);
  expect(deliveryReading(mine(exam), [], DAYLONG).takenBy(DAY, at(480), '4AM1')).toBeNull();
});

test('every exam the country’s calendar holds names grades, and takes a session of each on its first day', () => {
  const exams = read.calendar.entries.filter((one) => one.effect === 'exam');
  expect(exams.length).toBeGreaterThan(0);
  for (const exam of exams) {
    const rooms = (exam.grades ?? []).map((grade) => ({ name: `${grade}-made-up`, grade }));
    expect(rooms.length).toBeGreaterThan(0);
    const { takenBy } = deliveryReading(mineOf(read, read.calendar, { level: 'cem', classes: rooms }), [], []);
    for (const room of rooms) expect(takenBy(exam.from, at(8 * 60), room.name)?.effect).toBe('exam');
  }
});

test('an inspector reads only the directorate’s classes, each by its own school’s level', () => {
  const closed: CalendarEntry = { ...entry('made-up-lycee-closure', 'closure'), levels: ['lycee'] };
  const school = (directorateId: string, level: DemoLevel, name: string, grade: string) => ({
    directorateId,
    level,
    classes: [{ name, grade }],
  });
  const schools = [
    school('d1', 'cem', '4AM1', '4am'),
    school('d1', 'lycee', '1AS1', '1as'),
    school('d2', 'lycee', '2AS1', '2as'),
  ];
  const rooms = directorateRooms(schools, 'd1');
  expect(rooms).toEqual([
    { name: '4AM1', grade: '4am', level: 'cem' },
    { name: '1AS1', grade: '1as', level: 'lycee' },
  ]);
  const { takenBy } = deliveryReading({ ...mine(closed), rooms }, [], DAYLONG);
  expect([takenBy(DAY, at(480), '1AS1')?.id, takenBy(DAY, at(480), '4AM1')?.id]).toEqual([closed.id, undefined]);
});

test('a class is placed by its name key, with spaces around it, and an unknown class is not', () => {
  const { classOrder } = deliveryReading(mine(), ['1م2', '1م3'], DAYLONG);
  expect([classOrder?.(' 1م3 '), classOrder?.('1م2'), classOrder?.('2م1')]).toEqual([1, 0, undefined]);
});

test('the term holds its own days only, and the standing part is never a part for one day', () => {
  const { year } = read.calendar;
  expect([termOn(year, DAY)?.number, termOn(year, parseDay('2026-12-24'))]).toEqual([2, null]);
  const part = (from: string, once: boolean) => ({ part: { from: parseDay(from), once } }) as never;
  const standing = part('2026-12-20', false);
  expect(standingOn([standing, part('2027-01-05', true)], DAY)).toBe(standing);
  expect(standingOn([part('2027-01-06', false)], DAY)).toBeNull();
});
