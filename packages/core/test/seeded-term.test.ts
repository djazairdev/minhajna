// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A seeded school's term of signed weeks (#549, answer 626), from the bundled
// reference data: the same seed gives the same weeks, each one a week a teacher
// signs; each course has its thirteen weeks to the world's date, the first from
// the year's first day, the exam week not held, and nothing after the world's
// date, a date mid-week giving a course the same pace when no session after it
// is lost; the made-up closure is the ninth week's Tuesday in the third wilaya,
// its sessions there not held and counted as closed, and nowhere else; across
// the world a few absences are covered, a few sessions await confirmation in
// the last week only, and a few weeks are corrected once, for an entry error,
// never the last; each course moves through its pack, never back, its items in
// order and as many sessions as it held, passing over items as merged when the
// plan holds more than the year, some courses running long and others not, and
// a class with no pack works on no item. Every world and school is made up.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { before, describe, it } from 'node:test';
import {
  demoClosure,
  directorSchool,
  packKey,
  parseBellData,
  parseCountryProfile,
  parsePlanPack,
  parseSchoolCalendar,
  readWeekRecord,
  readWeekTotals,
  seededTerm,
  seedNationalWorld,
  weekChanges,
  weekRecordText,
  type BellData,
  type Day,
  type DemoSchool,
  type DemoWorld,
  type Reference,
  type SeededCourseWeek,
  type SeededTermInput,
} from '../src/index.ts';
import { mac } from './world-crypto.ts';

const data = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../data/dz/${path}`, import.meta.url), 'utf8'));

const SEED = 'ABCDE';
const UNTIL = '2026-12-17' as Day;
const NAME = { en: 'Closure made up for the demo' };

let world: DemoWorld;
let reference: Reference;
let bells: BellData;

before(() => {
  const profile = parseCountryProfile(data('profile.json'));
  assert.ok(profile.ok);
  const calendar = parseSchoolCalendar(data('calendar-2026-2027.json'), profile.value);
  assert.ok(calendar.ok);
  const read = parseBellData(data('bells.json'), profile.value);
  assert.ok(read.ok);
  bells = read.value;
  const packs = readdirSync(new URL('../../../data/dz/packs/', import.meta.url)).map((file) => {
    const pack = parsePlanPack(data(`packs/${file}`));
    assert.ok(pack.ok);
    return pack.value;
  });
  world = seedNationalWorld(SEED, profile.value.zones ?? [], profile.value.workingDays, packs);
  const byKey = new Map(packs.map((pack) => [packKey(pack.id, pack.release), pack]));
  reference = { country: profile.value, year: calendar.value.year, calendar: calendar.value.entries, packs: byKey };
});

const input = (school: DemoSchool, more: Partial<SeededTermInput> = {}): SeededTermInput => ({
  seed: SEED,
  school,
  space: `space-of-${school.id}`,
  reference,
  closures: [demoClosure(world, reference, NAME)],
  bells,
  until: UNTIL,
  ...more,
});

const term = (school: DemoSchool, more?: Partial<SeededTermInput>) => seededTerm(input(school, more), mac);
const byCourse = (weeks: readonly SeededCourseWeek[]) => {
  const courses = new Map<string, SeededCourseWeek[]>();
  for (const one of weeks) courses.set(one.versions[0]!.course, [...(courses.get(one.versions[0]!.course) ?? []), one]);
  return courses;
};
const latest = (one: SeededCourseWeek) => one.versions.at(-1)!;

describe('a seeded school’s term', () => {
  it('is the same for the same seed, and each week is one a teacher signs', async () => {
    const school = directorSchool(world)!;
    const weeks = await term(school);
    assert.deepEqual(await term(school), weeks);
    for (const one of weeks.flatMap((week) => week.versions)) {
      const text = weekRecordText(one);
      assert.deepEqual(
        readWeekRecord(text),
        JSON.parse(JSON.stringify({ ...one, sessions: readWeekRecord(text)!.sessions })),
      );
      assert.ok(readWeekTotals(text) !== null);
    }
  });

  it('gives each course thirteen weeks to the date, the exam week not held, the same pace mid-week', async () => {
    const school = directorSchool(world)!;
    const courses = byCourse(await term(school));
    assert.equal(courses.size, school.classes.length * 3);
    for (const weeks of courses.values()) {
      assert.equal(weeks.length, 13);
      assert.equal(weeks[0]!.versions[0]!.week, '2026-09-20');
      const exams = weeks.find((one) => one.versions[0]!.week === '2026-12-06')!;
      assert.ok(latest(exams).sessions.every((one) => one.state === 'not-held'));
      assert.deepEqual(latest(exams).totals.items, []);
    }
    const early = byCourse(await term(school, { until: '2026-12-15' as Day }));
    for (const weeks of early.values()) assert.ok(latest(weeks.at(-1)!).sessions.every((one) => one.day <= 2));
    for (const [course, weeks] of byCourse(await term(school))) {
      const end = latest(weeks.at(-1)!);
      if (end.sessions.some((one) => one.day > 2 && one.state === 'not-held')) continue;
      assert.equal(latest(early.get(course)!.at(-1)!).totals.runsLong, end.totals.runsLong, course);
    }
  });

  it('closes one day in the third wilaya only, counted as closed', async () => {
    const closure = demoClosure(world, reference, NAME);
    assert.deepEqual(
      [closure.from, closure.to, closure.zone, closure.effect],
      ['2026-11-17', '2026-11-17', world.directorates[2]!.wilaya.code, 'closure'],
    );
    assert.deepEqual(closure.name, NAME);
    for (const school of world.schools.filter((one) => one.level === 'cem').slice(8, 16)) {
      const closed = (await term(school)).filter((one) => one.versions[0]!.week === '2026-11-15');
      const count = closed.reduce((sum, one) => sum + latest(one).totals.closed, 0);
      const there = school.wilaya === closure.zone;
      assert.equal(count > 0, there, school.id);
      if (there)
        for (const one of closed)
          assert.ok(
            latest(one)
              .sessions.filter((s) => s.day === 2)
              .every((s) => s.state === 'not-held'),
          );
    }
  });

  it('holds a few covered absences, awaiting sessions in the last week, and corrections', async () => {
    const weeks = (await Promise.all(world.schools.slice(0, 12).map((school) => term(school)))).flat();
    const notHeld = weeks.filter(
      (one) => one.versions[0]!.week !== '2026-12-06' && latest(one).sessions.some((s) => s.state === 'not-held'),
    );
    assert.ok(notHeld.length > 0);
    assert.ok(weeks.some((one) => latest(one).totals.covered > 0));
    const awaiting = weeks.filter((one) => latest(one).sessions.some((s) => s.state === 'awaiting'));
    assert.ok(awaiting.length > 0 && awaiting.every((one) => one.versions[0]!.week === '2026-12-13'));
    const fixed = weeks.filter((one) => one.versions.length === 2);
    assert.ok(fixed.length > 0);
    for (const one of fixed) {
      const [signed, corrected] = one.versions as [never, never];
      assert.deepEqual(
        weekChanges(signed, corrected).map((change) => [change.before, change.after]),
        [['not-held', 'held']],
      );
      assert.equal(latest(one).reason, 'entry-error');
      assert.notEqual(latest(one).week, '2026-12-13');
    }
  });

  it('moves each course through its pack, and a class with no pack works on no item', async () => {
    const school = directorSchool(world)!;
    for (const weeks of byCourse(await term(school)).values()) {
      let reached = 0;
      for (const week of weeks.map(latest)) {
        assert.ok(week.totals.reached >= reached);
        reached = week.totals.reached;
        const ids = week.totals.items.map((one) => one.item);
        assert.deepEqual(ids, [...ids].sort());
        const held = week.sessions.filter((one) => one.state === 'held').length;
        assert.ok(week.totals.items.reduce((sum, one) => sum + one.sessions, 0) <= held);
      }
      const pinned = school.classes.find((one) => one.id === weeks[0]!.classId)!.packs[weeks[0]!.versions[0]!.subject];
      assert.equal(reached > 0, pinned !== undefined);
    }
    const bare = { ...school, classes: school.classes.map((one) => ({ ...one, packs: {} })) };
    for (const week of (await term(bare)).map(latest))
      assert.deepEqual([week.totals.items, week.totals.reached], [[], 0]);
  });

  it('passes over items, merged, when a plan holds more than the year, and some courses run long', async () => {
    const school = directorSchool(world)!;
    const packs = new Map(
      [...reference.packs].map(([key, pack]) => [
        key,
        { ...pack, items: pack.items.map((one, at) => ({ ...one, budget: at === pack.items.length - 1 ? 600 : 1 })) },
      ]),
    );
    const weeks = (await term(school, { reference: { ...reference, packs } })).map(latest);
    const merged = weeks.flatMap((week) => week.totals.items).filter((one) => one.outcome === 'merged');
    assert.ok(merged.length > 0 && merged.every((one) => one.sessions === 0));
    const courses = byCourse(
      await Promise.all(world.schools.slice(0, 6).map((one) => term(one))).then((all) => all.flat()),
    );
    const long = [...courses.values()].map((one) => latest(one.at(-1)!).totals.runsLong);
    assert.ok(long.includes(true) && long.includes(false));
  });
});
