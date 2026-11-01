// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's operational view (#569, answer 591), on a seeded national
// world: the director's school is the world's first CEM; its rows come in the
// school's order, each class then each subject as its week gives it, with the
// teacher its sessions name, a row for each of two, or none for a vacant post,
// which stands as vacant; a teacher who has not joined is not joined during the
// trial term end and to join after it, and their class has no standing,
// whatever the space would give, while a joined teacher's class may have none
// yet; a level, a teacher and the classes behind their plan are filters that
// keep the order, and a class is behind when its latest week runs long; a
// class's week is its timetable; the grades come in the school's order; and
// each teacher's weekly sessions come from the timetable, in the staff's order,
// with the cover they gave. Every school, class and person is made up.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  classWeek,
  courseBehind,
  dashboardCourses,
  directorSchool,
  parseCountryProfile,
  parsePlanPack,
  schoolGrades,
  seedNationalWorld,
  shownCourses,
  teacherLoads,
  type CourseStanding,
  type Day,
  type TrialTerm,
  type PlanPack,
} from '../src/index.ts';

const data = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../data/dz/${path}`, import.meta.url), 'utf8'));
const profile = parseCountryProfile(data('profile.json'));
assert.ok(profile.ok);
const packs: PlanPack[] = readdirSync(new URL('../../../data/dz/packs/', import.meta.url)).map((file) => {
  const read = parsePlanPack(data(`packs/${file}`));
  assert.ok(read.ok);
  return read.value;
});
const world = seedNationalWorld('ABCDE', profile.value.zones ?? [], profile.value.workingDays, packs);
const school = directorSchool(world)!;
const trial: TrialTerm = { from: '2026-11-29' as Day, to: '2026-12-24' as Day, term: 1, year: '2026-2027' };
const during = { trial, date: '2026-12-01' as Day };
const after = { trial, date: '2027-01-10' as Day };

/** A class's standing, running long or not. */
const standing = (runsLong: boolean): CourseStanding => ({
  position: null,
  reached: 420,
  runsLong,
  notHeld: { closure: 0, other: 1 },
  awaiting: 2,
});

test('the director’s school is the world’s first CEM, or none', () => {
  assert.equal(school.level, 'cem');
  assert.equal(
    school,
    world.schools.find((one) => one.level === 'cem'),
  );
  assert.equal(directorSchool({ ...world, schools: world.schools.filter((one) => one.level !== 'cem') }), null);
});

test('rows come in the school’s order, with each class’s teacher, and no standing before joining', () => {
  const rows = dashboardCourses(
    school,
    during,
    (teacher) => teacher === school.teachers[0]!.id,
    () => standing(false),
  );
  assert.deepEqual(
    rows.slice(0, 4).map((row) => [row.className, row.subject]),
    [
      [school.classes[0]!.name, 'arabic'],
      [school.classes[0]!.name, 'math'],
      [school.classes[0]!.name, 'french'],
      [school.classes[1]!.name, 'arabic'],
    ],
  );
  assert.equal(rows.length, school.classes.length * 3);
  for (const row of rows) {
    assert.ok(row.teacher!.classIds.includes(row.classId) && row.teacher!.subject === row.subject);
    assert.equal(row.space, row.teacher!.id === school.teachers[0]!.id ? 'joined' : 'not-joined');
    assert.equal(row.standing === null, row.space !== 'joined');
  }
  const later = dashboardCourses(
    school,
    after,
    () => false,
    () => standing(false),
  );
  assert.ok(later.every((row) => row.space === 'to-join' && row.standing === null));
  const empty = dashboardCourses(
    school,
    during,
    () => true,
    () => null,
  );
  assert.ok(empty.every((row) => row.space === 'joined' && row.standing === null));
});

test('a vacant post keeps its row, with no teacher, and a class’s week is its timetable', () => {
  const gone = school.teachers[0]!;
  const vacant = { ...school, teachers: school.teachers.slice(1) };
  const rows = dashboardCourses(
    vacant,
    during,
    () => true,
    () => standing(false),
  );
  assert.equal(rows.length, school.classes.length * 3);
  const empty = rows.filter((row) => row.teacher === null);
  assert.deepEqual(
    empty.map((row) => [row.classId, row.subject, row.space, row.standing]),
    gone.classIds.map((classId) => [classId, gone.subject, 'vacant', null]),
  );
  const one = school.classes[0]!.id;
  const helper = school.teachers.find((who) => who.subject === 'math' && !who.classIds.includes(one))!;
  let moved = false;
  const shared = {
    ...school,
    week: school.week.map((session) => {
      if (moved || session.classId !== one || session.subject !== 'math') return session;
      moved = true;
      return { ...session, teacherId: helper.id };
    }),
  };
  const split = dashboardCourses(
    shared,
    during,
    () => false,
    () => null,
  ).filter((row) => row.classId === one);
  assert.deepEqual(
    split.map((row) => [row.subject, row.teacher!.id]),
    [
      ['arabic', split[0]!.teacher!.id],
      ['math', helper.id],
      ['math', school.teachers.find((who) => who.subject === 'math' && who.classIds.includes(one))!.id],
      ['french', split[3]!.teacher!.id],
    ],
  );
  const week = classWeek(school, school.classes[0]!.id);
  assert.equal(week.length, 13);
  assert.ok(week.every((session) => session.classId === school.classes[0]!.id));
});

test('a level and the classes behind are filters that keep the order', () => {
  const late = new Set([school.classes[3]!.id, school.classes[0]!.id]);
  const rows = dashboardCourses(
    school,
    during,
    () => true,
    (classId, subject) => standing(late.has(classId) && subject === 'math'),
  );
  assert.deepEqual(rows.slice(0, 2).map(courseBehind), [false, true]);
  assert.deepEqual(schoolGrades(school), ['1am', '4am']);
  assert.deepEqual(
    shownCourses(rows, { grade: null, teacherId: null, behindOnly: true }).map((row) => [row.classId, row.subject]),
    [
      [school.classes[0]!.id, 'math'],
      [school.classes[3]!.id, 'math'],
    ],
  );
  const fourth = shownCourses(rows, { grade: '4am', teacherId: null, behindOnly: false });
  assert.deepEqual(
    fourth,
    rows.filter((row) => row.grade === '4am'),
  );
  assert.equal(fourth.length, 9);
  const own = school.teachers[2]!;
  assert.deepEqual(
    shownCourses(rows, { grade: null, teacherId: own.id, behindOnly: false }).map((row) => row.classId),
    own.classIds,
  );
  const notJoined = dashboardCourses(
    school,
    during,
    () => false,
    () => standing(true),
  );
  assert.deepEqual(shownCourses(notJoined, { grade: null, teacherId: null, behindOnly: true }), []);
});

test('each teacher’s weekly sessions come from the timetable, in the staff’s order, with their cover', () => {
  const loads = teacherLoads(school, (teacher) => (teacher === school.teachers[1]!.id ? 2 : 0));
  assert.deepEqual(
    loads.map((one) => one.teacher.id),
    school.teachers.map((one) => one.id),
  );
  assert.equal(
    loads.reduce((sum, one) => sum + one.sessions, 0),
    school.week.length,
  );
  assert.deepEqual(
    loads.map((one) => one.sessions),
    school.teachers.map((one) => one.classIds.length * (one.subject === 'arabic' ? 5 : 4)),
  );
  assert.deepEqual(
    loads.map((one) => one.cover),
    school.teachers.map((_, index) => (index === 1 ? 2 : 0)),
  );
});
