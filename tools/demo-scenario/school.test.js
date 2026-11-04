// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The scenario at the school as written (#630, answer 722), which CI runs
// against the demo server (test.yml): it can run, it uses every step it brings,
// the people it plays are three teachers of 4AM classes in a seeded school, and
// its timetable reads as the template with no problem, for every session of the
// school's week and for any world's seeded names. Every world here is made up.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { URL } from 'node:url';
import { directorSchool, readTimetable } from '@minhajna/core';
import { appModule } from './app.js';
import { appAccess, reference } from './device.js';
import { SCHOOL } from './school.js';
import { schoolOf, teacherOf, timetableRows } from './school-join.js';
import { scenarioProblem } from './scenario.js';

const { seededWorld } = await appModule('director/director-world.ts');
const { timetableWords } = await appModule('timetable/timetable-words.ts');
const stage = { reference };

describe('the scenario at the school', () => {
  it('can run, and uses every step it brings', () => {
    assert.equal(scenarioProblem(SCHOOL), null);
    const used = new Set(SCHOOL.steps.map((step) => step.do));
    for (const action of Object.keys(SCHOOL.actions)) assert.ok(used.has(action), action);
  });

  it('runs in CI with the sample, its name the seed of its world', () => {
    assert.match(readFileSync(new URL('run.js', import.meta.url), 'utf8'), /\[SAMPLE, SCHOOL\]/);
    assert.equal(SCHOOL.access, appAccess);
  });

  it('plays three teachers of the school a world’s director runs', () => {
    const device = { world: 'K1MT1' };
    const school = schoolOf(stage, device);
    assert.deepEqual(school.id, directorSchool(seededWorld('K1MT1', reference)).id);
    const people = ['a', 'b', 'c'].map((who) => teacherOf(stage, device, who));
    assert.equal(new Set(people.map((one) => one.id)).size, 3);
    assert.throws(() => teacherOf(stage, device, 'd'), /has no teacher d/);
  });

  for (const world of ['K1MT1', 'Z9XY8']) {
    it(`reads the timetable of world ${world} with no problem, every session of its week`, () => {
      const school = schoolOf(stage, { world });
      const read = readTimetable(timetableRows(stage, school), timetableWords());
      assert.deepEqual(read.problems, []);
      assert.equal(read.sessions.length, school.week.length);
    });
  }
});
