// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Schools' marks (#626, answer 677): a school keeps one mark in a world for the
// run, another school another, never one drawn before in the run; each world
// apart, and a world of the same ID but another start apart too; a mark given
// back frees its room, unless another call took it meanwhile; past a world's
// cap or every world's, a school is UNCOUNTED, and forgetting a world frees its
// marks; and a figure's schools are the most distinct marks of any one run,
// anything else left out. Every code here is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MARK, SchoolMarks, schoolsIn, UNCOUNTED } from '../src/insights/school-marks.js';

const code = (school: number) => school.toString(16).padStart(64, 'c');

describe('schools’ marks', () => {
  it('gives a school one mark in a world for the run, another school another, never one drawn before', () => {
    const marks = new SchoolMarks();
    const first = marks.mark('AAAAA', 'start', code(1));
    assert.match(first.mark, MARK);
    assert.equal(first.fresh, true);
    assert.deepEqual(marks.mark('AAAAA', 'start', code(1)), { ...first, fresh: false });
    const second = marks.mark('AAAAA', 'start', code(2)).mark;
    assert.notEqual(second, first.mark);
    assert.equal(second.slice(0, 17), first.mark.slice(0, 17));
    const elsewhere = marks.mark('BBBBB', 'start', code(1)).mark;
    const later = marks.mark('AAAAA', 'start-2', code(1)).mark;
    assert.equal(new Set([first.mark, second, elsewhere, later]).size, 4);
    assert.notEqual(new SchoolMarks().mark('AAAAA', 'start', code(1)).mark.slice(0, 16), first.mark.slice(0, 16));
  });

  it('frees a mark given back, and never draws its number again', () => {
    const marks = new SchoolMarks(1, 10);
    const given = marks.mark('AAAAA', 'start', code(1));
    marks.release('AAAAA', 'start', given.school);
    assert.equal(marks.size, 0);
    const next = marks.mark('AAAAA', 'start', code(2));
    assert.equal(next.fresh, true);
    assert.notEqual(next.mark, given.mark);
    marks.release('AAAAA', 'other-start', next.school);
    assert.equal(marks.size, 1);
  });

  it('keeps a mark another call took before it was given back, so one school never holds two', () => {
    const marks = new SchoolMarks();
    const drawn = marks.mark('AAAAA', 'start', code(1));
    const taken = marks.mark('AAAAA', 'start', code(1));
    assert.equal(taken.fresh, false);
    marks.release('AAAAA', 'start', drawn.school);
    assert.equal(marks.size, 1);
    assert.equal(marks.mark('AAAAA', 'start', code(1)).mark, drawn.mark);
    assert.equal(schoolsIn([taken.mark, marks.mark('AAAAA', 'start', code(1)).mark]), 1);
  });

  it('marks a school UNCOUNTED past a world’s cap or every world’s, and frees a world’s marks with it', () => {
    const marks = new SchoolMarks(2, 3);
    assert.match(marks.mark('AAAAA', 'start', code(1)).mark, MARK);
    assert.match(marks.mark('AAAAA', 'start', code(2)).mark, MARK);
    assert.deepEqual(marks.mark('AAAAA', 'start', code(3)).mark, UNCOUNTED);
    assert.match(marks.mark('BBBBB', 'start', code(1)).mark, MARK);
    assert.equal(marks.mark('BBBBB', 'start', code(2)).mark, UNCOUNTED);
    assert.equal(marks.size, 3);
    marks.forget(['AAAAA']);
    assert.equal(marks.size, 1);
    assert.match(marks.mark('BBBBB', 'start', code(2)).mark, MARK);
  });

  it('counts a figure’s schools as the most distinct marks of any one run, anything else left out', () => {
    const run = (prefix: string, at: number) => `${prefix.repeat(16)}.${at}`;
    assert.equal(schoolsIn([]), 0);
    assert.equal(schoolsIn([UNCOUNTED, undefined, 7, 'not-a-mark']), 0);
    assert.equal(schoolsIn([run('a', 1), run('a', 2), run('a', 1), UNCOUNTED]), 2);
    assert.equal(schoolsIn([run('a', 1), run('a', 2), run('b', 1), run('b', 2), run('b', 3)]), 3);
  });
});
