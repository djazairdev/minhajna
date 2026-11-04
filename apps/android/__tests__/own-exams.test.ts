// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The directorate's and national exams on a teacher's phone (#601, answer 633),
// on a seeded school's term filled as the starter fills it: a teacher who
// signed weeks of a last-grade class sees the mock exam and the BEM, each with
// that class alone, at the position and forecast the school's chart would give
// it from the same weeks, taken on the day before the world's date before the
// figures day and on the figures day from then on; an exam past its last day is
// gone; a class pinning another pack than the rest of its grade is left out, as
// from the school's chart; the school's exams before their figures day are
// listed too, and gone on it; and a teacher whose classes sit neither exam
// above the school sees none of those. Every world, school and teacher is made
// up.

import { addDays, directorSchool, seedNationalWorld, worldExams, type WeekRecord } from '@minhajna/core';
import { FakeStorage } from '../jest/fake-storage';
import { calendar, reference } from '../jest/world-calendar';
import { DemoServer, nodeKit } from '../jest/world-server';
import { startSeededWorld } from '../src/demo/world-seed';
import { holdSchool } from '../src/director/issue-session';
import { recordsOf } from '../src/director/records-session';
import { fillSeededTerm } from '../src/director/seeded-fill';
import { seededKeyOf, takeSeededKey } from '../src/director/seeded-key';
import { leaveWorldNetwork } from '../src/network/world-network';
import { openRecordBook } from '../src/storage/history';
import { chartDrafts } from '../src/threshold/exam-charts';
import { overExams, ownExams } from '../src/threshold/own-exams';

/** The exams above the school the phone works out. */
const aboveOf = (...args: Parameters<typeof ownExams>) =>
  ownExams(...args).filter((one) => one.exam.setBy !== 'school');

const server = new DemoServer();

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

/** The seeded school's term filled, and the weeks 4AM1's Arabic teacher signed, in some classes or all. */
async function filled(classes?: readonly string[]) {
  const started = await startSeededWorld('national', calendar, reference, nodeKit, server.send);
  const id = started.keys.world;
  const { zones = [], workingDays } = reference.profile;
  const school = directorSchool(seedNationalWorld(id, zones, workingDays, reference.packs))!;
  const held = { world: id, keys: started.keys, sealing: started.sealing };
  const director = { world: id, date: started.date, book: await openRecordBook(new FakeStorage().asSpec()) };
  await takeSeededKey(director, held, school, nodeKit, server.send);
  const desk = await holdSchool(director, nodeKit, server.send, false);
  const seeded = (await seededKeyOf(held, school.id, nodeKit, server.send))!;
  await fillSeededTerm(director, desk, seeded, reference, nodeKit, server.send);
  const records = await recordsOf(director, desk, school, nodeKit, server.send);
  const teacher = records.find((one) => one.class === '4AM1')!.courses.find((one) => one.subject === 'arabic')!.teacher;
  const weeks: WeekRecord[] = records
    .filter((one) => classes === undefined || classes.includes(one.class))
    .flatMap((one) => one.courses.filter((course) => course.teacher === teacher))
    .flatMap((course) => course.weeks.map((one) => one.week));
  return { date: started.date, school, records, weeks };
}

test('a last grade’s teacher sees the mock exam and the BEM, their class as the school’s chart gives it', async () => {
  const { date, school, records, weeks } = await filled();
  const exams = aboveOf(weeks, school, reference, date);
  expect(exams.map((one) => [one.exam.id, one.asOf])).toEqual([
    ['mock', addDays(date, -1)],
    ['bem', addDays(date, -1)],
  ]);
  for (const { exam, asOf, charts } of exams) {
    expect(charts.map((one) => [one.subject, one.grade, one.classes.map((each) => each.name)])).toEqual([
      ['arabic', '4am', ['4AM1']],
    ]);
    const school4 = chartDrafts(exam, school, records, reference, asOf).find((one) => one.chart.subject === 'arabic')!;
    expect(charts[0].classes[0]).toEqual(school4.chart.classes.find((one) => one.name === '4AM1'));
    expect(charts[0].classes[0].position).not.toBeNull();
  }
}, 120_000);

test('takes positions on the figures day once it has passed, and leaves an exam past its last day', async () => {
  const { school, weeks } = await filled();
  const [mock, bem] = worldExams(calendar.year, calendar.entries).filter((one) => one.setBy !== 'school');
  expect(aboveOf(weeks, school, reference, mock.figuresDay)[0].asOf).toBe(mock.figuresDay);
  const during = aboveOf(weeks, school, reference, mock.to);
  expect(during.map((one) => [one.exam.id, one.asOf])).toEqual([
    ['mock', mock.figuresDay],
    ['bem', addDays(mock.to, -1)],
  ]);
  expect(aboveOf(weeks, school, reference, addDays(mock.to, 1)).map((one) => one.exam.id)).toEqual([bem.id]);
}, 120_000);

test('leaves out a class pinning another pack than the rest of its grade', async () => {
  const { date, school, weeks } = await filled();
  const other = { id: 'made-up-pack', release: '1' };
  const classes = school.classes.map((one) =>
    one.name === '4AM1' ? { ...one, packs: { ...one.packs, arabic: other } } : one,
  );
  expect(aboveOf(weeks, { ...school, classes }, reference, date)).toEqual([]);
}, 120_000);

test('lists the school’s exams before their figures day, gone on it', async () => {
  const { date, school, weeks } = await filled();
  const school2 = worldExams(calendar.year, calendar.entries).find(
    (one) => one.setBy === 'school' && one.figuresDay > date && one.grades.includes('4am'),
  )!;
  const coming = ownExams(weeks, school, reference, date).find((one) => one.exam.id === school2.id)!;
  expect([coming.asOf, coming.charts.map((one) => one.classes.map((each) => each.name))]).toEqual([
    addDays(date, -1),
    expect.arrayContaining([['4AM1']]),
  ]);
  const on = ownExams(weeks, school, reference, school2.figuresDay).map((one) => one.exam.id);
  expect(on).not.toContain(school2.id);
}, 120_000);

test('an exam above the school moves to the over list the day after its last day, the teacher’s classes in it', async () => {
  const { school, weeks } = await filled();
  const mock = worldExams(reference.calendar.year, reference.calendar.entries).find((one) => one.id === 'mock')!;
  expect(overExams(weeks, school, reference, mock.to).map((one) => one.exam.id)).toEqual([]);
  const after = addDays(mock.to, 1);
  const over = overExams(weeks, school, reference, after).filter((one) => one.exam.id === 'mock');
  expect(over.map((one) => [one.asOf, one.charts.map((chart) => [chart.subject, chart.grade])])).toEqual([
    [mock.figuresDay, [['arabic', '4am']]],
  ]);
  expect(over[0].charts[0].classes.map((one) => one.name)).toEqual(['4AM1']);
  expect(overExams(weeks, school, reference, after).every((one) => one.exam.setBy !== 'school')).toBe(true);
  expect(aboveOf(weeks, school, reference, after).map((one) => one.exam.id)).not.toContain('mock');
}, 120_000);

test('a teacher whose classes sit neither exam above the school sees none of those', async () => {
  const { date, school, weeks } = await filled(['1AM1']);
  expect(weeks.length).toBeGreaterThan(0);
  expect(aboveOf(weeks, school, reference, date)).toEqual([]);
}, 120_000);
