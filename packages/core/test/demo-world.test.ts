// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A seeded national demo world (#547, answer 579), from the bundled reference
// data: the same seed gives the same world, pinned by its first names and IDs,
// and another seed other names; a directorate for each of the twelve wilayas,
// and six schools in each, with their staff, classes, pupils and teachers;
// every wilaya's figures by subject pass both the directorate's floor and the
// wilaya's, at the CEMs alone and at every level; no class and no teacher is in
// two places at once, with five or six working days, and each class has its
// sessions of each subject, a CEM or lycée class two or three a day; classes
// pin the pack the app offers first; IDs and registration numbers never repeat
// in a world, nor do names; staff are half women and half men; and a short week
// is refused.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseCountryProfile, parsePlanPack, seedNationalWorld, type DemoWorld, type PlanPack } from '../src/index.ts';

const data = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../data/dz/${path}`, import.meta.url), 'utf8'));
const profile = parseCountryProfile(data('profile.json'));
assert.ok(profile.ok);
const packs: PlanPack[] = readdirSync(new URL('../../../data/dz/packs/', import.meta.url)).map((file) => {
  const read = parsePlanPack(data(`packs/${file}`));
  assert.ok(read.ok);
  return read.value;
});
const zones = profile.value.zones ?? [];
const days = profile.value.workingDays;
const world = seedNationalWorld('ABCDE', zones, days, packs);
const people = (one: DemoWorld) => one.schools.flatMap((s) => [s.director, s.deputy, s.preparer, ...s.teachers]);

test('the same seed gives the same world, pinned by its first names and IDs, and another seed others', () => {
  assert.deepEqual(seedNationalWorld('ABCDE', zones, days, packs), world);
  const first = world.schools[0]!;
  assert.deepEqual(
    [world.directorates[0]!.id, first.id, first.classes[0]!.id, first.classes[0]!.pupils[0]!.id],
    ['directorate-1', 'school-2', 'class-3', 'pupil-4'],
  );
  assert.deepEqual(
    [first.name, first.teachers[0]!.name, first.director.name],
    ['مدرسة الإخلاص القديمة', 'قاسمي زهية', 'بلقاسمي صبرينة'],
  );
  const other = seedNationalWorld('FGHJK', zones, days, packs);
  assert.notDeepEqual(
    other.schools.map((one) => one.name),
    world.schools.map((one) => one.name),
  );
});

test('a directorate for each of twelve wilayas, and six schools in each with staff, classes and teachers', () => {
  assert.equal(world.directorates.length, 12);
  for (const { id, wilaya } of world.directorates) {
    const here = world.schools.filter((one) => one.wilaya === wilaya.code);
    assert.ok(here.every((one) => one.directorateId === id));
    assert.deepEqual(
      here.map((one) => one.level),
      ['primary', 'cem', 'cem', 'cem', 'cem', 'lycee'],
    );
    assert.equal(
      here.reduce((sum, one) => sum + one.teachers.length, 0),
      41,
    );
  }
  const name = (school: DemoWorld['schools'][number], classId: string) =>
    school.classes.find((one) => one.id === classId)!.name;
  for (const school of world.schools) {
    for (const one of school.classes) assert.equal(one.pupils.length, 45);
    const taught = school.teachers.map((teacher) => teacher.classIds.map((classId) => name(school, classId)));
    if (school.level === 'primary') assert.deepEqual(taught, [['5AP1'], ['5AP2']]);
    if (school.level === 'lycee')
      assert.deepEqual(
        taught,
        Array.from({ length: 3 }, () => ['1AS1', '1AS2']),
      );
    if (school.level === 'cem')
      assert.deepEqual(
        taught,
        Array.from({ length: 3 }, () => [
          ['1AM1', '4AM1'],
          ['1AM2', '4AM2'],
          ['1AM3', '4AM3'],
        ]).flat(),
      );
  }
});

test('every wilaya’s figures by subject pass the directorate’s floor and the wilaya’s', () => {
  for (const { wilaya } of world.directorates)
    for (const subject of ['arabic', 'math', 'french'])
      for (const levels of [['cem'], ['primary', 'cem', 'lycee']]) {
        const schools = world.schools.filter((one) => one.wilaya === wilaya.code && levels.includes(one.level));
        const teaching = schools.filter((one) => one.teachers.some((teacher) => teacher.subject === subject));
        const teachers = schools.flatMap((one) => one.teachers).filter((teacher) => teacher.subject === subject);
        assert.ok(teachers.length >= 10 && teaching.length >= 3, `${wilaya.code} ${subject} ${levels.join()}`);
      }
});

test('no class and no teacher is in two places at once, and each class has its sessions', () => {
  for (const week of [days, [0, 1, 2, 3, 4, 6] as const])
    for (const school of seedNationalWorld('ABCDE', zones, week, packs).schools) {
      const at = (who: string, one: { weekday: number; slot: { index: number } }) =>
        `${who}@${one.weekday}/${one.slot.index}`;
      assert.equal(new Set(school.week.map((one) => at(one.classId, one))).size, school.week.length);
      assert.equal(new Set(school.week.map((one) => at(one.teacherId, one))).size, school.week.length);
      for (const one of school.classes) {
        const mine = school.week.filter((session) => session.classId === one.id);
        const count = (subject: string) => mine.filter((session) => session.subject === subject).length;
        if (school.level === 'primary') assert.equal(count('arabic'), 5);
        else assert.deepEqual([count('arabic'), count('math'), count('french')], [5, 4, 4]);
        if (school.level !== 'primary' && week.length === 5)
          for (const day of week) assert.ok([2, 3].includes(mine.filter((session) => session.weekday === day).length));
      }
      for (const session of school.week) {
        assert.ok((week as readonly number[]).includes(session.weekday) && session.slot.half === 'morning');
        const teacher = school.teachers.find((one) => one.id === session.teacherId)!;
        assert.ok(teacher.subject === session.subject && teacher.classIds.includes(session.classId));
      }
    }
});

test('classes pin the pack the app offers first, at its latest release, and others none', () => {
  const cem = world.schools.find((one) => one.level === 'cem')!;
  const [first, , , fourth] = cem.classes;
  assert.deepEqual(first!.packs, { math: { id: 'dz.cem.1am.math.example', release: '2026.1' } });
  assert.deepEqual(fourth!.packs, { arabic: { id: 'dz.cem.4am.arabic.example', release: '2026.2' } });
  const primary = world.schools.find((one) => one.level === 'primary')!;
  assert.equal(primary.classes[0]!.packs['arabic']?.id, 'dz.primary.5ap.arabic.example');
  const stale = packs.map((pack) => ({ ...pack, status: 'stale' as const }));
  assert.deepEqual(seedNationalWorld('ABCDE', zones, days, stale).schools[1]!.classes[0]!.packs, {});
});

test('IDs, registration numbers and names never repeat, staff are half women, and a short week is refused', () => {
  const ids = [
    ...world.directorates.map((one) => one.id),
    ...world.schools.flatMap((s) => [s.id, ...s.teachers.map((t) => t.id), ...s.classes.map((c) => c.id)]),
    ...world.schools.flatMap((s) => s.classes.flatMap((c) => c.pupils.map((p) => p.id))),
  ];
  assert.equal(new Set(ids).size, ids.length);
  const registrations = world.schools.flatMap((s) => s.classes.flatMap((c) => c.pupils.map((p) => p.registration)));
  assert.equal(new Set(registrations).size, registrations.length);
  assert.ok(registrations.every((one) => /^99\d{8}$/u.test(one ?? '')));
  const everyone = people(world);
  assert.equal(new Set(everyone.map((one) => one.name)).size, everyone.length);
  assert.equal(everyone.filter((one) => one.sex === 'f').length, everyone.length / 2);
  for (const role of ['director', 'deputy', 'preparer'] as const)
    assert.equal(world.schools.filter((one) => one[role].sex === 'f').length, world.schools.length / 2);
  const directors = (at: number) => world.schools.filter((_, index) => index % 6 === at).map((one) => one.director.sex);
  for (let at = 0; at < 6; at += 1) assert.equal(directors(at).filter((sex) => sex === 'f').length, 6);
  assert.equal(new Set(world.schools.map((one) => one.name)).size, world.schools.length);
  assert.throws(() => seedNationalWorld('ABCDE', zones, [0, 1, 2, 3], packs), /five working days/u);
  assert.throws(() => seedNationalWorld('ABCDE', zones, [0, 1, 2, 3, 3], packs), /five working days/u);
});
