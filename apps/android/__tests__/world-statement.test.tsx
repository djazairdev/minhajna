// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teacher's statement inside a demo world (#630, answer 725), against the
// jest server: a chip for each course, naming its class and pack, and the
// class's plan to say where it has reached; the statement's parts from what is
// said and the weeks signed, one course's weeks alone, by its name key and
// code; the next exams' term by grade; the statement signed and said, shown
// with its code, sized to its window; what is said dropped on another course,
// and what was signed on another reach; no timetable, no school's data and a
// class with no pack each said, with nothing to sign; a problem reading said
// with a way to read again; and the words in every language. Every pupil,
// school and world here is made up.

import { parseDay, weekday, type WeekRecord } from '@minhajna/core';
import { Dimensions } from 'react-native';
import {
  chipsOf,
  DAY,
  has,
  leavePage,
  lineOf,
  open,
  press,
  read,
  said,
  shown,
  statementWorld,
  texts,
  words,
} from '../jest/statement-world';
import { MINE, SUBJECTS } from '../jest/term-weeks';
import { BELLS, server } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import signature from '../src/native/NativeMinhajnaSignature';
import { courseStatement, nextExamsTerm, statementCourses } from '../src/school/world-statement-session';
import { QrCode } from '../src/settings/QrCode';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { readSignChannel } from '../src/week/week-sign-session';

test('the courses name their class and pack, and the weeks of the course alone count', async () => {
  const made = await statementWorld();
  const { parts } = await readSignChannel(made.world, made.joined, kit, server.send);
  const courses = statementCourses(parts, DAY, SUBJECTS, made.school, read.packs);
  const [named, unnamed] = courses;
  expect(named.room?.id).toBe(made.room.id);
  expect(named.pack?.id).toBe(made.room.packs[made.code].id);
  expect(named.sessionMinutes).toBe(60);
  expect([unnamed.room, unnamed.pack]).toEqual([null, null]);
  const one = {
    course: 'made-up',
    week: parseDay('2027-01-10'),
    version: 0,
    totals: { subject: named.code!, items: [], reached: 0, runsLong: false, covered: 0, closed: 0 },
    class: named.class,
    subject: named.subject,
    sessions: [{ day: 0, start: 480, end: 540, group: '', week: 'both', state: 'not-held' }],
  } as WeekRecord;
  const statement = (weeks: readonly WeekRecord[]) =>
    courseStatement({ school: made.school, course: named, reached: null, weeks, mine: MINE, bells: BELLS, day: DAY });
  expect(statement([one])?.notHeld.other).toBe(1);
  expect(statement([{ ...one, class: ` ${named.class.toLowerCase()} ` }])?.notHeld.other).toBe(1);
  expect(statement([{ ...one, subject: 'a name the timetable gave it before' }])?.notHeld.other).toBe(1);
  expect(statement([{ ...one, class: 'another' }])?.notHeld.other).toBe(0);
  const other = { ...one, totals: { ...one.totals, subject: 'another' } };
  expect(statement([other])?.notHeld.other).toBe(0);
  expect(
    courseStatement({
      school: made.school,
      course: unnamed,
      reached: null,
      weeks: [],
      mine: MINE,
      bells: BELLS,
      day: DAY,
    }),
  ).toBeNull();
  expect(nextExamsTerm(MINE, parseDay('2030-01-01'), '4am')).toBeUndefined();
  expect(nextExamsTerm(MINE, parseDay(MINE.calendar.year.from), made.room.grade)).toBe(1);
  const exam = (term: number, grade: string, from: string) =>
    ({ id: `e${term}`, effect: 'exam', layer: 'national', term, grades: [grade], from, to: from }) as never;
  const entries = [exam(2, '4am', '2027-03-01'), exam(3, '1am', '2027-05-01')];
  expect(nextExamsTerm({ ...MINE, calendar: { ...MINE.calendar, entries } }, DAY, '1am')).toBe(3);
  const late = MINE.calendar.year.terms.at(-1)!;
  expect(nextExamsTerm(MINE, late.to, 'no-such-grade')).toBe(late.number);
});

test('a week of the class’s exams is no loss and no delay', async () => {
  const made = await statementWorld();
  const { parts } = await readSignChannel(made.world, made.joined, kit, server.send);
  const [course] = statementCourses(parts, DAY, SUBJECTS, made.school, read.packs);
  const exams = MINE.calendar.entries.find((one) => one.effect === 'exam' && one.grades?.includes(made.room.grade));
  expect(exams).toBeDefined();
  const sessions = [{ day: weekday(exams!.from), start: 480, end: 540, group: '', week: 'both', state: 'not-held' }];
  const week = {
    course: 'made-up',
    week: exams!.from,
    version: 0,
    totals: { subject: course.code!, items: [], reached: 0, runsLong: false, covered: 0, closed: 0 },
    class: course.class,
    subject: course.subject,
    sessions,
  } as WeekRecord;
  const statement = courseStatement({
    school: made.school,
    course: course,
    reached: null,
    weeks: [week],
    mine: MINE,
    bells: BELLS,
    day: exams!.to,
  });
  expect(statement?.notHeld).toEqual({ calendar: 0, other: 0 });
  expect(statement?.delay.sessions).toBe(0);
});

test.each([
  [1000, 400, 6],
  [320, 800, 9],
])('the code fits a window of %i by %i', async (width, height, module) => {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height, scale: 1, fontScale: 1 });
  const made = await statementWorld();
  await open(made);
  await press('world-statement-sign');
  const code = shown().root.findAll((node) => node.type === QrCode)[0].props as { module: number };
  expect(code.module).toBe(module);
});

test('a chip already chosen keeps what is said and signed', async () => {
  const made = await statementWorld();
  await open(made);
  const pack = read.packs.find((one) => one.id === made.room.packs[made.code].id)!;
  const lesson = pack.items.find((one) => one.kind === 'lesson')!;
  await press(`world-statement-item-${lesson.id}`);
  await press('world-statement-sign');
  await press(`world-statement-item-${lesson.id}`);
  await press('world-statement-status-done');
  await press(chipsOf('world-statement-course-')[0]);
  expect(has('world-statement-made')).toBe(true);
  expect(has('world-statement-status-done')).toBe(true);
});

test('says where the class has reached, signs for the world, and shows the fields and code', async () => {
  const made = await statementWorld();
  await open(made);
  expect(texts()).toEqual(expect.arrayContaining([words.line, words.reached, words.nothing]));
  const pack = read.packs.find((one) => one.id === made.room.packs[made.code].id)!;
  const lesson = pack.items.find((one) => one.kind === 'lesson')!;
  expect(has(`world-statement-status-done`)).toBe(false);
  await press(`world-statement-item-${lesson.id}`);
  await press('world-statement-status-started');
  await press('world-statement-sign');
  expect(texts()).toEqual(expect.arrayContaining([words.signed, words.worldOnly]));
  expect(lineOf('resource')).toContain(lesson.title);
  expect(said()).toBe(words.signed);
  expect(has('world-statement-qr')).toBe(true);
  const { rows } = await signature.qrMatrix('a made-up text');
  expect(rows.length).toBeGreaterThan(8);
  const code = shown().root.findAll((node) => node.type === QrCode)[0].props as { rows: string; module: number };
  expect(code.rows.split('\n')).toHaveLength(rows.length - 8);
  expect(code.rows.split('\n')[0]).toHaveLength(rows.length - 8);
  expect(code.module).toBe(Math.floor(640 / rows.length));
  await press('world-statement-status-done');
  expect(has('world-statement-made')).toBe(false);
  await press('world-statement-sign');
  expect(has('world-statement-made')).toBe(true);
});

test('another course drops what was said and signed, and one with no class or pack says so', async () => {
  const made = await statementWorld();
  await open(made);
  const pack = read.packs.find((one) => one.id === made.room.packs[made.code].id)!;
  const lesson = pack.items.find((one) => one.kind === 'lesson')!;
  await press(`world-statement-item-${lesson.id}`);
  await press('world-statement-sign');
  expect(has('world-statement-made')).toBe(true);
  const chips = chipsOf('world-statement-course-');
  expect(chips).toHaveLength(2);
  await press(chips[1]);
  expect(has('world-statement-made')).toBe(false);
  expect(texts()).toContain(words.noPack);
  expect(has('world-statement-sign')).toBe(false);
  await press(chips[0]);
  expect(has('world-statement-sign')).toBe(true);
  expect(has('world-statement-status-done')).toBe(false);
});

test('with no timetable or no school’s data, says so and signs nothing', async () => {
  await open(await statementWorld(DAY, false));
  expect(texts()).toContain(words.noTimetable);
  expect(has('world-statement-sign')).toBe(false);
  await leavePage();
  await open(await statementWorld(), { mine: undefined });
  expect(texts()).toContain(words.noData);
  expect(has('world-statement-sign')).toBe(false);
  await leavePage();
  await open(await statementWorld(), { school: null });
  expect(texts()).toContain(words.noData);
});

test('a problem reading says so, with a way to read again', async () => {
  const made = await statementWorld();
  let fail = true;
  const send: Send = (request) => (fail ? Promise.reject(new Error('Made-up offline')) : server.send(request));
  await open(made, { send });
  expect(has('world-statement-again')).toBe(true);
  fail = false;
  await press('world-statement-again');
  expect(has('world-statement-again')).toBe(false);
});

test('its words read in every language', () => {
  for (const catalogue of [ar, en, fr]) {
    const { steps, open: way, sign, file, line } = catalogue.demo.statement;
    expect([way, sign, file, line, steps.reading, steps.signing, steps.filing].every((one) => one.length > 0)).toBe(
      true,
    );
    expect(catalogue.demo.statement.pc.tooBig.length).toBeGreaterThan(0);
  }
});
